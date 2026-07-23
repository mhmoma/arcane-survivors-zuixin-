/**
 * 将当前编辑世界写入同源 localStorage，并通知游戏热更新。
 */
(function (global) {
  const KEY = 'xiandao-map-live-v1';
  const CHANNEL = 'xiandao-map-live';

  function toGameSrc(src) {
    if (!src) return src;
    return String(src)
      .replace(/^\/publish\//, './')
      .replace(/^\.\.\/publish\//, './')
      .replace(/^\.\/publish\//, './')
      .replace(/^publish\//, './');
  }

  function enrichEntity(ent) {
    const copy = JSON.parse(JSON.stringify(ent || {}));
    const kind = global.MapEditorCatalog?.kindById?.(copy.kind);
    if (kind) {
      if (kind.src) copy.src = kind.src;
      if (kind.atlas) copy.atlas = JSON.parse(JSON.stringify(kind.atlas));
      else delete copy.atlas;
      if (copy.w == null) copy.w = kind.w;
      if (copy.h == null) copy.h = kind.h;
    }
    // 职业 NPC：按所选职业写入预览图与 cls
    if (copy.kind === 'classNpc') {
      const cls = copy.meta?.cls || copy.interaction?.payload?.cls || 'mage';
      const src = global.MapEditorCatalog?.heroPreviewSrc?.(cls);
      copy.meta = { ...(copy.meta || {}), cls, srcOverride: src || copy.meta?.srcOverride };
      copy.interaction = {
        ...(copy.interaction || {}),
        type: 'pickClass',
        payload: { ...(copy.interaction?.payload || {}), cls },
      };
      if (src) copy.src = src;
    }
    // 战斗地形：保证游戏侧能读到 type / solid / r
    if (String(copy.kind || '').startsWith('terrain-')) {
      const tt = copy.meta?.terrainType || String(copy.kind).replace(/^terrain-/, '');
      const solid = !!(copy.meta && typeof copy.meta.solid === 'boolean'
        ? copy.meta.solid
        : (kind?.defaults?.meta?.solid));
      const sc = Number(copy.scale) || 1;
      const r = Number(copy.meta?.r) || Math.max(20, Math.max((copy.w || 0) * sc, (copy.h || 0) * sc) / 2.15);
      copy.meta = { ...(copy.meta || {}), terrainType: tt, solid, r };
      if (!copy.src && kind?.src) copy.src = kind.src;
      if (!copy.atlas && kind?.atlas) copy.atlas = JSON.parse(JSON.stringify(kind.atlas));
    }
    if (copy.meta?.srcOverride) copy.src = copy.meta.srcOverride;
    if (copy.src) copy.src = toGameSrc(copy.src);
    if (copy.z == null) copy.z = 0;
    return copy;
  }

  function serializeProject(project) {
    const w = project.world;
    const originId = project.selectedRegionId || w.originRegionId || 'origin';
    const reg = project.regions[originId] || Object.values(project.regions)[0];
    if (!reg) throw new Error('无区域数据');

    return {
      id: w.id,
      name: w.name,
      kind: (function(){const id=String(w.id||'');if(w.kind==='town'||id.includes('town'))return 'town';if(w.kind==='combat'||w.mapId||/^builtin-(chaos|ruins|frost)$/.test(id))return 'combat';return w.kind||'custom';})(),
      mapId: w.mapId || (String(w.id).startsWith('builtin-') ? String(w.id).replace(/^builtin-/, '') : null),
      builtin: !!w.builtin,
      worldW: w.scene?.worldW || reg.worldW || 2800,
      worldH: w.scene?.worldH || reg.worldH || (w.kind === 'combat' ? 3200 : 1900),
      spawn: w.spawn ? { x: w.spawn.x, y: w.spawn.y } : { x: 1200, y: 900 },
      groundUrl: toGameSrc(reg.groundUrl || w.scene?.groundUrl || null),
      fill: reg.fill || w.defaults?.fill || null,
      entities: (reg.entities || []).map(enrichEntity),
      paths: JSON.parse(JSON.stringify(reg.paths || [])),
      collisions: JSON.parse(JSON.stringify(reg.collisions || [])),
      airWalls: JSON.parse(JSON.stringify(reg.airWalls || [])),
      updatedAt: new Date().toISOString(),
    };
  }

  function applyProject(project) {
    if (!project) throw new Error('无活动世界');
    const worldLive = serializeProject(project);
    let pack;
    try {
      pack = JSON.parse(localStorage.getItem(KEY) || 'null') || { version: 1, worlds: {} };
    } catch {
      pack = { version: 1, worlds: {} };
    }
    pack.version = 1;
    pack.worlds = pack.worlds || {};
    pack.worlds[worldLive.id] = worldLive;
    pack.activeWorldId = worldLive.id;
    pack.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(pack));

    let notified = false;
    try {
      const bc = new BroadcastChannel(CHANNEL);
      bc.postMessage({ type: 'apply', worldId: worldLive.id, at: pack.updatedAt });
      bc.close();
      notified = true;
    } catch (_) {}

    // 同页也触发（若有人嵌了游戏）
    try {
      window.dispatchEvent(new CustomEvent('xiandao-map-live', { detail: pack }));
    } catch (_) {}

    return {
      pack,
      worldLive,
      notified,
      gameUrl: `${location.origin}/publish/?local=1`,
    };
  }

  function clearLive() {
    localStorage.removeItem(KEY);
    try {
      const bc = new BroadcastChannel(CHANNEL);
      bc.postMessage({ type: 'clear' });
      bc.close();
    } catch (_) {}
  }

  global.MapEditorLiveApply = { applyProject, serializeProject, clearLive, KEY, CHANNEL };
})(window);
