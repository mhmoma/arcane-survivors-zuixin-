(()=>{
'use strict';
const KEY='joyMode';
let followHome=null,followPtr=null,bound=false;

function $(id){return document.getElementById(id)}
function mode(){
  let m=window.joyMode||localStorage.getItem(KEY)||'fixed';
  return m==='follow'?'follow':'fixed';
}
function saveMode(v){
  v=v==='follow'?'follow':'fixed';
  window.joyMode=v;
  try{localStorage.setItem(KEY,v)}catch(_){}
  applyModeUi();
  return v;
}
function applyModeUi(){
  let el=$('joyMode'),txt=$('joyModeTxt'),v=mode();
  if(el)el.value=v;
  if(txt)txt.textContent=v==='follow'?'跟随手指（左半屏）':'固定位置';
  document.documentElement.dataset.joyMode=v;
  let c=$('controls');
  if(c)c.classList.toggle('joyFollow',v==='follow');
  if(v==='fixed')restoreHome();
}
function joyEl(){return $('controls')||$('joy')}
function captureHome(){
  let el=joyEl();if(!el)return;
  let r=el.getBoundingClientRect();
  followHome={x:r.left,y:r.top,w:r.width,h:r.height};
}
function restoreHome(){
  let el=joyEl();if(!el)return;
  el.classList.remove('joyFloating');
  el.style.opacity='';
  // keep custom layout left/top if present; otherwise clear float offsets
  if(!el.classList.contains('customPlaced')){
    el.style.left='';
    el.style.top='';
  }else if(followHome&&Number.isFinite(followHome.x)){
    el.style.left=followHome.x+'px';
    el.style.top=followHome.y+'px';
  }
  if(typeof moveStick==='function')moveStick(0,0);
}
function placeAt(clientX,clientY){
  let el=joyEl();if(!el)return;
  let w=el.offsetWidth||104,h=el.offsetHeight||104;
  let maxX=Math.max(0,innerWidth*0.5-w);
  let x=Math.max(0,Math.min(maxX,clientX-w/2));
  let y=Math.max(0,Math.min(Math.max(0,innerHeight-h),clientY-h/2));
  el.classList.add('customPlaced','joyFloating');
  el.style.left=x+'px';
  el.style.top=y+'px';
  el.style.opacity='1';
}
function isUiBlocker(t){
  return !!(t&&t.closest&&t.closest('button,.overlay,.layoutEditor,.layoutToolbar,.pill,.bar,.hudFoldBtn,#modeTip,#notice,#bossWarn'));
}
function leftHalf(x){return x<=innerWidth*0.5}
function onDown(e){
  if(mode()!=='follow')return;
  if(!window.S?.run||window.S?.paused||window.S?.over||window.layoutEdit)return;
  if(e.button!=null&&e.button!==0)return;
  if(followPtr!=null)return;
  if(!leftHalf(e.clientX))return;
  if(isUiBlocker(e.target))return;
  // allow starting on joy itself or empty left area
  let onJoy=!!(e.target.closest&&e.target.closest('#controls,#joy,.joystick,.stick'));
  if(!onJoy&&e.target!==document.body&&e.target!==$('c')&&!(e.target.closest&&e.target.closest('.game'))){
    // only canvas / game background
    if(!(e.target.id==='c'||e.target.classList?.contains('game')))return;
  }
  if(window.control?.auto&&typeof setMode==='function')setMode(false);
  if(!followHome)captureHome();
  followPtr=e.pointerId;
  placeAt(e.clientX,e.clientY);
  window.control.active=true;
  try{$('joy')?.setPointerCapture?.(e.pointerId)}catch(_){}
  if(typeof joyMove==='function')joyMove(e);
  e.preventDefault();
  e.stopPropagation();
}
function onMove(e){
  if(mode()!=='follow'||followPtr!==e.pointerId)return;
  if(window.control?.active&&typeof joyMove==='function')joyMove(e);
}
function onUp(e){
  if(followPtr!==e.pointerId&&followPtr!=null)return;
  if(followPtr==null&&mode()!=='follow')return;
  followPtr=null;
  if(window.control){control.active=false;control.x=0;control.y=0}
  if(typeof moveStick==='function')moveStick(0,0);
  // follow: return to layout home as dim ghost until next left-half press
  if(mode()==='follow'){
    restoreHome();
    let el=joyEl();
    if(el){el.classList.add('joyFloating');el.style.opacity='0.28'}
  }
}
function bind(){
  if(bound)return;bound=true;
  let game=document.querySelector('.game')||document;
  game.addEventListener('pointerdown',onDown,{passive:false,capture:true});
  window.addEventListener('pointermove',onMove,{passive:true});
  window.addEventListener('pointerup',onUp,{passive:true});
  window.addEventListener('pointercancel',onUp,{passive:true});
  window.addEventListener('resize',()=>{followHome=null;if(mode()==='fixed')restoreHome()});
}
function hookSettings(){
  let el=$('joyMode');
  if(el&&!el.dataset.bound){
    el.dataset.bound='1';
    el.onchange=()=>saveMode(el.value);
  }
  applyModeUi();
}
function patchApplyLayout(){
  if(typeof window.applyLayout!=='function'||window.applyLayout.__joyPatched)return;
  let base=window.applyLayout;
  window.applyLayout=function(){
    base();
    captureHome();
    if(mode()==='follow'){
      let el=joyEl();
      if(el&&!control?.active){el.classList.add('joyFloating');el.style.opacity='0.22'}
    }
  };
  window.applyLayout.__joyPatched=true;
}

window.joyMode=mode();
window.applyJoyMode=applyModeUi;
window.setJoyMode=saveMode;
document.addEventListener('DOMContentLoaded',()=>{hookSettings();bind();patchApplyLayout();captureHome()});
hookSettings();bind();patchApplyLayout();
setTimeout(()=>{hookSettings();patchApplyLayout();captureHome()},200);
})();
