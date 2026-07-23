(function(){
'use strict';
const CFG={wind:{size:132,hit:42},moonSlash:{size:158,hit:52}};
const baseCast=window.castProjectile;
const baseVolley=window.volley;
const baseDrawSheet=window.drawSheet;
const baseFallingAttack=window.fallingAttack;
const baseBurstAt=window.burstAt;
if(window.imgs?.wind&&!imgs.windFlipped)imgs.windFlipped=imgs.wind;
if(window.INFO?.daggerRain)INFO.daggerRain[1]='指定区域落下匕首雨造成范围伤害。升级：匕首雨帧数、范围和伤害提升。';
if(window.INFO?.meteorShard)INFO.meteorShard[1]='指定区域落下陨星雨造成范围爆炸。升级：陨星帧数、范围和伤害提升。';
if(window.EVOLUTIONS?.prismFinale)EVOLUTIONS.prismFinale.desc='奥术射线进化为持续旋转的棱镜束，围绕角色扫动并持续伤害敌人；联动魔法飞弹与星界飞弹套强化奥术弹幕。';
function isBlade(k){return k==='wind'||k==='moonSlash'}
function ensureWindFlip(){
  let src=window.imgs?.wind;if(!src?.complete)return;
  imgs.windFlipped=src;imgs._windFlipReady=true;
}
function drawMirroredSheet(img,x,y,size,frame,rot=0,sx=1,sy=1,a=1){
  if(!img?.complete)return;let fw=img.width/2,fh=img.height/2;
  ctx.save();ctx.globalAlpha=a;ctx.translate(x,y);ctx.rotate(rot);ctx.scale(-sx,sy);
  ctx.drawImage(img,frame%2*fw,Math.floor(frame/2)*fh,fw,fh,-size/2,-size/2,size,size);ctx.restore();
}
function ensureFrameAliases(srcKey,prefix,prop){
  let src=imgs?.[srcKey];if(!src?.src)return;
  for(let i=1;i<=4;i++){let k=prefix+i;if(imgs[k])continue;let im=new Image();im[prop]=i;im.src=src.currentSrc||src.src;imgs[k]=im}
}
function ensureDaggerFrames(){ensureFrameAliases('dagger','daggerRainFx','_daggerFrame')}
function ensureMeteorFrames(){ensureFrameAliases('meteor','meteorRainFx','_meteorFrame')}
function ensureVoidFrames(){ensureFrameAliases('voidRift','voidRiftFixedFx','_voidFrame')}
function daggerKind(frames){ensureDaggerFrames();let k='daggerRainFx'+frames;return imgs[k]?k:'dagger'}
function meteorKind(frames){ensureMeteorFrames();let k='meteorRainFx'+frames;return imgs[k]?k:'meteor'}
function voidKind(frame){ensureVoidFrames();let k='voidRiftFixedFx'+frame;return imgs[k]?k:'voidRift'}
function isDaggerKind(k){return k==='dagger'||/^daggerRainFx[1-4]$/.test(k)}
function isMeteorKind(k){return k==='meteor'||/^meteorRainFx[1-4]$/.test(k)}
function isVoidFixedKind(k){return /^voidRiftFixedFx[1-4]$/.test(k)}
function drawFrameAlias(img,srcKey,frame,size,x,y,a=1){
  let src=img.complete?img:imgs[srcKey],fw=src.width/2,fh=src.height/2,ratio=fh/fw,w=size,h=size*ratio;
  if(!src?.complete)return;ctx.save();ctx.globalAlpha=a;ctx.translate(x,y);ctx.drawImage(src,frame%2*fw,Math.floor(frame/2)*fh,fw,fh,-w/2,-h/2,w,h);ctx.restore();
}
window.drawSheet=function(img,x,y,size,frame,rot=0,sx=1,sy=1,a=1){
  if(img===imgs?.windFlipped)return drawMirroredSheet(imgs.wind,x,y,size,frame,rot,Math.abs(sx),sy,a);
  if(img?._daggerFrame)return drawFrameAlias(img,'dagger',img._daggerFrame-1,size,x,y,a);
  if(img?._meteorFrame)return drawFrameAlias(img,'meteor',img._meteorFrame-1,size,x,y,a);
  if(img?._voidFrame)return drawFrameAlias(img,'voidRift',img._voidFrame-1,size,x,y,a);
  return baseDrawSheet?baseDrawSheet(img,x,y,size,frame,rot,sx,sy,a):undefined;
};
function daggerRainAttack(target,dmg,rad,size,delay=.46,extra=null){
  if(!target)return;
  if(!extra?.extraBarrage&&S._daggerRainCastTime===S.time)return;
  if(!extra?.extraBarrage)S._daggerRainCastTime=S.time;
  let lv=skillLv('daggerRain'),cp=comboPower('daggerRain'),frames=clamp(Math.ceil(lv),1,4),tx=target.x,ty=target.y;
  rad=Math.max(rad||0,76+lv*9+cp*5+skillMod('daggerRain','radius'));
  size=Math.max(size||0,rad*2.15);
  S.falls.push({kind:daggerKind(frames),daggerRain:true,x:tx,y:ty,sx:tx,sy:ty,tx,ty,dmg,rad,slow:0,color:'#dbeafe',size,life:delay,max:delay,rot:0,frames,hit:false,...(extra||{})});
  sfx('throw');
}
function meteorRainAttack(target,dmg,rad,slow,color,size,delay=.5,extra=null){
  if(!target)return;
  let evo=!!extra?.burn&&delay<.4,key=evo?'_meteorRainEvoTime':'_meteorRainCastTime';
  if(S[key]===S.time)return;S[key]=S.time;
  let lv=skillLv('meteorShard'),cp=comboPower('meteorShard'),frames=clamp(Math.ceil(lv),1,4);
  let tx=target.x+(typeof rand==='function'?rand(-12,12):0),ty=target.y+(typeof rand==='function'?rand(-8,8):0);
  let drop=150+(typeof rand==='function'?rand(20,55):35);
  rad=Math.max(rad||0,78+lv*8+cp*5+skillMod('meteorShard','radius'));
  size=Math.max(size||0,rad*2.05);
  // 坠落只画火球；落地后由 burstAt 再出范围圈
  let life=Math.max(delay||.42,.45);
  let sx=tx,sy=ty-drop;
  S.falls.push({
    // 坠落别名固定火球帧；落地爆发再切范围圈帧
    kind:meteorKind(1),meteorRain:true,falling:true,
    x:sx,y:sy,sx,sy,tx,ty,dmg,rad,slow,color:color||'#fb923c',size,
    tipSize:Math.max(58,Math.min(92,rad*.85)),
    life,max:life,rot:0,frames,hit:false,ballFrame:0,...(extra||{})
  });
  sfx('fall');
}
window.fallingAttack=function(kind,target,dmg,rad,slow,color,size,delay=.42,extra=null){
  if(kind==='dagger')return daggerRainAttack(target,dmg,rad,size,delay,extra);
  if(kind==='meteor')return meteorRainAttack(target,dmg,rad,slow,color,size,delay,extra);
  return baseFallingAttack?baseFallingAttack(kind,target,dmg,rad,slow,color,size,delay,extra):undefined;
};
window.burstAt=function(kind,x,y,dmg,rad,slow=0,color='#facc15',size=100,life=.55){
  if(S?._forceVoidFixedBurst&&kind==='voidRift')kind='voidRiftFixed';
  if(isDaggerKind(kind)||isMeteorKind(kind)||kind==='voidRiftFixed'||isVoidFixedKind(kind)){
    let meteor=isMeteorKind(kind),voidFx=kind==='voidRiftFixed'||isVoidFixedKind(kind),skill=voidFx?'voidRift':meteor?'meteorShard':'daggerRain';
    // 天火落地：固定用末帧范围圈（勿再用坠落火球帧）
    let fxKind=voidFx?voidKind(4):meteor?meteorKind(4):(kind==='dagger'?daggerKind(4):kind);
    let hits=rangeDamage(skill,x,y,dmg,rad,slow);
    let boomSize=Math.max(size||0,rad*2);
    S.artFx.push({
      x,y,type:voidFx?'voidRiftFixed':meteor?'meteorRain':'daggerRain',
      kind:fxKind,color,life,max:life,size:boomSize,rad,
      meteorImpact:!!meteor,impactFrame:meteor?2:undefined,impactHold:meteor?0.32:undefined
    });
    if(!voidFx)for(let n=0;n<8;n++)S.parts.push({x,y,vx:rand(-70,70),vy:rand(-70,70),life:rand(.18,.45),max:.45,a:1,c:color});
    sfx(voidFx?'rift':meteor?'boom':'throw');return hits;
  }
  return baseBurstAt?baseBurstAt(kind,x,y,dmg,rad,slow,color,size,life):0;
};
function bladeProjectile(kind,target,speed,dmg,life,aoe=0,slow=0,off=0,pierce=false){
  let p=S?.player;if(!p||!target)return;ensureWindFlip();
  let c=CFG[kind],a=Math.atan2(target.y-p.y,target.x-p.x)+off,sm=typeof projectileSpeedMul==='function'?projectileSpeedMul():1;
  if(S.artifacts?.includes('moon')&&kind==='moonSlash')slow=Math.max(slow,2);
  S.proj.push({kind,fxKind:kind==='wind'?'windFlipped':undefined,x:p.x,y:p.y,vx:Math.cos(a)*speed*sm,vy:Math.sin(a)*speed*sm,dmg,life,maxLife:life,aoe,slow,rot:a,
    trail:[],hit:new Set(),pierce:pierce!==false,blade:true,hitRadius:c.hit+(aoe||0)*.45,size:c.size+(aoe||0)*1.15});
  if(typeof sfx==='function')sfx('slash');
  p.hit=.16;p.cast=.24;
}
window.castProjectile=function(kind,target,speed,dmg,life,aoe=0,slow=0,off=0,pierce=false){
  if(isBlade(kind))return bladeProjectile(kind,target,speed,dmg,life,aoe,slow,off,pierce);
  return baseCast?baseCast(kind,target,speed,dmg,life,aoe,slow,off,pierce):undefined;
};
window.volley=function(kind,target,n,speed,dmg,life,aoe=0,slow=0,pierce=false){
  if(!isBlade(kind))return baseVolley?baseVolley(kind,target,n,speed,dmg,life,aoe,slow,pierce):undefined;
  let spread=kind==='wind'?.16:.20;
  for(let i=0;i<n;i++)window.castProjectile(kind,target,speed,dmg,life,aoe,slow,(i-(n-1)/2)*spread,true);
};
function spawnPrismFinale(){
  if(!S?.evolutions?.prismFinale||!S.skills?.arcaneBeam||S._prismBeamActive>0||S._prismBeamCd>0)return;
  let lv=skillLv('arcaneBeam'),cp=comboPower('arcaneBeam'),dur=2.4+Math.min(.8,lv*.12),range=430+lv*18+skillMod('arcaneBeam','range'),width=28+lv+skillMod('arcaneBeam','width'),d=(24+lv*7)*dmgBase('arcaneBeam')*evoPower('prismFinale');
  S._prismBeamActive=dur;S._prismBeamMax=dur;S._prismBeamCd=2.2;S._prismBeam={dmg:d,range,width,angle:S.time*1.7,hitTick:0};sfx('beam');
}
function updatePrismFinale(dt){
  if(S?._prismBeamCd>0&&!S._prismBeamActive)S._prismBeamCd-=dt;
  if(!S?._prismBeamActive||!S._prismBeam)return;
  let p=S.player,b=S._prismBeam;S._prismBeamActive-=dt;b.angle+=dt*2.8;b.hitTick-=dt;
  if(b.hitTick<=0){b.hitTick=.14;for(let j=0;j<2;j++){let a=b.angle+j*Math.PI,dx=Math.cos(a),dy=Math.sin(a),cx=p.x+dx*b.range*.5,cy=p.y+dy*b.range*.5,pool=window.nearbyEnemies?nearbyEnemies(cx,cy,b.range*.55+b.width+60):S.enemies;for(const e of pool){let px=e.x-p.x,py=e.y-p.y,along=px*dx+py*dy,side=Math.abs(px*dy-py*dx);if(along>0&&along<b.range&&side<b.width+e.r){dealDamage(e,b.dmg*.14,true,'arcaneBeam');e.hit=.08}}}}
  for(let j=0;j<2;j++){let a=b.angle+j*Math.PI;S.artFx.push({x:p.x+Math.cos(a)*b.range,y:p.y+Math.sin(a)*b.range,fromX:p.x,fromY:p.y,kind:'beam',type:'prismFinaleBeam',color:'#e9d5ff',life:.08,max:.08,size:b.width*7,rot:a,beam:true})}
  if(S._prismBeamActive<=0){S._prismBeam=null;S._prismBeamActive=0}
}
const baseEvolutionSkills=window.evolutionSkills;
window.evolutionSkills=function(dt){
  let had=!!S?.evolutions?.prismFinale;
  if(had)S.evolutions.prismFinale=false;
  S._forceVoidFixedBurst=true;
  try{baseEvolutionSkills?.(dt)}finally{S._forceVoidFixedBurst=false;if(had)S.evolutions.prismFinale=true}
  if(!S?.player||S.paused||S.over)return;
  updatePrismFinale(dt);spawnPrismFinale();
  if(S.evolutions?.astralImplosion&&S.skills?.missile&&S._evoTuneCd?.astralImplosion>1.2)S._evoTuneCd.astralImplosion=Math.min(S._evoTuneCd.astralImplosion,1.35);
};
const baseSkills=window.skills;
window.skills=function(dt){ensureDaggerFrames();ensureMeteorFrames();ensureVoidFrames();return baseSkills?baseSkills(dt):undefined};
window.drawBladeWave=function(m,kind){
  if(kind==='wind')ensureWindFlip();
  let img=kind==='wind'?(imgs?.windFlipped||imgs?.wind):imgs?.[kind];
  if(!img?.complete)return;
  let sz=m.size||(CFG[kind]||CFG.wind).size,fr=m.frame??frameOf(S.time,12),alpha=kind==='moonSlash'?.98:.92;
  if(kind==='wind'&&!imgs._windFlipReady)drawMirroredSheet(img,m.x,m.y,sz,fr,m.rot||0,1.35,.72,alpha);
  else drawSheet(img,m.x,m.y,sz,fr,m.rot||0,kind==='wind'?1.35:1.18,kind==='moonSlash'?.82:.72,alpha);
};
console.info('游侠风刃/月牙斩使用素材放大渲染补丁已启用');
})();
