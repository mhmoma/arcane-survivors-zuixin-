(function(){
'use strict';
const NEEDS=[120,280,480,720,1000,1320,1680,2080,2520,3000];
const TIMES=[60,125,195,270,350,430,515,600,685,770];
const REQS=NEEDS.map((n,i)=>i?n-NEEDS[i-1]:n);
const DURATIONS=TIMES.map((n,i)=>i?n-TIMES[i-1]:n);
function idx(){return Math.min(NEEDS.length-1,Math.max(0,S?.bossKills||0))}
function isNormal(){return !!S&&!S.endless&&!(S.rift&&S.rift.active)}
function syncStage(){if(!isNormal())return;let stage=Math.max(0,S.bossKills||0);if(S._bossPaceStage==null){S._bossPaceStage=stage;S._bossPaceBase=stage>0?Math.max(0,Math.floor(S.kills||0)):0;S._bossPaceStart=stage>0?Math.max(0,S.time||0):0}else if(S._bossPaceStage!==stage){S._bossPaceStage=stage;S._bossPaceBase=Math.max(0,Math.floor(S.kills||0));S._bossPaceStart=Math.max(0,S.time||0)}}
function stageReq(){return REQS[idx()]||REQS[REQS.length-1]}
function stageDuration(){return DURATIONS[idx()]||DURATIONS[DURATIONS.length-1]}
function stageProgress(){syncStage();return Math.max(0,Math.floor(S.kills||0)-(S._bossPaceBase||0))}
function normalBossNeed(){syncStage();let target=(S._bossPaceBase||0)+stageReq(),elapsed=(S.time||0)-(S._bossPaceStart||0);return elapsed>=stageDuration()?Math.min(target,Math.max(S._bossPaceBase||0,Math.floor(S.kills||0))):target}
function normalKillValue(e){if(!e||e.boss)return 1;if(e.type==='shield'||e.shield>0)return 5;if(e.elite)return 6;if(e.type==='guardian')return 5;if(e.type==='healer')return 5;if(e.type==='charger')return 4;if(e.type==='eye')return 3;if(e.type==='wraith')return 4;if(e.type==='slime')return e.mini?1:2;if(['bloodAcolyte','lavaImp','sporeSlime','voidWalker'].includes(e.type))return e.elite?7:3;return 1}
function patchBossPacing(){let baseKill=window.killProgressValue,baseNeed=window.nextBossNeed,baseWarn=window.updateBossWarn,baseSpawn=window.spawnEnemy,baseHud=window.updateHud;
window.bossKillNeed=function(n){return NEEDS[Math.min(NEEDS.length-1,Math.max(0,Math.floor(n||0)))]};
window.nextBossNeed=function(){if(isNormal())return normalBossNeed();return baseNeed?baseNeed():window.bossKillNeed(S?.bossKills||0)};
window.killProgressValue=function(e){if(isNormal())return normalKillValue(e);return baseKill?baseKill(e):1};
window.spawnEnemy=function(boss=false,forced=null){let normal=isNormal(),i=idx();if(boss&&normal&&S.kills<normalBossNeed())return false;let out=baseSpawn?baseSpawn(boss,forced):false;if(boss&&normal){let b=[...S.enemies].reverse().find(e=>e.boss);if(b&&!b._paceHp){let ratio=(1+i*.18)/(1+i*.32);b.hp*=ratio;b.max*=ratio;b._paceHp=true}}return out};
window.updateBossWarn=function(){if(!isNormal())return baseWarn&&baseWarn();let el=$('bossWarn');if(!el)return;if(S.enemies?.some(e=>e.boss)){el.classList.add('hidden');return}S.nextBossKills=normalBossNeed();let left=Math.max(0,stageReq()-stageProgress()),timeLeft=Math.max(0,stageDuration()-((S.time||0)-(S._bossPaceStart||0)));if(!S.paused&&!S.over&&(left<=18||timeLeft<=12)){el.textContent=timeLeft<=12&&left>0?`魔王即将降临，倒计时 ${Math.ceil(timeLeft)} 秒`:`魔王即将降临，还需进度 ${left}`;el.classList.remove('hidden')}else el.classList.add('hidden')};
window.updateHud=function(){if(baseHud)baseHud();if(!isNormal()||!S?.player)return;let need=stageReq(),cur=clamp(stageProgress(),0,need);$('bossTxt').textContent=`${Math.floor(cur)}/${need}`;$('bossFill').style.width=`${clamp(cur/Math.max(1,need)*100,0,100)}%`};
console.info('Boss节奏补丁已启用：10-15分钟通关节奏')}
patchBossPacing();
})();
