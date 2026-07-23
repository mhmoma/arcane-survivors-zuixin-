/**
 * 临时本地测试模式：无 Gamefy / 云端时用 localStorage 跑通启动与基础结算。
 * 开启：默认开启；关闭：URL 加 ?local=0
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('local') === '0') {
    console.info('[LocalTest] 已关闭（?local=0）');
    return;
  }

  window.__LOCAL_SAVE_TEST_MODE = true;
  window.__SAVE_MODE_CHOSEN = true;
  console.info('[LocalTest] 本地测试模式已开启');

  const META_KEY = 'arcane-meta-v3';
  const SEASON_KEY = 'arcane-season-state-v2';
  const RIFT_KEY = 'arcane-rift-v1';
  const KV_PREFIX = 'arcane-local-kv:';

  function lsGet(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }
  function lsPut(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function defaultMeta() {
    const classes = {};
    for (const c of ['paladin', 'mage', 'ranger', 'lewdSaintess', 'scytheMaiden', 'gunslinger']) {
      classes[c] = { upgrades: {}, unlocks: {} };
    }
    return { soulGold: 99999, soulCore: 999, grants: {}, classes, updatedAt: Date.now() };
  }

  function defaultSeason() {
    return {
      currentSeason: 1,
      started: { 1: true },
      seasons: { 1: { level: 1, xp: 0, totalXp: 0, startedAt: Date.now() } },
      updatedAt: Date.now(),
    };
  }

  function defaultRift() {
    return { keys: 9, maxLayer: 20, best: {}, dust: 0, grants: {}, customBuilds: {}, updatedAt: Date.now() };
  }

  async function syncGet(key, fallback) {
    if (window.StorageSync?.localGet) {
      const v = window.StorageSync.localGet(key);
      if (v != null) return v;
    }
    return lsGet(key) ?? fallback;
  }

  async function syncPut(key, value, label) {
    if (window.StorageSync?.put) return window.StorageSync.put(key, value, label || '本地');
    lsPut(key, value);
    return value;
  }

  function seasonNeed(lv) {
    return lv >= 20 ? 0 : Math.round(80 + lv * lv * 22 + lv * 38);
  }

  async function handleProgression(method, args = {}) {
    let meta = (await syncGet(META_KEY, null)) || defaultMeta();
    let season = (await syncGet(SEASON_KEY, null)) || defaultSeason();
    let rift = (await syncGet(RIFT_KEY, null)) || defaultRift();

    const saveAll = async () => {
      meta.updatedAt = Date.now();
      season.updatedAt = Date.now();
      rift.updatedAt = Date.now();
      await syncPut(META_KEY, meta, '永久强化');
      await syncPut(SEASON_KEY, season, '赛季');
      await syncPut(RIFT_KEY, rift, '秘境');
      return { ok: true, meta, season, rift };
    };

    if (method === 'init') return saveAll();

    if (method === 'runReward') {
      const gold =
        Math.floor(Number(args.gold) || 0) +
        Math.floor((Number(args.time) || 0) / 30) * 10 +
        Math.max(0, Number(args.bossKills) || 0) * 80 +
        (args.win ? 100 : 0);
      const core = Math.max(0, Math.floor(Number(args.bossKills) || 0)) + (args.win ? 2 : 0);
      meta.soulGold = Math.max(0, (meta.soulGold || 0) + gold);
      meta.soulCore = Math.max(0, (meta.soulCore || 0) + core);
      return saveAll();
    }

    if (method === 'runXp') {
      const cur = season.seasons?.[1] || { level: 1, xp: 0, totalXp: 0 };
      const gain = Math.max(12, Math.floor((Number(args.time) || 0) / 8) + Math.max(0, Number(args.bossKills) || 0) * 25);
      let ups = 0;
      cur.xp = Math.max(0, (cur.xp || 0) + gain);
      cur.totalXp = Math.max(0, (cur.totalXp || 0) + gain);
      cur.lastGain = gain;
      while ((cur.level || 1) < 20) {
        const need = seasonNeed(cur.level || 1);
        if (need <= 0 || cur.xp < need) break;
        cur.xp -= need;
        cur.level = (cur.level || 1) + 1;
        ups++;
      }
      cur.lastUps = ups;
      season.seasons = season.seasons || {};
      season.seasons[1] = cur;
      season.started = season.started || {};
      season.started[1] = true;
      return saveAll();
    }

    if (method === 'spend') {
      const g = Math.max(0, Math.floor(Number(args.gold) || 0));
      const c = Math.max(0, Math.floor(Number(args.core) || 0));
      if ((meta.soulGold || 0) < g || (meta.soulCore || 0) < c) {
        const e = new Error('货币不足');
        e.code = 'NO_CURRENCY';
        throw e;
      }
      meta.soulGold -= g;
      meta.soulCore -= c;
      return saveAll();
    }

    if (method === 'buyDlc') {
      const cls = args.classId || 'lewdSaintess';
      meta.classes = meta.classes || {};
      meta.classes[cls] = meta.classes[cls] || { upgrades: {}, unlocks: {} };
      if ((meta.soulCore || 0) < 200) {
        const e = new Error('魔核不足');
        e.code = 'NO_CORE';
        throw e;
      }
      meta.soulCore -= 200;
      meta.classes[cls].unlocks.dlc = true;
      return saveAll();
    }

    if (method === 'buyNode') {
      const cls = args.classId;
      const id = args.id;
      meta.classes = meta.classes || {};
      meta.classes[cls] = meta.classes[cls] || { upgrades: {}, unlocks: {} };
      const lv = Math.max(0, Math.floor(Number(meta.classes[cls].upgrades[id]) || 0));
      const price = Math.max(10, Math.round(50 * Math.pow(1.72, lv)));
      if ((meta.soulGold || 0) < price) {
        const e = new Error('灵魂金币不足');
        e.code = 'NO_GOLD';
        throw e;
      }
      meta.soulGold -= price;
      meta.classes[cls].upgrades[id] = lv + 1;
      meta.classes[cls].unlocks[id] = true;
      return saveAll();
    }

    if (method === 'shopBuy') {
      if (args.item === 'ticket') {
        if ((meta.soulGold || 0) < 120) {
          const e = new Error('金币不足');
          e.code = 'NO_GOLD';
          throw e;
        }
        meta.soulGold -= 120;
        rift.keys = Math.max(0, (rift.keys || 0) + 1);
        return saveAll();
      }
      if (args.item === 'costume' || args.item === 'sacrifice') {
        const cost = args.item === 'sacrifice' ? 200 : 150;
        if ((meta.soulGold || 0) < cost) {
          const e = new Error('金币不足');
          e.code = 'NO_GOLD';
          throw e;
        }
        meta.soulGold -= cost;
        return saveAll();
      }
      return saveAll();
    }

    if (method === 'startRift') {
      const layer = Math.max(1, Math.floor(Number(args.layer) || 1));
      if (layer > (rift.maxLayer || 1)) {
        const e = new Error('层数未解锁');
        e.code = 'RIFT_LOCKED';
        throw e;
      }
      if (layer >= 10) {
        if ((rift.keys || 0) < 1) {
          const e = new Error('秘境门票不足');
          e.code = 'NO_KEY';
          throw e;
        }
        rift.keys -= 1;
      }
      rift.activeRun = { token: 'local-' + Date.now(), layer, startedAt: Date.now() };
      return saveAll();
    }

    if (method === 'finishRift') {
      const win = args.win === true;
      const layer = Math.max(1, Math.floor(Number(args.layer) || rift.activeRun?.layer || 1));
      if (win) {
        rift.maxLayer = Math.max(rift.maxLayer || 1, Math.min(150, layer + 10));
        rift.dust = Math.max(0, (rift.dust || 0) + Math.round(8 + layer * 1.65));
        if (layer >= 10 && Math.random() < 0.3) rift.keys = (rift.keys || 0) + 1;
      }
      delete rift.activeRun;
      return saveAll();
    }

    return saveAll();
  }

  const d = (window.dzmm = window.dzmm || {});
  d.loading = d.loading || {
    progress() {},
    ready() {},
    error() {},
  };
  d.toast = d.toast || {
    warning(m) {
      console.warn('[LocalTest]', m);
    },
    info(m) {
      console.info('[LocalTest]', m);
    },
  };
  d.kv = {
    async get(key) {
      try {
        const raw = localStorage.getItem(KV_PREFIX + key);
        return { value: raw ? JSON.parse(raw) : null };
      } catch (_) {
        return { value: null };
      }
    },
    async put(key, value) {
      localStorage.setItem(KV_PREFIX + key, JSON.stringify(value));
      return { ok: true };
    },
    async delete(key) {
      localStorage.removeItem(KV_PREFIX + key);
    },
  };
  d.fn = {
    async invoke(name, body = {}) {
      if (name === 'progression') return handleProgression(body.method, body.args || {});
      const e = new Error('本地测试模式不支持云函数: ' + name);
      e.code = 'LOCAL_TEST_UNSUPPORTED';
      throw e;
    },
  };

  // Seed starter data once so season intro can be skipped on refresh if desired
  if (!lsGet(META_KEY)) lsPut(META_KEY, defaultMeta());
  if (!lsGet(SEASON_KEY)) lsPut(SEASON_KEY, defaultSeason());
  if (!lsGet(RIFT_KEY)) lsPut(RIFT_KEY, defaultRift());

  const paint = () => {
    if (document.getElementById('localTestBanner')) return;
    const el = document.createElement('div');
    el.id = 'localTestBanner';
    el.textContent = '本地测试模式 · 无云端';
    el.style.cssText =
      'position:fixed;left:8px;top:8px;z-index:9999;padding:4px 10px;border-radius:8px;background:rgba(180,80,20,.88);color:#ffe8a3;font:700 12px/1.2 sans-serif;pointer-events:none;text-shadow:0 1px 2px #000';
    (document.body || document.documentElement).appendChild(el);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint);
  else paint();
})();
