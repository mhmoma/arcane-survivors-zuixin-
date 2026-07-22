(function(){
'use strict';
let boardRows=[];
const $id=id=>document.getElementById(id);
const clsName=id=>window.Equipment?.CLS_CN?.[id]||window.CLASSES?.[id]?.cn||id||'未知职业';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const time=s=>typeof window.fmt==='function'?fmt(s||0):`${Math.floor((s||0)/60)}:${String(Math.floor(s||0)%60).padStart(2,'0')}`;
const rankClass=i=>i===0?' top1':i===1?' top2':i===2?' top3':'';
function skillName(k){return window.INFO?.[k]?.[0]||window.ATTACK_NAME?.[k]||k}
function rowName(r){return window.safeName?.(r.name,r.playerName,r.userName,r.displayName,r.nickname)||r.name||'匿名勇士'}
function equipText(it){let txt=window.Equipment?.itemText?Equipment.itemText(it):'';return String(txt||'').split(' / ').filter(Boolean).slice(0,6)}
function equippedSummary(){try{return (Equipment?.equippedItems?.(S.player.cls)||[]).map(it=>({slot:Equipment.SLOT_CN?.[it.slot]||it.slot,name:it.name,rarity:it.rarity,power:it.itemPower||it.level||0,text:equipText(it)}))}catch(e){console.warn('读取排行榜装备失败:',e.message);return[]}}
function runSkills(){return Object.entries(S.skills||{}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>`${skillName(k)} Lv.${v}`)}
function runEvos(){return Object.keys(S.evolutions||{}).map(id=>window.EVOLUTIONS?.[id]?.name||id).filter(Boolean)}
function runCombos(){try{return (window.activeCombos?.()||[]).map(id=>window.comboName?.(id)||S.combos?.[id]?.name||id).filter(Boolean)}catch(_){return[]}}
function riftArgs(){return{}}
function metric(r){return `秘境 ${Math.max(0,Math.floor(Number(r.riftLayer)||0))} 层 · ${time(r.riftTime||0)} · Lv.${Math.max(1,Math.floor(Number(r.level)||1))}`}
window.renderBoard=function(board){boardRows=Array.isArray(board)?board:[];let list=$id('boardList');if(!list)return;if(!boardRows.length){list.innerHTML='<div class="choice">暂无大秘境排行，通关任意大秘境后会记录最高层。</div>';return}list.innerHTML=boardRows.map((r,i)=>`<button class="choice boardRow riftBoardRow${rankClass(i)}" data-rift-board="${i}" type="button"><b class="boardRank">${i+1}</b><span class="boardName">${esc(rowName(r))}<small>${esc(clsName(r.classId))} · ${esc(r.buildName||'自由流派')}</small></span><span class="boardLv">${esc(metric(r))}</span></button>`).join('')};
window.openBoard=async function(){if(window.boardBusy)return;window.boardBusy=true;$id('boardSub').textContent='加载中...';$id('boardList').innerHTML='<div class="choice">正在读取大秘境最高层排行</div>';$id('leaderboard').classList.remove('hidden');if(S)S.paused=true;try{let r=await invokeFn('leaderboard',{method:'list'});renderBoard(r.board);$id('boardSub').textContent='大秘境最高层前二十名，点击玩家查看职业、流派、时间、层数、技能和装备'}catch(e){if(window.isCaptchaError?.(e))showCaptchaBoard();else{$id('boardSub').textContent=e.code==='function_not_published'?'排行榜函数还未发布，请保存游戏后上线':'排行榜加载失败';$id('boardList').innerHTML=`<div class="choice">${esc(e.message||'请稍后重试')}</div>`}}finally{window.boardBusy=false}};
window.submitScore=async function(){if(!S?.player||S.mapId!=='rift'||!S.rift?.guardianKilled||S.rift._boardSubmitted)return;try{let r=await invokeFn('leaderboard',{method:'submit',args:riftArgs()});renderBoard(r.board);if(r.rank)S.rift._boardSubmitted=true;else setTimeout(()=>window.submitScore?.(),1200)}catch(e){S.rift._boardSubmitted=false;if(window.isCaptchaError?.(e)){console.warn('秘境排行榜需要验证后提交:',e.message);showNotice?.('排行榜需要完成真人验证后再提交');return}console.error('秘境排行榜提交失败:',e.code,e.message,e.stack)}};
let baseEnd=window.end;window.end=function(win){let wasRift=!!S?.rift?.active,out=baseEnd?baseEnd(win):undefined;if(wasRift&&win)setTimeout(()=>window.submitScore?.(),0);return out};
function detailStats(r){return `<div class="choice"><h2>通关数据</h2><p>层数：秘境 ${Math.max(0,Math.floor(Number(r.riftLayer)||0))} 层</p><p>时间：${time(r.riftTime||0)}　角色等级：Lv.${Math.max(1,Math.floor(Number(r.level)||1))}</p><p>击杀：${Math.max(0,Math.floor(Number(r.kills)||0))}　Boss：${Math.max(0,Math.floor(Number(r.bossKills)||0))}</p><p>提交时间：${esc(String(r.at||'未记录').replace('T',' ').slice(0,19))}</p></div>`}
function detailBuild(r){return `<div class="choice"><h2>职业与流派</h2><p>玩家：${esc(rowName(r))}</p><p>职业：${esc(clsName(r.classId))}</p><p>流派：${esc(r.buildName||'自由流派')}</p></div>`}
function detailSkills(r){return `<div class="choice"><h2>技能与进化</h2><p>核心技能：${esc((r.skills||[]).join('、')||'未记录')}</p><p>进化：${esc((r.evolutions||[]).join('、')||'未记录')}</p><p>组合：${esc((r.combos||[]).join('、')||'未记录')}</p></div>`}
function detailEquipment(r){let eq=(r.equipment||[]).map(it=>`<div class="choice"><h2>${esc(it.slot||'装备')} · ${esc(it.name)}${it.power?` <small>强度${it.power}</small>`:''}</h2><p>${esc((it.text||[]).join(' / ')||it.rarity||'未记录词条')}</p></div>`).join('');return `<h2 class="title">装备搭配</h2>${eq||'<div class="choice">未记录装备。旧排行数据需要玩家重新通关提交后才会补齐。</div>'}`}
function showDetail(r){let idx=boardRows.indexOf(r),body=$id('equipDetailBody');if(!body)return;body.innerHTML=`<h1 class="title">#${idx+1} · ${esc(rowName(r))}</h1><p class="sub">${esc(metric(r))}</p>${detailBuild(r)}${detailStats(r)}${detailSkills(r)}${detailEquipment(r)}`;body.scrollTop=0;let modal=$id('equipDetailModal');modal.classList.remove('hidden');modal.classList.add('leaderboardDetailModal');if(S)S.paused=true}
document.addEventListener('click',e=>{let b=e.target.closest('[data-rift-board]');if(!b)return;e.preventDefault();let r=boardRows[Number(b.dataset.riftBoard)];if(r)showDetail(r)});
function bindBoardButton(){let btn=$id('boardBtn');if(btn)btn.onclick=window.openBoard}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindBoardButton);else bindBoardButton();
console.info('秘境排行榜详情已启用：时间、层数、流派、技能、装备');
})();
