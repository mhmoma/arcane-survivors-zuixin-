(()=>{
'use strict';
const VERSION='20260629-cache-refresh-r1',FX=new Set(['off','low','medium','high']),DMG=new Set(['none','all','crit','normal','topAll','topNormal','topCrit']);
function get(k){try{return localStorage.getItem(k)}catch(_){return null}}
function set(k,v){try{localStorage.setItem(k,String(v))}catch(_){}}
function num(k,def,min,max){let v=Number(get(k));if(!Number.isFinite(v))v=def;v=Math.max(min,Math.min(max,Math.round(v)));set(k,v);return v}
function choice(k,def,ok){let v=get(k)||window[k]||def;if(!ok.has(v))v=def;set(k,v);window[k]=v;return v}
function syncSettings(){
  let fx=choice('fxQuality','low',FX),dmg=choice('dmgNumberMode','topAll',DMG);
  num('portraitView',80,60,120);num('landscapeView',78,60,120);num('bgmVolume',42,0,100);
  window.fxQuality=fx;window.dmgNumberMode=dmg;window.__ARCANE_SETTINGS_SYNC=VERSION;
  if(typeof applyFxQuality==='function')try{applyFxQuality(false)}catch(e){console.warn('特效档位同步失败:',e.message,e.stack)}
  if(typeof applyDmgNumberMode==='function')try{applyDmgNumberMode(false)}catch(e){console.warn('伤害数字设置同步失败:',e.message,e.stack)}
  if(typeof applyViewSettings==='function')try{applyViewSettings(false)}catch(e){console.warn('视野设置同步失败:',e.message,e.stack)}
  if(typeof applyBgmVol==='function')try{applyBgmVol()}catch(e){console.warn('音量设置同步失败:',e.message,e.stack)}
  console.info('设置同步补丁已启用:',VERSION,'fx=',fx,'dmg=',dmg)
}
window.syncArcaneSettings=syncSettings;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncSettings,{once:true});else syncSettings();
})();
