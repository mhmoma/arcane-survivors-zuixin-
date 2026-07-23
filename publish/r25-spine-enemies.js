/**
 * Spine 3.8 multi-enemy renderer.
 * - Flying packs (cha_201/202/203): keep as-is (stand/fx)
 * - Other small mobs: humanoid walk packs from Q版本仙侠, scaled down
 * - Bosses: larger humanoid packs
 */
(function () {
  'use strict';

  const CELL = 192;
  const BASE = './assets/spine/monsters/';
  const MAX_DRAW = 56; // FPS: prioritize near/boss, half-rate blit for rest

  // Flying creatures — keep original non-walk packs
  const FLY_PACKS = ['cha_201', 'cha_202', 'cha_203'];

  // Small humanoid mobs (have walk/run) — drawn small
  const HUMANOID_MOB_PACKS = [
    'cha_1104', 'cha_1114', 'cha_1124', 'cha_1134', 'cha_1144',
    'cha_1155', 'cha_1165', 'cha_1175', 'cha_1185', 'cha_1195',
    'cha_1205', 'cha_1215', 'cha_1225', 'cha_1235', 'cha_1245',
    'cha_3175', 'cha_3185', 'cha_3195', 'cha_3205', 'cha_3215',
    'cha_4011', 'cha_4021', 'cha_4032', 'cha_4042', 'cha_4052',
    'cha_5013', 'cha_5024', 'cha_5034', 'cha_5044', 'cha_5056'
  ];

  // Bosses — larger humanoids
  const BOSS_PACKS = [
    'cha_1011', 'cha_1021', 'cha_1032', 'cha_1042', 'cha_1052',
    'cha_1063', 'cha_1073', 'cha_1083', 'cha_1094',
    'cha_1235', 'cha_1245'
  ];

  // Fallback pool used when type unknown
  const MOB_PACKS = HUMANOID_MOB_PACKS;

  const TYPE_MOB = {
    // flying
    eye: 'cha_201',
    healer: 'cha_202',
    wraith: 'cha_203',
    voidWalker: 'cha_203',
    // humanoid small (walk)
    imp: 'cha_1104',
    lavaImp: 'cha_1114',
    skeleton: 'cha_1124',
    shield: 'cha_1134',
    slime: 'cha_1144',
    sporeSlime: 'cha_1155',
    guardian: 'cha_1165',
    charger: 'cha_1175',
    bloodAcolyte: 'cha_1185'
  };

  const SIZE = { mob: 68, fly: 76, elite: 82, boss: 152 };

  let sharedCanvas = null;
  let gl = null;
  let sharedRenderer = null;
  let packCache = Object.create(null); // id -> { skeletonData, mapping, bounds, atlas, zoom }
  let loadPromises = Object.create(null);
  let uidSeq = 1;
  let lastWall = 0;
  let drawCount = 0;
  let blitCtx = null;
  let blitCanvas = null;

  function pickAnim(names, preferred) {
    for (const p of preferred) if (names.includes(p)) return p;
    return null;
  }

  function waitAssets(assetManager) {
    return new Promise((resolve, reject) => {
      const tick = () => {
        if (assetManager.isLoadingComplete()) {
          if (assetManager.hasErrors()) reject(new Error(JSON.stringify(assetManager.getErrors())));
          else resolve();
        } else requestAnimationFrame(tick);
      };
      tick();
    });
  }

  function ensureShared() {
    if (sharedCanvas && gl && sharedRenderer) return true;
    if (!window.spine?.webgl) return false;
    sharedCanvas = document.createElement('canvas');
    sharedCanvas.width = CELL;
    sharedCanvas.height = CELL;
    sharedCanvas.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(sharedCanvas);
    gl = sharedCanvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      antialias: false
    });
    if (!gl) return false;
    sharedRenderer = new spine.webgl.SceneRenderer(sharedCanvas, gl);
    blitCanvas = document.createElement('canvas');
    blitCanvas.width = CELL;
    blitCanvas.height = CELL;
    blitCtx = blitCanvas.getContext('2d', { alpha: true });
    return true;
  }

  function hashStr(s) {
    let h = 0;
    const str = String(s || '');
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function packIdForEnemy(e) {
    if (!e) return HUMANOID_MOB_PACKS[0];
    if (e.boss) {
      const key = e.bossType || e.img || 'boss';
      return BOSS_PACKS[hashStr(key) % BOSS_PACKS.length];
    }
    if (TYPE_MOB[e.type]) return TYPE_MOB[e.type];
    // default: small walking humanoid
    return HUMANOID_MOB_PACKS[hashStr(e.type || e.img || 'imp') % HUMANOID_MOB_PACKS.length];
  }

  function isFlyPack(id) {
    return FLY_PACKS.includes(id);
  }

  function displaySize(e) {
    if (e?.boss) return SIZE.boss;
    const id = e?.__spinePack || packIdForEnemy(e);
    if (isFlyPack(id)) return e?.elite ? SIZE.elite + 4 : SIZE.fly;
    if (e?.elite) return SIZE.elite;
    return SIZE.mob;
  }

  function computeBounds(skeleton) {
    skeleton.updateWorldTransform();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const drawOrder = skeleton.drawOrder;
    for (let i = 0; i < drawOrder.length; i++) {
      const slot = drawOrder[i];
      const att = slot.getAttachment();
      if (!att) continue;
      if (att instanceof spine.RegionAttachment) {
        const verts = new Array(8);
        att.computeWorldVertices(slot.bone, verts, 0, 2);
        for (let v = 0; v < 8; v += 2) {
          minX = Math.min(minX, verts[v]);
          minY = Math.min(minY, verts[v + 1]);
          maxX = Math.max(maxX, verts[v]);
          maxY = Math.max(maxY, verts[v + 1]);
        }
      } else if (att instanceof spine.MeshAttachment) {
        const count = att.worldVerticesLength;
        const verts = spine.Utils.setArraySize([], count, 0);
        att.computeWorldVertices(slot, 0, count, verts, 0, 2);
        for (let v = 0; v < count; v += 2) {
          minX = Math.min(minX, verts[v]);
          minY = Math.min(minY, verts[v + 1]);
          maxX = Math.max(maxX, verts[v]);
          maxY = Math.max(maxY, verts[v + 1]);
        }
      }
    }
    if (!isFinite(minX)) return { x: -40, y: -40, w: 80, h: 80 };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function fitCamera(renderer, bounds, zoomBoost) {
    const bw = Math.max(bounds.w, 1);
    const bh = Math.max(bounds.h, 1);
    const fit = Math.max(bw, bh) * 1.12 / Math.max(zoomBoost, 0.5);
    renderer.camera.viewportWidth = fit;
    renderer.camera.viewportHeight = fit;
    renderer.camera.position.x = bounds.x + bounds.w / 2;
    renderer.camera.position.y = bounds.y + bounds.h * 0.42;
    renderer.camera.zoom = 1;
    renderer.camera.update();
  }

  async function loadPack(id) {
    if (packCache[id]) return packCache[id];
    if (loadPromises[id]) return loadPromises[id];
    if (!ensureShared()) return null;

    loadPromises[id] = (async () => {
      const baseUrl = BASE + id + '/';
      const skel = id + '.skel';
      const atlas = id + '.atlas';
      const assetManager = new spine.webgl.AssetManager(gl, baseUrl);
      assetManager.loadTextureAtlas(atlas);
      assetManager.loadBinary(skel);
      await waitAssets(assetManager);
      const atl = assetManager.get(atlas);
      const binary = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atl));
      binary.scale = 1;
      const skeletonData = binary.readSkeletonData(assetManager.get(skel));
      const names = skeletonData.animations.map((a) => a.name);
      const humanoid = names.includes('run') && names.includes('attack');
      const fly = FLY_PACKS.includes(id);
      const mapping = {
        idle: pickAnim(names, ['stand', 'stand2', 'idle', 'jewelly']),
        run: pickAnim(names, ['run', 'walk', 'stand']),
        walk: pickAnim(names, ['walk', 'run', 'stand']),
        attack: pickAnim(names, ['attack', 'fx', 'fx2', 'fx3', 'skill']),
        skill: pickAnim(names, ['skill', 'fx3', 'fx2', 'fx', 'attack']),
        hurt: pickAnim(names, ['hurt', 'fx', 'fx2']),
        fly: pickAnim(names, ['jewelly', 'fx', 'stand'])
      };
      // sample bounds
      const skeleton = new spine.Skeleton(skeletonData);
      const state = new spine.AnimationState(new spine.AnimationStateData(skeletonData));
      let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
      const sampleAnim = mapping.idle || mapping.run;
      if (sampleAnim) {
        const a = skeletonData.findAnimation(sampleAnim);
        for (let i = 0; i < 6; i++) {
          state.clearTracks();
          skeleton.setToSetupPose();
          state.setAnimation(0, sampleAnim, false);
          const entry = state.getCurrent(0);
          if (entry) entry.trackTime = ((a?.duration || 0.001) * i) / 5;
          state.apply(skeleton);
          skeleton.updateWorldTransform();
          const b = computeBounds(skeleton);
          gMinX = Math.min(gMinX, b.x);
          gMinY = Math.min(gMinY, b.y);
          gMaxX = Math.max(gMaxX, b.x + b.w);
          gMaxY = Math.max(gMaxY, b.y + b.h);
        }
      }
      const pad = 0.08;
      const bodyW = Math.max(gMaxX - gMinX, 1);
      const bodyH = Math.max(gMaxY - gMinY, 1);
      const bounds = {
        x: gMinX - bodyW * pad,
        y: gMinY - bodyH * pad * 0.4,
        w: bodyW * (1 + pad * 2),
        h: bodyH * (1 + pad * 1.4)
      };
      const pack = {
        id,
        skeletonData,
        mapping,
        bounds,
        humanoid,
        fly,
        zoom: humanoid ? 1 : fly ? 1.08 : 1.05
      };
      packCache[id] = pack;
      console.info('[SpineEnemies] loaded', id, mapping, fly ? 'fly' : humanoid ? 'humanoid' : 'creature');
      return pack;
    })();

    try {
      return await loadPromises[id];
    } catch (e) {
      console.warn('[SpineEnemies] load failed', id, e.message);
      delete loadPromises[id];
      return null;
    }
  }

  function ensureEnemyRuntime(e) {
    if (!e) return null;
    if (!e.__spineUid) e.__spineUid = uidSeq++;
    if (!e.__spinePack) e.__spinePack = packIdForEnemy(e);
    const pack = packCache[e.__spinePack];
    if (!pack) {
      loadPack(e.__spinePack);
      return null;
    }
    if (!e.__spineInst || e.__spineInst.packId !== pack.id) {
      const skeleton = new spine.Skeleton(pack.skeletonData);
      const stateData = new spine.AnimationStateData(pack.skeletonData);
      stateData.defaultMix = 0.1;
      const state = new spine.AnimationState(stateData);
      e.__spineInst = { packId: pack.id, skeleton, state, lastAnim: '' };
    }
    return e.__spineInst;
  }

  function desiredAnim(e, mapping, pack) {
    const humanoid = !!pack.humanoid;
    const fly = !!pack.fly;
    if (e.hit > 0) return { name: mapping.hurt || mapping.attack || mapping.idle, loop: false };
    // 攻击 / 施法优先（小怪近战 attack，Boss 技能 skill）
    if ((e.skillAnim || 0) > 0) {
      return { name: mapping.skill || mapping.attack || mapping.idle, loop: false };
    }
    if ((e.attackAnim || 0) > 0) {
      return { name: mapping.attack || mapping.skill || mapping.idle, loop: false };
    }
    if (fly) {
      // flying hover (no walk in these packs)
      return { name: mapping.fly || mapping.idle, loop: true };
    }
    if (humanoid) {
      // 按游戏时间采样位移，避免高帧率下多数渲染帧位移为 0 误判成站立
      const gt = (typeof S !== 'undefined' && S && S.time != null) ? S.time : 0;
      if (e.__moveSampleT == null) {
        e.__prevX = e.x;
        e.__prevY = e.y;
        e.__moveSampleT = gt;
        e.__moveSpeed = 0;
      } else if (gt - e.__moveSampleT >= 1 / 30) {
        const dt = Math.max(0.001, gt - e.__moveSampleT);
        e.__moveSpeed = Math.hypot(e.x - (e.__prevX ?? e.x), e.y - (e.__prevY ?? e.y)) / dt;
        e.__prevX = e.x;
        e.__prevY = e.y;
        e.__moveSampleT = gt;
      }
      if ((e.__moveSpeed || 0) < 12) {
        return { name: mapping.idle || mapping.stand || mapping.run, loop: true };
      }
      return { name: mapping.run || mapping.walk || mapping.idle, loop: true };
    }
    return { name: mapping.idle, loop: true };
  }

  function beginFrame(wallNow) {
    drawCount = 0;
    const now = wallNow || performance.now();
    // 高刷下也给 Spine 一个稳定步进，避免动画抖、反复切轨
    let dt = lastWall ? Math.min(0.05, (now - lastWall) / 1000) : 1 / 60;
    if (dt < 1 / 240) dt = 1 / 240;
    lastWall = now;
    return dt;
  }

  /**
   * Render one enemy into destCanvas (CELL×CELL). Returns destCanvas or null.
   * Each Pixi slot must pass its OWN canvas so textures don't alias.
   */
  function renderEnemy(e, dt, destCanvas, opt) {
    if (!e || !ensureShared() || !destCanvas) return null;
    const ignoreCap = !!(opt && opt.ignoreCap);
    const skipBlit = !!(opt && opt.skipBlit);
    // skipBlit still advances anim but avoids WebGL draw + canvas blit + texture upload
    if (!ignoreCap && !skipBlit && drawCount >= MAX_DRAW) return null;
    const pack = packCache[e.__spinePack || packIdForEnemy(e)];
    if (!pack) {
      ensureEnemyRuntime(e);
      loadPack(packIdForEnemy(e));
      return null;
    }
    const inst = ensureEnemyRuntime(e);
    if (!inst) return null;

    const want = desiredAnim(e, pack.mapping, pack);
    if (!want?.name) return null;

    const seq = e.__animSeq || 0;
    if (inst.lastAnim !== want.name || inst.lastSeq !== seq) {
      const entry = inst.state.setAnimation(0, want.name, !!want.loop);
      if (entry) entry.mixDuration = 0.06;
      inst.lastAnim = want.name;
      inst.lastSeq = seq;
    }

    inst.state.update(dt || 1 / 60);
    inst.state.apply(inst.skeleton);
    inst.skeleton.updateWorldTransform();

    if (skipBlit) return null;

    fitCamera(sharedRenderer, pack.bounds, pack.zoom);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    sharedRenderer.begin();
    sharedRenderer.drawSkeleton(inst.skeleton, false);
    sharedRenderer.end();

    let dctx = destCanvas._ctx2d;
    if (!dctx) {
      dctx = destCanvas.getContext('2d', { alpha: true });
      destCanvas._ctx2d = dctx;
    }
    if (destCanvas.width !== CELL) destCanvas.width = CELL;
    if (destCanvas.height !== CELL) destCanvas.height = CELL;
    dctx.clearRect(0, 0, CELL, CELL);
    dctx.drawImage(sharedCanvas, 0, 0);
    drawCount++;
    return destCanvas;
  }

  function preloadCommon() {
    const early = [
      'cha_201', 'cha_202', 'cha_203',
      'cha_101', 'cha_301',
      'cha_1104', 'cha_1114', 'cha_1124', 'cha_1144',
      'cha_1011', 'cha_1021'
    ];
    early.forEach((id) => loadPack(id));
  }

  window.SpineEnemies = {
    CELL,
    SIZE,
    packIdForEnemy,
    displaySize,
    loadPack,
    beginFrame,
    renderEnemy,
    preloadCommon,
    ensureShared
  };
})();
