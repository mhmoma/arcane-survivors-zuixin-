(()=>{
'use strict';
function tagFx(f){
  if(!f||f.seqFx||f.beam||f.trail||f.prayer||f.setPlayer)return;
  let t=String(f.type||''),k=String(f.kind||''),life=f.max||f.life||0;
  if(t==='meteorRain'||/^meteorRainFx[1-4]$/.test(k)||t==='meteor')Object.assign(f,{type:'meteorImpact',seqFx:true,seqKind:'explosion'});
  else if(t==='daggerRain'||/^daggerRainFx[1-4]$/.test(k))Object.assign(f,{type:'daggerImpact',seqFx:true,seqKind:'puff'});
  else if(t==='fire'&&life<=.75)Object.assign(f,{type:'fireImpact',seqFx:true,seqKind:'explosion'});
  else if(t==='crystal'&&life<=.75)Object.assign(f,{type:'crystalImpact',seqFx:true,seqKind:'flash'});
  else if(t==='blood'&&life<=.75)Object.assign(f,{type:'bloodNovaBurst',seqFx:true,seqKind:'black'});
  else if((t==='lustSplash'||t==='lustOverflow')&&life<=.75)Object.assign(f,{type:'lustBurst',seqFx:true,seqKind:'flash'});
  else if((t==='poisonBurst'||t==='venomBurst')&&life<=.75)Object.assign(f,{seqFx:true,seqKind:'poison'});
  else if(t==='holy'&&life<=.45)Object.assign(f,{type:'holyFlash',seqFx:true,seqKind:'flash'});
}
function tagPart(p){
  if(!p||p.seqFx||p.txt||p.aspectRing)return;
  if(p.boom&&p.boomKind){p.seqFx=true;p.seqKind=p.boomKind}
}
function scan(){let s=window.S;if(!s?.run)return;for(const f of s.artFx||[])tagFx(f);for(const p of s.parts||[])tagPart(p)}
function patchUpdate(){let old=window.updateObjs;if(typeof old!=='function'||old._seqImpact)return setTimeout(patchUpdate,120);window.updateObjs=function(dt){let r=old.apply(this,arguments);scan();return r};window.updateObjs._seqImpact=true}
function patchBurst(){let old=window.burstAt;if(typeof old!=='function'||old._seqImpact)return setTimeout(patchBurst,120);window.burstAt=function(){let r=old.apply(this,arguments);scan();return r};window.burstAt._seqImpact=true}
function patchLight(){let old=window.lightBurstAt;if(typeof old!=='function'||old._seqImpact)return setTimeout(patchLight,120);window.lightBurstAt=function(){let r=old.apply(this,arguments);scan();return r};window.lightBurstAt._seqImpact=true}
patchUpdate();
patchBurst();
patchLight();
})();
