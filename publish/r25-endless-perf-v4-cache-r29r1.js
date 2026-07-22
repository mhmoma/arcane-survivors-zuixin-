(function(){
'use strict';
const CFG={cap:{off:42,low:50,medium:66,high:82},min:{off:34,low:40,medium:52,high:64},bossKeep:{off:18,low:24,medium:34,high:42},gems:180,parts:{off:18,low:36,medium:120,high:210},fx:{off:4,low:12,medium:46,high:82},shots:{off:42,low:62,medium:94,high:120},proj:{off:28,low:44,medium:72,high:96},axes:{off:18,low:28,medium:50,high:70}};
function q(){return window.fxQuality||'low'}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function endless(){return !!(window.S&&S.run&&S.endless&&!S.rift?.active&&!S.over)}
function adds(){let n=0;if(!S?.enemies)return 0;for(const e of S.enemies)if(!e.boss&&!e.dead)n++;return n}
function cap(){if(!endless())return null;let z=q(),layer=S.endlessLayer||1,min=Math.max(0,(S.time-(S.endlessStart||S.time))/60),base=CFG.cap[z]||CFG.cap.low,lo=CFG.min[z]||CFG.min.low;let v=base-Math.floor((layer-1)/10)*2-Math.floor(min/9)*2;return clamp(v,lo,base)}
function applyCap(){let c=cap();if(c!=null)window.ENDLESS_MONSTER_CAP=c;return c}
function bossKeep(){let z=q(),layer=S.endlessLayer||1;return clamp((CFG.bossKeep[z]||CFG.bossKeep.low)+Math.floor(layer/20)*2,24,46)}
function threat(e,p){let d=p?Math.hypot(e.x-p.x,e.y-p.y):9999,v=100000-d;if(e.elite)v+=50000;if(e.shield>0)v+=12000;if(['healer','wraith','guardian','shield','charger','eye'].includes(e.type))v+=9000;if(e.hp/e.max<.35)v-=5000;return v}
function trimAdds(max,notice=false){if(!endless()||!S.enemies)return;let list=S.enemies.filter(e=>!e.boss&&!e.dead);if(list.length<=max)return;let p=S.player,keep=new Set(list.sort((a,b)=>threat(b,p)-threat(a,p)).slice(0,max)),cut=list.length-max;S.enemies=S.enemies.filter(e=>e.boss||e.dead||keep.has(e));if(notice&&S.time>(S._endlessTrimNoticeAt||0)){S._endlessTrimNoticeAt=S.time+6;showNotice?.(`无尽性能保护：Boss战保留 ${max} 个高威胁怪，清理 ${cut} 个远处怪`)}}
function compact(arr,keep){if(!arr)return;let w=0;for(let i=0;i<arr.length;i++)if(keep(arr[i]))arr[w++]=arr[i];arr.length=w}
function trimArray(arr,max){if(arr&&arr.length>max)arr.splice(0,arr.length-max)}
function mergeOldGems(){if(!endless()||!S.gems||S.gems.length<=CFG.gems||!S.player)return;let take=S.gems.length-CFG.gems,gain=0;for(let i=0;i<take;i++)gain+=S.gems[i].v||0;S.gems.splice(0,take);S.player.xp+=gain}
function trimRuntime(){if(!endless())return;let z=q();mergeOldGems();trimArray(S.parts,CFG.parts[z]||CFG.parts.low);trimArray(S.artFx,CFG.fx[z]||CFG.fx.low);trimArray(S.enemyShots,CFG.shots[z]||CFG.shots.low);trimArray(S.proj,CFG.proj[z]||CFG.proj.low);trimArray(S.axes,CFG.axes[z]||CFG.axes.low);compact(S.falls,f=>!f.dead&&f.life>0);compact(S.slashes,s=>s.life>0);compact(S.bolts,b=>b.life>0)}
function patchSpawn(){let oldCount=window.spawnCount,oldSpawn=window.spawnEnemy;if(typeof oldCount==='function')window.spawnCount=function(){let c=applyCap(),n=oldCount();return c==null?n:Math.min(n,Math.max(0,c-adds()))};if(typeof oldSpawn==='function')window.spawnEnemy=function(boss=false,forced=null){let c=applyCap();if(endless()&&boss)trimAdds(bossKeep(),true);if(endless()&&!boss&&c!=null&&adds()>=c)return false;return oldSpawn(boss,forced)}}
function patchUpdate(){let old=window.updateObjs;if(typeof old!=='function')return;window.updateObjs=function(dt){applyCap();old(dt);let c=cap();if(c!=null)trimAdds(c,false);trimRuntime()}}
function patchHud(){let old=window.updateHud;if(typeof old!=='function')return;window.updateHud=function(){old();if(!endless())return;let job=document.getElementById('job'),p=S.player;if(job&&p)job.textContent=`${p.job} · 无尽${S.endlessLayer}层 · 怪${adds()}/${cap()||100}`}}
function patchQualityTip(){let old=window.startEndless;if(typeof old!=='function')return;window.startEndless=async function(){let r=await old.apply(this,arguments);applyCap();showNotice?.('无尽性能优化已启用：动态控怪、Boss清场、自动合并远处经验');return r}}
function patchAll(){patchSpawn();patchUpdate();patchHud();patchQualityTip();console.info('无尽性能优化已启用：动态怪物上限、Boss清场、对象裁剪、经验合并')}
patchAll();
})();
