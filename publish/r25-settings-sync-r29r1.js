(() => {
  'use strict';
  const PATCH = '20260723-combat-fps-v3';
  const KEY = 'arcane-settings-v3';
  const FX = new Set(['off', 'low', 'medium', 'high']);
  const FPS = new Set(['60', '120', '140', '160', 'unlimited']);
  const DMG = new Set(['none', 'all', 'crit', 'normal', 'topAll', 'topNormal', 'topCrit']);
  const MODE = new Set(['smooth', 'balanced', 'quality', 'custom']);
  const PRESETS = {
    smooth: { fxQuality: 'low', combatFps: '60', dmgNumberMode: 'topAll' },
    balanced: { fxQuality: 'medium', combatFps: '120', dmgNumberMode: 'topAll' },
    quality: { fxQuality: 'high', combatFps: 'unlimited', dmgNumberMode: 'all' }
  };
  let state, saveTimer = 0, dirtySince = 0, gen = 0;

  function $(id) { return document.getElementById(id); }
  function clampInt(v, def, lo, hi) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  }
  function pick(v, def, set) { return set.has(v) ? v : def; }
  function ls(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }

  function normalize(raw = {}) {
    const fx = pick(raw.fxQuality, 'low', FX);
    const fps = pick(String(raw.combatFps ?? '60'), '60', FPS);
    const dmg = pick(raw.dmgNumberMode, 'topAll', DMG);
    const matched = Object.entries(PRESETS).find(([, p]) =>
      p.fxQuality === fx && p.combatFps === fps && p.dmgNumberMode === dmg
    )?.[0] || 'custom';
    return {
      version: 3,
      performanceMode: pick(raw.performanceMode, matched, MODE),
      bgmVolume: clampInt(raw.bgmVolume, 42, 0, 100),
      sfxVolume: clampInt(raw.sfxVolume, 72, 0, 100),
      portraitView: clampInt(raw.portraitView, 80, 60, 120),
      landscapeView: clampInt(raw.landscapeView, 78, 60, 120),
      fxQuality: fx,
      combatFps: fps,
      dmgNumberMode: dmg
    };
  }

  function choice(id, title, nodes, tip) {
    const box = document.createElement('div');
    box.className = 'choice settingsChoice';
    box.id = `${id}Setting`;
    const h = document.createElement('h2');
    h.textContent = title;
    const p = document.createElement('p');
    p.append(...nodes);
    box.append(h, p);
    if (tip) {
      const s = document.createElement('small');
      s.textContent = tip;
      box.append(s);
    }
    return box;
  }
  function opt(v, t) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = t;
    return o;
  }

  function applySfx() {
    const v = clampInt($('sfxVolume')?.value, state?.sfxVolume ?? 72, 0, 100);
    window.sfxVolume = v;
    if (window.audio?.fx?.gain) window.audio.fx.gain.value = 0.42 * v / 100;
    if ($('sfxVolumeTxt')) $('sfxVolumeTxt').textContent = `${v}%`;
  }

  function modeTxt() {
    const map = { smooth: '低负载', balanced: '推荐', quality: '高性能设备', custom: '手动配置' };
    if ($('performanceModeTxt')) $('performanceModeTxt').textContent = map[state.performanceMode];
  }

  function applyState(raw) {
    state = normalize(raw);
    const fields = {
      performanceMode: state.performanceMode,
      bgmVolume: state.bgmVolume,
      sfxVolume: state.sfxVolume,
      portraitView: state.portraitView,
      landscapeView: state.landscapeView,
      fxQuality: state.fxQuality,
      combatFps: state.combatFps,
      dmgNumberMode: state.dmgNumberMode
    };
    for (const [k, v] of Object.entries(fields)) if ($(k)) $(k).value = v;
    window.fxQuality = state.fxQuality;
    window.combatFps = state.combatFps;
    window.dmgNumberMode = state.dmgNumberMode;
    window.performanceMode = state.performanceMode;
    window.__ARCANE_SETTINGS_SYNC = PATCH;
    try {
      window.applyBgmVol?.();
      window.applyCombatFps?.(true);
      window.applyFxQuality?.(true);
      window.applyDmgNumberMode?.(true);
      window.applyViewSettings?.(true);
      applySfx();
    } catch (e) {
      console.warn('设置应用失败:', e.message, e.stack);
    }
    modeTxt();
  }

  function readUi() {
    return normalize({
      performanceMode: $('performanceMode')?.value,
      bgmVolume: $('bgmVolume')?.value,
      sfxVolume: $('sfxVolume')?.value,
      portraitView: $('portraitView')?.value,
      landscapeView: $('landscapeView')?.value,
      fxQuality: $('fxQuality')?.value,
      combatFps: $('combatFps')?.value,
      dmgNumberMode: $('dmgNumberMode')?.value
    });
  }

  async function flush() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    dirtySince = 0;
    state = readUi();
    try {
      await (window.StorageSync?.put(KEY, state, '设置'));
    } catch (e) {
      console.warn('设置保存失败:', e.code, e.message, e.stack);
    }
  }

  function schedule() {
    gen += 1;
    if (!dirtySince) dirtySince = Date.now();
    clearTimeout(saveTimer);
    const waited = Date.now() - dirtySince;
    saveTimer = setTimeout(flush, waited >= 5500 ? 0 : 900);
  }

  function markCustom() {
    if (!state) return;
    state.performanceMode = 'custom';
    if ($('performanceMode')) $('performanceMode').value = 'custom';
    modeTxt();
  }

  function bind() {
    $('performanceMode')?.addEventListener('change', (e) => {
      const mode = pick(e.target.value, 'smooth', MODE);
      if (mode === 'custom') {
        state.performanceMode = mode;
        modeTxt();
        schedule();
        return;
      }
      const p = PRESETS[mode];
      if (!p) return;
      state.performanceMode = mode;
      $('fxQuality').value = p.fxQuality;
      if ($('combatFps')) $('combatFps').value = p.combatFps;
      $('dmgNumberMode').value = p.dmgNumberMode;
      window.applyCombatFps?.(true);
      window.applyFxQuality?.(true);
      window.applyDmgNumberMode?.(true);
      state = readUi();
      modeTxt();
      schedule();
    });
    for (const id of ['bgmVolume', 'sfxVolume', 'portraitView', 'landscapeView']) {
      $(id)?.addEventListener('input', () => {
        if (id === 'bgmVolume') window.applyBgmVol?.();
        if (id === 'sfxVolume') applySfx();
        state = readUi();
        schedule();
      });
    }
    for (const id of ['fxQuality', 'combatFps', 'dmgNumberMode']) {
      $(id)?.addEventListener('change', () => {
        markCustom();
        if (id === 'fxQuality') window.applyFxQuality?.(true);
        if (id === 'combatFps') window.applyCombatFps?.(true);
        if (id === 'dmgNumberMode') window.applyDmgNumberMode?.(true);
        state = readUi();
        schedule();
      });
    }
  }

  function ensureUiShell() {
    const panel = document.querySelector('#settings .panel');
    const first = panel?.querySelector('.choice');
    if (!panel || !first || $('performanceMode')) return;
    panel.classList.add('settingsPanelLatest');
    panel.querySelector('.title').textContent = '仙途设置';
    panel.querySelector(':scope > .sub').textContent = '调整性能方案、战斗帧率、灵效品质、仙乐音量与界面布局。';

    const modeSel = document.createElement('select');
    modeSel.id = 'performanceMode';
    modeSel.className = 'nameBox';
    modeSel.append(
      opt('smooth', '流畅优先'),
      opt('balanced', '均衡画质'),
      opt('quality', '极致灵效'),
      opt('custom', '自定义')
    );
    const modeB = document.createElement('b');
    modeB.id = 'performanceModeTxt';
    first.before(choice('performanceMode', '性能方案', [modeSel, modeB],
      '流畅优先=60帧+低灵效；均衡=120帧；极致=无限制帧率+完整灵效。'));

    const sfx = document.createElement('input');
    sfx.id = 'sfxVolume';
    sfx.type = 'range';
    sfx.min = '0';
    sfx.max = '100';
    sfx.value = '72';
    const sfxB = document.createElement('b');
    sfxB.id = 'sfxVolumeTxt';
    first.after(choice('sfxVolume', '战斗音效', [sfx, sfxB], '只调整技能、命中和界面反馈音，不影响仙乐。'));

    const titles = [
      ['bgmVolume', '仙乐音量'],
      ['combatFps', '战斗帧率'],
      ['portraitView', '竖屏视野'],
      ['landscapeView', '横屏视野'],
      ['fxQuality', '灵效品质'],
      ['dmgNumberMode', '伤害显字'],
      ['layoutBtn', '战斗界面布局']
    ];
    for (const [id, title] of titles) {
      const h = $(id)?.closest('.choice')?.querySelector('h2');
      if (h) h.textContent = title;
    }
    const close = $('settingsClose');
    if (close) close.textContent = '返回仙途';
  }

  async function boot() {
    ensureUiShell();
    const local = window.StorageSync?.localGet?.(KEY);
    applyState(local || normalize({
      bgmVolume: ls('bgmVolume'),
      portraitView: ls('portraitView'),
      landscapeView: ls('landscapeView'),
      fxQuality: ls('fxQuality'),
      combatFps: ls('combatFps'),
      dmgNumberMode: ls('dmgNumberMode')
    }));
    bind();
    const g = gen;
    try {
      const remote = await (window.StorageSync?.get?.(KEY));
      if (remote && gen === g) applyState(remote);
      if (!remote && gen === g) await (window.StorageSync?.put?.(KEY, state, '设置'));
    } catch (e) {
      console.warn('网络设置读取失败，继续使用当前设置:', e.code, e.message);
    }
    console.info('设置同步补丁已启用:', PATCH, 'mode=', state.performanceMode, 'fps=', state.combatFps, 'fx=', state.fxQuality);
  }

  const prevInit = window.initAudio;
  if (typeof prevInit === 'function') {
    window.initAudio = function () {
      const r = prevInit.apply(this, arguments);
      applySfx();
      return r;
    };
  }
  window.syncArcaneSettings = boot;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
