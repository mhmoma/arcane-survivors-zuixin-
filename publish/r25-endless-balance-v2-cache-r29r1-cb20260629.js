(function(){
'use strict';
const BAL={monsterHpPerLayer:.18,monsterDamagePerLayer:.075,bossHpPerLayer:.22,bossDamagePerLayer:.10,timeHpPerMinute:.05,timeDamagePerMinute:.025,spawnSpeedPerLayer:.035,maxEliteChance:.45,attrStartLayer:8,attrDamagePerLayer:.04,bossAttrDamagePerLayer:.05,maxAttrDamage:.45,bossCurve:.04};
function minutes(){return window.S?.endless?Math.max(0,(S.time-(S.endlessStart||S.time))/60):0}
function layer(){return Math.max(0,Math.floor(window.S?.endlessLayer||0))}
function applyConfig(){if(!window.ENDLESS_CONFIG)return;Object.assign(window.ENDLESS_CONFIG,BAL)}
function balancedScale(){let l=layer(),min=minutes(),c=window.ENDLESS_CONFIG||BAL;return{monsterHp:1+l*c.monsterHpPerLayer+min*c.timeHpPerMinute,monsterDmg:1+l*c.monsterDamagePerLayer+min*c.timeDamagePerMinute,bossHp:1+l*c.bossHpPerLayer+Math.pow(l,1.18)*BAL.bossCurve+min*c.timeHpPerMinute,bossDmg:1+l*c.bossDamagePerLayer+min*c.timeDamagePerMinute,spawn:1+l*c.spawnSpeedPerLayer,elite:Math.min(c.maxEliteChance,.08+l*.025)}}
function patchScale(){applyConfig();try{window.endlessScale=balancedScale;(0,eval)('endlessScale = window.endlessScale')}catch(e){console.warn('无尽数值曲线替换失败:',e.message)}}
function patchAttr(){let base=window.enemyAttr;if(typeof base!=='function'||base._endlessBalance)return;window.enemyAttr=function(e,total){if(!window.S?.endless||(!e.boss&&!e.elite))return null;let l=layer(),c=window.ENDLESS_CONFIG||BAL,over=l-c.attrStartLayer+1;if(over<=0)return null;let type=e.bossType==='queen'||e.type==='wraith'?'frost':e.bossType==='golem'||e.type==='guardian'||e.type==='shield'?'physical':e.type==='healer'?'holy':e.type==='eye'?'arcane':e.type==='charger'?'fire':'shadow',rate=Math.min(c.maxAttrDamage,over*(e.boss?c.bossAttrDamagePerLayer:c.attrDamagePerLayer));return{type,amount:total*rate,source:{boss:e.boss,elite:e.elite},color:{frost:'#7dd3fc',physical:'#cbd5e1',holy:'#fde68a',arcane:'#c084fc',fire:'#fb923c',shadow:'#a78bfa'}[type]||'#facc15'}};window.enemyAttr._endlessBalance=true}
function patchStartTip(){let old=window.startEndless;if(typeof old!=='function'||old._endlessBalance)return;window.startEndless=async function(){applyConfig();let r=await old.apply(this,arguments);showNotice?.('无尽平衡已调整：前10层更适合无装备挑战，属性伤害延后到第8层');return r};window.startEndless._endlessBalance=true}
function patchAll(){patchScale();patchAttr();patchStartTip();console.info('无尽平衡补丁已启用：降低前中期伤害/血量成长，属性伤害延后')}
patchAll();
})();
