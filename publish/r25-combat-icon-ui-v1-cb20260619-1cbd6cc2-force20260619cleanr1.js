(function(){
'use strict';
const iconBase='./assets/generated/ui/';
const labels={
  saveBtn:['ui-icon-save.f5e79e61-prodrefresh20260619.webp','存档'],
  settingsBtn:['ui-icon-settings.1fc5ebcc-prodrefresh20260619.webp','设置'],
  relicBtn:['ui-icon-relic.efa3b5f9-prodrefresh20260619.webp','神器'],
  skillBtn:['ui-icon-skill.e2db75b9-prodrefresh20260619.webp','技能'],
  invBtn:['ui-icon-bag.03c04b3e-prodrefresh20260619.webp','背包']
};
const combatIds=['modeBtn','skillBtn','relicBtn','invBtn','saveBtn','settingsBtn','controls'];
let collapsed=false,tipTimer=0,overlayWatcher=null;
function iconButton(btn,file,label){
  if(!btn)return;
  btn.dataset.iconUi='1';
  btn.dataset.label=label;
  btn.classList.add('combatIconButton');
  btn.setAttribute('aria-label',label);
  btn.title=label;
  if(!btn.querySelector('.combatIcon')){
    btn.innerHTML=`<img class="combatIcon" src="${iconBase}${file}" alt=""><span class="combatIconText">${label}</span>`;
  }
}
function iconize(){
  for(const [id,[file,label]] of Object.entries(labels))iconButton(document.getElementById(id),file,label);
  document.getElementById('equipBtn')?.classList.add('hidden');
  placeModeButton();
  iconizeMode();
  ensureResourceBar();
  ensureToggle();
  applyHudState();
  syncCombatChrome();
}
function placeModeButton(){
  const mode=document.getElementById('modeBtn'),game=document.querySelector('.game');
  if(mode&&game&&mode.parentElement!==game)game.appendChild(mode);
}
function overlayOpen(){
  return Array.from(document.querySelectorAll('.overlay,.layoutEditor')).some(x=>!x.classList.contains('hidden'));
}
function syncCombatChrome(){
  const open=overlayOpen(),active=!!window.S?.run&&!open;
  combatIds.forEach(id=>document.getElementById(id)?.classList.toggle('combatUiSuppressed',!active));
  document.getElementById('hudFoldBtn')?.classList.toggle('hidden',!window.S?.run||open);
}
function modeLabel(){
  if(!window.control)return '手动';
  const styles=['均衡','保守','激进'];
  return control.auto?`自动${styles[control.style%3]||'均衡'}`:'手动';
}
function iconizeMode(){
  placeModeButton();
  const mode=document.getElementById('modeBtn');
  if(!mode)return;
  mode.dataset.iconUi='1';
  mode.classList.toggle('hidden',!window.S?.run);
  mode.classList.toggle('active',!!window.control?.auto);
  mode.classList.add('combatIconButton');
  mode.setAttribute('aria-label','自动战斗模式');
  mode.title='自动战斗';
  mode.innerHTML=`<img class="combatIcon" src="${iconBase}ui-icon-auto.9419fb98-prodrefresh20260619.webp" alt=""><span class="combatIconText">${modeLabel()}</span>`;
  if(!mode.dataset.modeTipBound){
    mode.dataset.modeTipBound='1';
    mode.addEventListener('click',()=>setTimeout(()=>{iconizeMode();showModeTip();},40),true);
  }
  syncCombatChrome();
}
function ensureResourceBar(){
  const hud=document.querySelector('.hud'),hp=document.getElementById('hudHp');
  if(!hud||document.getElementById('hudResource'))return;
  const bar=document.createElement('div');
  bar.id='hudResource';
  bar.className='bar resourceBar';
  bar.innerHTML='<label><span id="resLabel">职业资源</span><span id="resTxt">0/100</span></label><div class="track"><div id="resFill" class="fill resfill"></div></div>';
  hp?.after(bar);
  updateResourceBar();
}
function ensureToggle(){
  const game=document.querySelector('.game');
  if(!game||document.getElementById('hudFoldBtn'))return;
  const btn=document.createElement('button');
  btn.id='hudFoldBtn';
  btn.className='hudFoldBtn hidden';
  btn.type='button';
  btn.textContent='▾';
  btn.setAttribute('aria-label','折叠状态栏');
  btn.onclick=()=>{collapsed=!collapsed;applyHudState();};
  game.appendChild(btn);
}
function setHudLabel(id,foldText,fullText){
  const span=document.querySelector(`#${id} label span:first-child`);
  if(span)span.textContent=collapsed?foldText:fullText;
}
function applyHudState(){
  const hud=document.querySelector('.hud'),btn=document.getElementById('hudFoldBtn');
  if(!hud||!btn)return;
  hud.classList.toggle('hudCollapsed',collapsed);
  btn.classList.toggle('folded',collapsed);
  btn.textContent=collapsed?'▸':'▾';
  btn.setAttribute('aria-label',collapsed?'展开状态栏':'折叠状态栏');
  setHudLabel('hudHp','血量','生命');
  setHudLabel('hudBoss','Boss','下个魔王');
  updateResourceBar();
  syncCombatChrome();
}
function resourceInfo(){
  if(!window.S?.player)return null;
  const p=S.player,cls=p.cls;
  if(cls==='lewdSaintess')return ['淫荡值',S.lust||0,S.lustMax||100];
  if(cls==='scytheMaiden')return ['冥契',S.reaperCharge||0,100];
  if(cls==='mage')return ['奥术回响',S.arcaneEcho||0,100];
  if(cls==='paladin')return ['圣怒',S.holyRage||0,100];
  if(cls==='ranger')return ['猎杀动能',S.huntCharge||0,100];
  return null;
}
function updateResourceBar(){
  const bar=document.getElementById('hudResource'),label=document.getElementById('resLabel'),txt=document.getElementById('resTxt'),fill=document.getElementById('resFill');
  if(!bar||!label||!txt||!fill)return;
  const info=resourceInfo();
  bar.classList.toggle('hidden',!info);
  if(!info)return;
  const [name,cur,max]=info,now=Math.max(0,Math.floor(cur)),cap=Math.max(1,Math.floor(max));
  const short={淫荡值:'淫荡',猎杀动能:'动能',奥术回响:'奥术'};
  label.textContent=collapsed?(short[name]||name):name;
  txt.textContent=`${now}/${cap}`;
  fill.style.width=`${Math.max(0,Math.min(100,now/cap*100))}%`;
}
function showModeTip(){
  const mode=document.getElementById('modeBtn');
  if(!mode||overlayOpen())return;
  let box=document.getElementById('modeTip');
  if(!box){
    box=document.createElement('div');
    box.id='modeTip';
    box.className='modeTip';
    document.querySelector('.game')?.appendChild(box);
  }
  box.textContent=`自动战斗：${modeLabel()}`;
  box.classList.add('show');
  clearTimeout(tipTimer);
  tipTimer=setTimeout(()=>box.classList.remove('show'),1400);
}
function patchModeLabel(){
  if(window.updateModeLabel?.__iconPatched)return;
  const base=window.updateModeLabel;
  if(typeof base==='function'){
    window.updateModeLabel=function(){base();iconizeMode();};
    window.updateModeLabel.__iconPatched=true;
  }
}
function patchHudUpdate(){
  if(window.updateHud?.__iconPatched)return;
  const base=window.updateHud;
  if(typeof base==='function'){
    window.updateHud=function(){base();iconizeMode();ensureResourceBar();updateResourceBar();document.getElementById('equipBtn')?.classList.add('hidden');syncCombatChrome();};
    window.updateHud.__iconPatched=true;
  }
}
function patchRestart(){
  if(window.restart?.__iconPatched)return;
  const base=window.restart;
  if(typeof base==='function'){
    window.restart=function(){base();document.getElementById('modeBtn')?.classList.add('hidden');syncCombatChrome();};
    window.restart.__iconPatched=true;
  }
}
function watchOverlays(){
  if(overlayWatcher)return;
  overlayWatcher=new MutationObserver(syncCombatChrome);
  document.querySelectorAll('.overlay,.layoutEditor').forEach(x=>overlayWatcher.observe(x,{attributes:true,attributeFilter:['class']}));
}
document.addEventListener('DOMContentLoaded',()=>{iconize();patchModeLabel();patchHudUpdate();patchRestart();watchOverlays();});
iconize();
patchModeLabel();
patchHudUpdate();
patchRestart();
watchOverlays();
})();
