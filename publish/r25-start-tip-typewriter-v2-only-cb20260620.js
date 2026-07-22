window.GameModules = window.GameModules || {};
window.GameModules.startTipTypewriter = (() => {
  const TIP = '温馨提示：请多使用主动存档槽保存进度；发现 Bug 或有建议请及时私聊作者反馈；喜欢本游戏的话，欢迎点赞收藏支持更新。';
  let typing = false, runId = 0, lastVisible = false;

  function ensureStyle() {
    if (document.getElementById('startTipTypewriterStyle')) return;
    const style = document.createElement('style');
    style.id = 'startTipTypewriterStyle';
    style.textContent = `.startTypeTip{min-height:42px;margin:0 0 10px;padding:8px 12px;border:1px solid rgba(250,204,21,.34);border-radius:12px;background:rgba(5,8,18,.36);color:#ffe9a8;font-size:13px;line-height:1.45;text-shadow:0 2px 4px #000,0 0 10px rgba(250,204,21,.28);letter-spacing:.03em}.startTypeTip:after{content:'|';display:inline-block;margin-left:2px;color:#facc15;animation:startTipCaret .75s step-end infinite}@keyframes startTipCaret{50%{opacity:0}}@media (orientation:portrait){.startTypeTip{font-size:12px;min-height:54px;padding:7px 10px}}`;
    document.head.appendChild(style);
  }
  function ensureStartUi() {
    ensureStyle();
    const menu = document.querySelector('#start .coverMenu');
    if (!menu) return null;
    let tip = document.getElementById('startTypeTip');
    if (!tip) {
      tip = document.createElement('p');
      tip.id = 'startTypeTip';
      tip.className = 'startTypeTip';
      menu.insertBefore(tip, menu.firstChild);
    }
    return tip;
  }
  function startVisible() {
    const el = document.getElementById('start');
    return !!(el && !el.classList.contains('hidden'));
  }
  async function play() {
    const el = ensureStartUi();
    if (!el || typing) return;
    typing = true;
    const id = ++runId;
    el.textContent = '';
    for (let i = 0; i < TIP.length; i++) {
      if (id !== runId || !startVisible()) break;
      el.textContent += TIP[i];
      await new Promise(r => setTimeout(r, /[；。]/.test(TIP[i]) ? 180 : 34));
    }
    typing = false;
  }
  function check() {
    const visible = startVisible();
    if (visible && !lastVisible) play();
    if (!visible) runId++;
    lastVisible = visible;
  }
  function bind() {
    ensureStartUi();
    check();
    const start = document.getElementById('start');
    if (start && !start.__tipObserver) {
      new MutationObserver(check).observe(start, { attributes: true, attributeFilter: ['class'] });
      start.__tipObserver = true;
    }
    if (!document.__startTipCheckBound) {
      document.addEventListener('click', () => setTimeout(check, 40));
      document.__startTipCheckBound = true;
    }
  }
  return { bind, play };
})();
window.addEventListener('load', () => window.GameModules.startTipTypewriter?.bind?.());
setTimeout(() => window.GameModules.startTipTypewriter?.bind?.(), 0);
