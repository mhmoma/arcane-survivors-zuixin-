/**
 * 地图编辑器 live 桥接（辅助层）
 * 城镇/战斗已在源码内直接读 localStorage；这里负责热提示与战斗中刷新地形。
 * 游戏必须与编辑器同源：http://localhost:5188/publish/?local=1
 */
(function () {
  const KEY = 'xiandao-map-live-v1';
  const CHANNEL = 'xiandao-map-live';

  function readPack() {
    try {
      if (window.MapLivePack && typeof MapLivePack.read === 'function') return MapLivePack.read();
      return JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      return null;
    }
  }

  function toast(msg) {
    try {
      if (typeof window.showNotice === 'function') window.showNotice(msg);
      else console.info('[MapLive]', msg);
    } catch (_) {
      console.info('[MapLive]', msg);
    }
  }

  function applyHot() {
    const pack = readPack();
    if (!pack?.worlds) {
      toast('没有可应用的地图数据');
      return;
    }

    // 战斗中：立刻重刷地形
    try {
      if (typeof S !== 'undefined' && S?.run && typeof terrainSeed === 'function') {
        S.terrain = terrainSeed();
        const lw = typeof liveCombatWorld === 'function' ? liveCombatWorld() : null;
        if (lw?.spawn && S.player) {
          const sx = Number(lw.spawn.x), sy = Number(lw.spawn.y);
          if (Number.isFinite(sx) && Number.isFinite(sy)) {
            const p = typeof nudgeCombatSpawn === 'function'
              ? nudgeCombatSpawn(sx, sy, S.player.r || 19)
              : { x: Math.max(24, Math.min(WORLD_W - 24, sx)), y: Math.max(62, Math.min(WORLD_H - 24, sy)) };
            S.player.x = p.x;
            S.player.y = p.y;
            S._liveSpawn = { x: p.x, y: p.y };
          }
        }
        console.info('[MapLive] combat terrain', S.terrain?.length || 0, 'spawn', S._liveSpawn);
      }
    } catch (e) {
      console.warn('[MapLive] terrain refresh', e);
    }
    try {
      if (typeof applyLiveTownSpawn === 'function') applyLiveTownSpawn();
    } catch (e) {
      console.warn('[MapLive] town spawn', e);
    }

    const names = Object.values(pack.worlds).map((w) => w.name || w.id).join('、');
    toast(`地图已热更新：${names}`);
    console.info('[MapLive] applied', pack.updatedAt, pack);
  }

  function boot() {
    try {
      const bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (ev) => {
        if (ev?.data?.type === 'apply') applyHot();
      };
    } catch (_) {}

    window.addEventListener('storage', (ev) => {
      if (ev.key === KEY) applyHot();
    });
    window.addEventListener('xiandao-map-live', applyHot);

    window.MapEditorLive = {
      readPack,
      applyHot,
      key: KEY,
    };

    const pack = readPack();
    console.info(
      '[MapLive] ready',
      pack ? `pack@${pack.updatedAt}` : 'empty',
      'origin=',
      location.origin,
    );
  }

  setTimeout(boot, 0);
  setTimeout(boot, 300);
})();
