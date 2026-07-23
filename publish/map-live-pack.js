/**
 * 地图 live 包读取：localStorage（编辑器热更）> 烘焙 live-pack.json > null
 */
(function (global) {
  const LS_KEY = 'xiandao-map-live-v1';
  const BAKED_URL = './assets/maps/live-pack.json';
  let bakedPack = null;
  let bakedPromise = null;
  let bakedTried = false;

  function parseLs() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function packHasWorlds(p) {
    return !!(p && p.worlds && typeof p.worlds === 'object' && Object.keys(p.worlds).length);
  }

  /** 同步：localStorage 仅当比烘焙包更新时覆盖（方便编辑器热更） */
  function readMapLivePack() {
    const ls = parseLs();
    const baked = bakedPack;
    const lsOk = packHasWorlds(ls);
    const bakedOk = packHasWorlds(baked);
    if (lsOk && bakedOk) {
      const lsAt = String(ls.updatedAt || '');
      const bakedAt = String(baked.bakedAt || baked.updatedAt || '');
      return lsAt > bakedAt ? ls : baked;
    }
    if (lsOk) return ls;
    if (bakedOk) return baked;
    return null;
  }

  function loadBakedMapPack() {
    if (bakedTried && bakedPromise) return bakedPromise;
    bakedTried = true;
    bakedPromise = fetch(BAKED_URL + '?v=' + Date.now(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (packHasWorlds(p)) {
          bakedPack = p;
          console.info('[MapPack] baked loaded', Object.keys(p.worlds), p.bakedAt || '');
        } else {
          console.info('[MapPack] no baked pack');
        }
        return bakedPack;
      })
      .catch((e) => {
        console.warn('[MapPack] bake fetch fail', e?.message || e);
        return null;
      });
    return bakedPromise;
  }

  // 启动即拉烘焙包（不阻塞；开城镇/开战前再 await）
  try {
    loadBakedMapPack();
  } catch (_) {}

  global.MapLivePack = {
    KEY: LS_KEY,
    read: readMapLivePack,
    loadBaked: loadBakedMapPack,
    getBaked: () => bakedPack,
  };
})(window);
