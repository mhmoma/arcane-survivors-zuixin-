/**
 * 素材目录 + 互动类型 + 内置地图（城镇 / 太虚 / 剑冢 / 雪境）
 * 资源用站点根路径 /publish/...（须从仓库根目录起静态服务）
 */
(function (global) {
  const ASSET = '/publish/assets';

  const INTERACTIONS = [
    { id: 'none', name: '无互动' },
    { id: 'openMapSelect', name: '打开选图 / 秘境入口' },
    { id: 'openEquipment', name: '打开装备箱' },
    { id: 'openCostume', name: '打开时装' },
    { id: 'openProgression', name: '打开修炼 / 打坐' },
    { id: 'pickClass', name: '切换职业 NPC' },
    { id: 'custom', name: '自定义（payload）' },
  ];

  /** 可摆放素材种类 */
  const PROP_KINDS = [
    {
      id: 'portal',
      name: '秘境入口',
      group: 'town',
      src: `${ASSET}/generated/town-portal-xiandao-cb20260722-xiandao.webp`,
      w: 132, h: 154,
      defaults: { interaction: { type: 'openMapSelect', radius: 72, label: '秘境入口' }, collision: { mode: 'circle', radius: 14 } },
    },
    {
      id: 'chest',
      name: '装备箱',
      group: 'town',
      src: `${ASSET}/generated/town-chest-xiandao-cb20260722-xiandao.webp`,
      w: 82, h: 76,
      defaults: { interaction: { type: 'openEquipment', radius: 58, label: '装备箱' }, collision: { mode: 'circle', radius: 12 } },
    },
    {
      id: 'fire',
      name: '打坐蒲团',
      group: 'town',
      src: `${ASSET}/generated/town-fire-xiandao-cb20260722-xiandao.webp`,
      w: 92, h: 88,
      defaults: { interaction: { type: 'openProgression', radius: 64, label: '打坐蒲团' }, collision: { mode: 'circle', radius: 10 } },
    },
    {
      id: 'crates',
      name: '木桶箱笼',
      group: 'town',
      src: `${ASSET}/generated/town-crates-xiandao-cb20260722-xiandao.webp`,
      w: 58, h: 54,
      defaults: { interaction: { type: 'none', radius: 28, label: '' }, collision: { mode: 'circle', radius: 10 } },
    },
    {
      id: 'costume',
      name: '时装商人位',
      group: 'town',
      src: `${ASSET}/spine/paladin/preview.png`,
      w: 64, h: 96,
      defaults: { interaction: { type: 'openCostume', radius: 52, label: '时装商人' }, collision: { mode: 'circle', radius: 10 } },
    },
    {
      id: 'classNpc',
      name: '职业 NPC',
      group: 'town',
      src: `${ASSET}/spine/mage/preview.png`,
      w: 64, h: 96,
      defaults: {
        interaction: { type: 'pickClass', radius: 48, label: '职业', payload: { cls: 'mage' } },
        collision: { mode: 'circle', radius: 10 },
      },
    },
    // 城镇装饰（图集）+ 房屋
    ...makeDecorKinds(),
    ...makeHouseKinds(),
    // 战斗地形（图集帧）
    ...makeTerrainKinds(),
  ];

  function makeDecorKinds() {
    // 单图：避免图集邻格串色；文件与打包脚本 names 一致
    const frames = [
      { id: 'gate', name: '城门', w: 168, h: 188, solid: 28, group: 'decor' },
      { id: 'road-dirt', name: '土路', w: 128, h: 128, solid: 0, group: 'decor', file: 'road-dirt-xiandao-cb20260723.webp' },
      { id: 'road-stone', name: '石头路', w: 128, h: 128, solid: 0, group: 'decor', file: 'road-stone-xiandao-cb20260723.webp' },
      { id: 'grass', name: '草地·圆', w: 128, h: 128, solid: 0, group: 'decor', file: 'grass-xiandao-cb20260723.webp' },
      { id: 'grass-square', name: '草地·方', w: 128, h: 128, solid: 0, group: 'decor', file: 'grass-square-xiandao-cb20260724.webp' },
      { id: 'flowers', name: '花卉', w: 88, h: 88, solid: 0, group: 'decor' },
      { id: 'flowerbed', name: '花坛', w: 110, h: 96, solid: 14, group: 'decor' },
      { id: 'danlu', name: '丹炉', w: 108, h: 120, solid: 16, group: 'decor' },
      { id: 'road-dirt-long', name: '土路长段', w: 256, h: 96, solid: 0, group: 'decor', file: 'road-dirt-long-xiandao-cb20260723.webp' },
      { id: 'road-stone-long', name: '石路长段', w: 256, h: 96, solid: 0, group: 'decor', file: 'road-stone-long-xiandao-cb20260723.webp' },
      { id: 'grass-flowers', name: '花草丛', w: 120, h: 100, solid: 0, group: 'decor' },
      { id: 'rock-flowers', name: '石景花卉', w: 110, h: 100, solid: 10, group: 'decor' },
    ];
    return frames.map((f) => ({
      id: `decor-${f.id}`,
      name: f.name,
      group: f.group,
      src: `${ASSET}/generated/town-decor-singles/${f.file || `${f.id}-xiandao-cb20260723.webp`}`,
      w: f.w,
      h: f.h,
      defaults: {
        interaction: { type: 'none', radius: 0, label: f.name },
        collision: { mode: f.solid > 0 ? 'circle' : 'none', radius: f.solid || 0 },
        meta: { decorType: f.id },
      },
    }));
  }

  function makeHouseKinds() {
    const houses = [
      { id: 'cottage', name: '小屋', file: 'town-house-1-xiandao-cb20260723.webp', w: 200, h: 160, solid: 36 },
      { id: 'inn', name: '客栈', file: 'town-house-2-xiandao-cb20260723.webp', w: 220, h: 180, solid: 40 },
      { id: 'pavilion', name: '厢房', file: 'town-house-3-xiandao-cb20260723.webp', w: 210, h: 165, solid: 38 },
      { id: 'alchemy', name: '丹房', file: 'town-house-4-xiandao-cb20260723.webp', w: 200, h: 190, solid: 38 },
      { id: 'mansion', name: '大宅', file: 'town-house-5-xiandao-cb20260723.webp', w: 240, h: 175, solid: 44 },
    ];
    return houses.map((h) => ({
      id: `house-${h.id}`,
      name: h.name,
      group: 'building',
      src: `${ASSET}/generated/${h.file}`,
      w: h.w,
      h: h.h,
      defaults: {
        interaction: { type: 'none', radius: 0, label: h.name },
        collision: { mode: 'circle', radius: h.solid },
        meta: { buildingType: h.id },
      },
    }));
  }

  function makeTerrainKinds() {
    // 必须用带 alpha 的图集，否则祭坛等会有黑底
    const atlas = `${ASSET}/generated/terrain-atlas.d35ccacd-cb20260722x-alpha.webp`;
    const frames = [
      { id: 'rift', name: '裂隙', frame: 0, solid: false },
      { id: 'rune', name: '符文', frame: 1, solid: false },
      { id: 'obelisk', name: '方尖碑', frame: 2, solid: true },
      { id: 'vortex', name: '漩涡', frame: 3, solid: false },
      { id: 'crack', name: '地裂', frame: 4, solid: false },
      { id: 'pillar', name: '石柱', frame: 5, solid: true },
      { id: 'wall', name: '残墙', frame: 6, solid: true },
      { id: 'altar', name: '祭坛', frame: 7, solid: true },
      { id: 'snow', name: '积雪', frame: 8, solid: false },
      { id: 'icecrack', name: '冰裂', frame: 9, solid: false },
      { id: 'crystal', name: '冰晶', frame: 10, solid: true },
      { id: 'icefield', name: '冰原', frame: 15, solid: false },
    ];
    return frames.map((f) => ({
      id: `terrain-${f.id}`,
      name: f.name,
      group: 'terrain',
      src: atlas,
      atlas: { cols: 4, rows: 4, index: f.frame },
      w: 96, h: 96,
      defaults: {
        interaction: { type: 'none', radius: 0, label: '' },
        collision: { mode: f.solid ? 'circle' : 'none', radius: 40 },
        meta: { terrainType: f.id, solid: f.solid },
      },
    }));
  }

  const GROUNDS = {
    town: `${ASSET}/generated/town-ground-xiandao-cb20260722-xiandao.webp`,
    chaos: `${ASSET}/generated/ground-chaos.4520ebed-cb20260722x.webp`,
    ruins: `${ASSET}/generated/ground-ruins.c21a8e13-cb20260722x.webp`,
    frost: `${ASSET}/generated/ground-frost.c9fb98de-cb20260722x.webp`,
  };

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  }

  const CLASS_OPTIONS = [
    { id: 'paladin', name: '玄甲 / 圣骑士' },
    { id: 'mage', name: '秘术 / 法师' },
    { id: 'ranger', name: '剑侠 / 游侠' },
    { id: 'gunslinger', name: '机关 / 枪手' },
    { id: 'lewdSaintess', name: '圣女' },
    { id: 'scytheMaiden', name: '琦琦 / 镰刀' },
  ];

  function heroPreviewSrc(cls) {
    const map = {
      mage: `${ASSET}/spine/mage/preview.png`,
      ranger: `${ASSET}/spine/ranger/preview.png`,
      gunslinger: `${ASSET}/spine/gunslinger/preview.png`,
      lewdSaintess: `${ASSET}/spine/lewd-saintess/preview.png`,
      scytheMaiden: `${ASSET}/spine/scythe-maiden/preview.png`,
      paladin: `${ASSET}/spine/paladin/preview.png`,
    };
    return map[cls] || map.mage;
  }

  function applyClassToEntity(ent, cls) {
    if (!ent) return;
    const opt = CLASS_OPTIONS.find((c) => c.id === cls) || CLASS_OPTIONS[1];
    ent.meta = { ...(ent.meta || {}), cls: opt.id, srcOverride: heroPreviewSrc(opt.id) };
    ent.src = heroPreviewSrc(opt.id);
    ent.interaction = {
      ...(ent.interaction || {}),
      type: 'pickClass',
      payload: { ...(ent.interaction?.payload || {}), cls: opt.id },
      label: ent.interaction?.label && ent.interaction.label !== '职业'
        ? ent.interaction.label
        : opt.name.split(' / ')[0] || '职业',
    };
  }

  function makeEntity(kindId, x, y, patch = {}) {
    const kind = PROP_KINDS.find((k) => k.id === kindId);
    if (!kind) throw new Error('未知素材: ' + kindId);
    const d = kind.defaults || {};
    const ent = {
      id: patch.id || uid(kindId.replace(/[^a-z0-9]+/gi, '-').toLowerCase()),
      kind: kindId,
      x, y,
      w: patch.w ?? kind.w,
      h: patch.h ?? kind.h,
      rotation: patch.rotation ?? 0,
      scale: patch.scale ?? 1,
      flipX: !!(patch.flipX),
      flipY: !!(patch.flipY),
      z: patch.z ?? 0,
      enabled: true,
      src: patch.src ?? kind.src ?? null,
      atlas: patch.atlas ?? kind.atlas ?? null,
      interaction: JSON.parse(JSON.stringify(patch.interaction || d.interaction || { type: 'none', radius: 40, label: '' })),
      collision: JSON.parse(JSON.stringify(patch.collision || d.collision || { mode: 'none', radius: 10, points: [] })),
      meta: { ...(d.meta || {}), ...(patch.meta || {}) },
      notes: patch.notes || '',
    };
    if (kindId === 'classNpc') {
      const cls = patch.meta?.cls || patch.interaction?.payload?.cls || ent.meta?.cls || ent.interaction?.payload?.cls || 'mage';
      applyClassToEntity(ent, cls);
    }
    return ent;
  }

  /** 碰撞多边形世界坐标（兼容旧 local） */
  function collisionPolyWorld(ent) {
    const col = ent.collision || {};
    const pts = col.points || [];
    if (!pts.length) return [];
    if (col.space === 'world') return pts.map((p) => [p[0], p[1]]);
    return pts.map(([lx, ly]) => [ent.x + lx, ent.y + ly]);
  }

  /** @deprecated 兼容旧名 */
  function localPolyToWorld(ent) {
    return collisionPolyWorld(ent);
  }

  function worldPolyToLocal(ent, worldPts) {
    return worldPts.map(([wx, wy]) => [wx - ent.x, wy - ent.y]);
  }

  function setCollisionPolyWorld(ent, worldPts) {
    ent.collision = {
      ...(ent.collision || {}),
      mode: 'polygon',
      space: 'world',
      radius: 0,
      points: worldPts.map(([x, y]) => [Math.round(x), Math.round(y)]),
    };
  }

  function circleWorldCenter(ent) {
    const col = ent.collision || {};
    if (col.mode === 'circle' && col.space === 'world' && col.x != null && col.y != null) {
      return { x: col.x, y: col.y };
    }
    return { x: ent.x, y: ent.y };
  }

  function buildTownProject() {
    const W = 2800, H = 1900;
    const entities = [
      makeEntity('portal', 1445, 595, { id: 'portal' }),
      makeEntity('chest', 1495, 870, { id: 'chest' }),
      makeEntity('costume', 955, 1015, { id: 'costume' }),
      makeEntity('fire', 1200, 710, { id: 'fire' }),
      makeEntity('crates', 1010, 870, { id: 'barrel1' }),
      makeEntity('crates', 1615, 735, { id: 'barrel2' }),
      makeEntity('crates', 910, 610, { id: 'barrel3' }),
      makeEntity('crates', 1705, 1010, { id: 'barrel4' }),
      makeEntity('classNpc', 1050, 684, { id: 'class-mage', interaction: { type: 'pickClass', radius: 48, label: '秘术', payload: { cls: 'mage' } }, meta: { cls: 'mage' } }),
      makeEntity('classNpc', 1350, 684, { id: 'class-ranger', interaction: { type: 'pickClass', radius: 48, label: '剑侠', payload: { cls: 'ranger' } }, meta: { cls: 'ranger' } }),
      makeEntity('classNpc', 980, 828, { id: 'class-gunslinger', interaction: { type: 'pickClass', radius: 48, label: '机关', payload: { cls: 'gunslinger' } }, meta: { cls: 'gunslinger' } }),
      makeEntity('classNpc', 1420, 828, { id: 'class-lewdSaintess', interaction: { type: 'pickClass', radius: 48, label: '圣女', payload: { cls: 'lewdSaintess' } }, meta: { cls: 'lewdSaintess' } }),
      makeEntity('classNpc', 1128, 894, { id: 'class-scytheMaiden', interaction: { type: 'pickClass', radius: 48, label: '琦琦', payload: { cls: 'scytheMaiden' } }, meta: { cls: 'scytheMaiden' } }),
    ];
    // 职业预览图按 cls 换
    for (const e of entities) {
      if (e.kind === 'classNpc') {
        applyClassToEntity(e, e.meta?.cls || e.interaction?.payload?.cls || 'mage');
      }
      if (e.kind === 'costume') {
        e.meta = { ...(e.meta || {}), srcOverride: heroPreviewSrc('paladin') };
      }
    }

    const paths = [
      {
        id: 'mainPath',
        type: 'polyline',
        points: [[1400, 1900], [1400, 730], [1440, 590]],
        strokeOuter: 88,
        strokeInner: 46,
      },
      {
        id: 'sidePath',
        type: 'polyline',
        points: [[1200, 750], [1515, 845]],
        strokeOuter: 88,
        strokeInner: 46,
      },
    ];

    // 世界边界碰撞：矩形拆成多边形
    const collisions = [
      {
        id: 'bounds-poly',
        name: '可行走边界（示意内缩）',
        mode: 'polygon',
        points: [[50, 60], [2750, 60], [2750, 1840], [50, 1840]],
        blockOutside: true,
        notes: '玩家被限制在多边形内；编辑时可改顶点',
      },
    ];

    return wrapSceneProject({
      id: 'builtin-town',
      name: '仙道城镇',
      kind: 'town',
      builtin: true,
      worldW: W,
      worldH: H,
      groundUrl: GROUNDS.town,
      fill: '#07111b',
      spawn: { x: 1200, y: 900 },
      entities,
      paths,
      collisions,
      tileSize: 512,
    });
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedCombatTerrain(mapId, W, H, seed) {
    const defs = {
      chaos: [
        ['rift', 20, false],
        ['rune', 14, false],
        ['obelisk', 10, true],
      ],
      ruins: [
        ['crack', 18, false],
        ['pillar', 10, true],
        ['wall', 8, true],
        ['altar', 5, true],
      ],
      frost: [
        ['snow', 18, false],
        ['icecrack', 12, false],
        ['crystal', 8, true],
        ['icefield', 5, false],
      ],
    }[mapId] || [];
    const rnd = mulberry32(seed);
    const placed = [];
    const cx = W / 2, cy = H / 2;
    for (const [type, count, solid] of defs) {
      for (let i = 0; i < count; i++) {
        let x, y, r, ok = false;
        r = type === 'icefield' ? 95 + rnd() * 60 : solid ? 34 + rnd() * 28 : 28 + rnd() * 50;
        for (let t = 0; t < 40; t++) {
          x = 140 + rnd() * (W - 280);
          y = 160 + rnd() * (H - 320);
          if (Math.hypot(x - cx, y - cy) < 420) continue;
          ok = true;
          for (const p of placed) {
            const gap = solid || p.solid ? r + p.r + 70 : r + p.r + 24;
            if (Math.hypot(x - p.x, y - p.y) < gap) { ok = false; break; }
          }
          if (ok) break;
        }
        if (!ok) continue;
        placed.push({ type, x, y, r, solid });
      }
    }
    return placed.map((p, i) => {
      const kindId = `terrain-${p.type}`;
      const e = makeEntity(kindId, p.x, p.y, {
        id: `${mapId}-${p.type}-${i}`,
        w: Math.round(p.r * 2.15),
        h: Math.round(p.r * (p.type === 'wall' ? 1.05 : p.type === 'icefield' ? 1.55 : 2.15)),
        collision: solidCircleOrNone(p),
        meta: { terrainType: p.type, solid: p.solid, r: p.r },
      });
      return e;
    });
  }

  function solidCircleOrNone(p) {
    if (!p.solid) {
      if (p.type === 'icefield') return { mode: 'circle', radius: Math.round(p.r), notes: '减速区' };
      return { mode: 'none', radius: 0, points: [] };
    }
    return { mode: 'circle', radius: Math.round(p.r), points: [] };
  }

  function buildCombatProject(mapId, name, groundKey, fill, seed) {
    const W = 2800, H = 3200;
    const entities = seedCombatTerrain(mapId, W, H, seed);
    return wrapSceneProject({
      id: `builtin-${mapId}`,
      name,
      kind: 'combat',
      builtin: true,
      mapId,
      worldW: W,
      worldH: H,
      groundUrl: GROUNDS[groundKey],
      fill,
      spawn: { x: W / 2, y: H / 2 },
      entities,
      paths: [],
      collisions: [],
      tileSize: 512,
      rulesRef: `rules/${mapId}`,
    });
  }

  function wrapSceneProject(cfg) {
    const schema = global.MapEditorSchema;
    const world = schema.emptyWorld({
      id: cfg.id,
      name: cfg.name,
      builtin: !!cfg.builtin,
      kind: cfg.kind || 'custom',
      mapId: cfg.mapId || null,
      originRegionId: 'origin',
      spawn: { regionId: 'origin', x: cfg.spawn.x, y: cfg.spawn.y },
      defaults: {
        groundDrawSize: cfg.tileSize || 512,
        regionSize: Math.max(cfg.worldW, cfg.worldH),
        fill: cfg.fill || '#080b1b',
        tint: 'rgba(5,8,20,.18)',
        rulesRef: cfg.rulesRef || 'rules/chaos',
        propsPreset: cfg.mapId || 'none',
      },
      regions: [{ id: 'origin', rx: 0, ry: 0 }],
      scene: {
        worldW: cfg.worldW,
        worldH: cfg.worldH,
        tileSize: cfg.tileSize || 512,
        groundUrl: cfg.groundUrl || null,
      },
    });
    const region = schema.emptyRegion({
      id: 'origin',
      name: cfg.name,
      rx: 0, ry: 0,
      groundUrl: cfg.groundUrl || null,
      entities: cfg.entities || [],
      paths: cfg.paths || [],
      collisions: cfg.collisions || [],
      airWalls: cfg.airWalls || [],
      propsPreset: cfg.mapId || null,
      rulesRef: cfg.rulesRef || null,
    });
    return {
      world,
      regions: { origin: region },
      assets: {
        origin: {
          groundUrlExternal: cfg.groundUrl || null,
        },
      },
      selectedRegionId: 'origin',
      selectedEntityId: null,
      viewMode: 'scene',
      dirty: false,
    };
  }

  function allBuiltins() {
    return [
      buildTownProject(),
      buildCombatProject('chaos', '太虚荒原', 'chaos', '#080b1b', 20260723),
      buildCombatProject('ruins', '上古剑冢', 'ruins', '#15100b', 20260724),
      buildCombatProject('frost', '北冥雪境', 'frost', '#06111f', 20260725),
    ];
  }

  function kindById(id) {
    return PROP_KINDS.find((k) => k.id === id) || null;
  }

  global.MapEditorCatalog = {
    ASSET,
    INTERACTIONS,
    PROP_KINDS,
    CLASS_OPTIONS,
    GROUNDS,
    makeEntity,
    applyClassToEntity,
    heroPreviewSrc,
    localPolyToWorld,
    worldPolyToLocal,
    collisionPolyWorld,
    setCollisionPolyWorld,
    circleWorldCenter,
    allBuiltins,
    kindById,
    buildTownProject,
  };
})(window);
