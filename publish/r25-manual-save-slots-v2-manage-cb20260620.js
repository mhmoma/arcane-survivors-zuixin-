window.GameModules = window.GameModules || {};
window.GameModules.manualSaveSlots = (() => {
  const SLOT_KEY = 'arcane-manual-save-slots-v1';
  const SLOT_COUNT = 4;
  const BASE_KEYS = ['arcane-cosmetics-v1','arcane-layout-v2'];
  let preRunSnapshot = null, busy = false, mode = 'manage';

  function seasonKey(base){return window.Season?.key ? Season.key(base) : base}
  function runSaveKey(){return seasonKey('arcane-save-v2')}
  function dataKeys(){return BASE_KEYS.slice()}
  async function kvGet(k){try{return await StorageSync.get(k)}catch(e){console.warn('读取槽位数据失败:',e.code,e.message);return StorageSync.localGet(k)}}
  async function kvPut(k,v,label='存档槽'){await StorageSync.put(k,v,label)}
  function fmtTime(t){if(!t)return '空槽位';let d=new Date(t);return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function packSummary(data){
    const cosmetics=data['arcane-cosmetics-v1']||{};
    const owned=Object.values(cosmetics.owned||{}).reduce((a,v)=>a+Object.keys(v||{}).length,0);
    return `外观 ${owned} 项 · 布局与非竞争设置`;
  }
  function emptySlots(){return {version:1,slots:Array.from({length:SLOT_COUNT},()=>null)}}
  function normalize(v){let s=v&&typeof v==='object'?v:emptySlots();if(!Array.isArray(s.slots))s.slots=[];while(s.slots.length<SLOT_COUNT)s.slots.push(null);s.slots=s.slots.slice(0,SLOT_COUNT);return s}
  async function loadSlots(){return normalize(await kvGet(SLOT_KEY))}
  async function saveSlots(slots){await kvPut(SLOT_KEY,slots,'主动存档槽')}
  async function snapshot(){
    const data={};
    for(const k of dataKeys()) data[k]=await kvGet(k);
    return data;
  }
  async function capturePreRun(){preRunSnapshot=await snapshot();return preRunSnapshot}
  async function clearRunSave(){await kvPut(runSaveKey(),{ended:true,at:Date.now()},'运行存档')}
  async function applyValue(k,v){
    if(v === null || v === undefined) await StorageSync.remove(k,'读取存档槽');
    else await kvPut(k,v,'读取存档槽');
  }
  async function refreshRuntimeData(){
    await window.Season?.reload?.();
    await window.Progression?.reload?.();
    await window.Equipment?.reload?.();
    await window.Rift?.reload?.();
    if(typeof renderClassCards==='function')renderClassCards();
    if(typeof renderProgression==='function')renderProgression();
    if(typeof initBootData==='function')await initBootData();
  }
  function ensureUi(){
    if(document.getElementById('manualSaveModal'))return;
    const style=document.createElement('style');
    style.textContent=`#manualSaveModal{z-index:88!important}.manualSavePanel{width:min(92vw,620px)!important;max-height:min(86dvh,680px)!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}.manualSlotList{display:grid;gap:10px;overflow-y:auto;min-height:0;padding:4px}.manualSlot{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px 14px;border:1px solid rgba(250,204,21,.25);border-radius:14px;background:rgba(15,23,42,.72);text-align:left}.manualSlot h2{margin:0 0 4px;color:#fde68a;font-size:16px}.manualSlot p{margin:0;color:#d8c7a1;font-size:13px}.manualSlotActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.manualSlot button{min-width:88px}.manualSaveMsg{min-height:20px;color:#fde68a}.manualSaveMsg.error{color:#fca5a5}@media (orientation:portrait){.manualSlot{grid-template-columns:1fr}.manualSlotActions{justify-content:stretch}.manualSlot button{width:100%}}`;
    document.head.appendChild(style);
    const modal=document.createElement('section');
    modal.id='manualSaveModal';
    modal.className='overlay hidden';
    modal.innerHTML=`<div class="panel manualSavePanel"><h1 id="manualSaveTitle" class="title">存档槽位</h1><p id="manualSaveSub" class="sub"></p><div id="manualSlotList" class="manualSlotList"></div><p id="manualSaveMsg" class="manualSaveMsg"></p><p class="sub"><button id="manualSaveClose" class="ghostBtn" type="button">关闭</button></p></div>`;
    document.querySelector('.game')?.appendChild(modal);
    document.getElementById('manualSaveClose').onclick=close;
    modal.addEventListener('click',onClick);
  }
  function setMsg(text='',err=false){let el=document.getElementById('manualSaveMsg');if(el){el.textContent=text;el.classList.toggle('error',err)}}
  async function render(){
    ensureUi();setMsg('');
    const slots=await loadSlots(),saveOnly=mode==='save';
    document.getElementById('manualSaveTitle').textContent=saveOnly?'选择主动存档槽':'读存一体槽位';
    document.getElementById('manualSaveSub').textContent=saveOnly?'保存进入本局前的安全状态，不保存当前地图内位置、怪物、血量与局内进度。':'可读取已有槽位，也可把当前局外状态保存到任意槽位；读取后会清空局内运行存档。';
    document.getElementById('manualSlotList').innerHTML=slots.slots.map((slot,i)=>{
      const title=`槽位 ${i+1}`,empty=!slot,summary=slot?.summary||'暂无存档';
      const actions=saveOnly?`<button data-manual-action="save" data-manual-slot="${i}">保存到此槽</button>`:`<div class="manualSlotActions"><button data-manual-action="load" data-manual-slot="${i}" ${empty?'disabled':''}>读取</button><button data-manual-action="save" data-manual-slot="${i}">保存</button></div>`;
      return `<div class="manualSlot"><div><h2>${title} · ${fmtTime(slot?.at)}</h2><p>${esc(summary)}</p></div>${actions}</div>`;
    }).join('');
  }
  async function open(nextMode){
    if(busy)return;mode=nextMode;ensureUi();document.getElementById('manualSaveModal').classList.remove('hidden');
    if(window.S)S.paused=true;
    try{await render()}catch(e){console.error('打开存档槽失败:',e.code,e.message,e.stack);setMsg('槽位读取失败，请稍后重试',true)}
  }
  function close(){document.getElementById('manualSaveModal')?.classList.add('hidden');if(window.S)S.paused=false}
  async function saveTo(i){
    const slots=await loadSlots(),data=preRunSnapshot||await snapshot();
    slots.slots[i]={at:Date.now(),summary:packSummary(data),data};
    await saveSlots(slots);await render();setMsg(`槽位 ${i+1} 已保存`,false);window.dzmm?.toast?.success?.('主动存档成功');
  }
  async function loadFrom(i){
    const slots=await loadSlots(),slot=slots.slots[i];
    if(!slot?.data)return setMsg('该槽位为空',true);
    for(const k of dataKeys()) await applyValue(k,slot.data[k]);
    await clearRunSave();preRunSnapshot=slot.data;window.S=null;
    ['loading','end','inventory','equipmentPanel','equipDetailModal','altarPanel','leaderboard','settings','classSelect','mapSelect','levelup','relicBtn','skillBtn','invBtn','equipBtn','saveBtn','settingsBtn'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
    await refreshRuntimeData();document.getElementById('start')?.classList.remove('hidden');if(typeof syncMusic==='function')syncMusic();close();window.dzmm?.toast?.success?.('读取成功');
  }
  async function onClick(e){
    const b=e.target.closest('[data-manual-slot]');if(!b||busy)return;
    const action=b.dataset.manualAction || mode;
    busy=true;b.disabled=true;setMsg(action==='save'?'正在保存...':'正在读取...');
    try{const i=Number(b.dataset.manualSlot);if(action==='save')await saveTo(i);else await loadFrom(i)}
    catch(err){console.error('存档槽操作失败:',err.code,err.message,err.stack);setMsg(err.message||'操作失败，请稍后重试',true)}
    finally{busy=false;b.disabled=false}
  }
  function bind(){
    ensureUi();
    const oldLoad=window.loadMapThenStart;
    if(oldLoad&&!oldLoad.__manualSlotPatched){window.loadMapThenStart=async function(...args){await capturePreRun();return oldLoad.apply(this,args)};window.loadMapThenStart.__manualSlotPatched=true}
    const saveBtn=document.getElementById('saveBtn'),loadBtn=document.getElementById('loadBtn');
    if(saveBtn)saveBtn.onclick=()=>{if(window.layoutEdit)return;open('save')};
    if(loadBtn)loadBtn.onclick=()=>open('manage');
  }
  return { bind, open, capturePreRun };
})();
window.ManualSaveSlots = window.GameModules.manualSaveSlots;
window.addEventListener('load', () => window.ManualSaveSlots?.bind?.());
setTimeout(() => window.ManualSaveSlots?.bind?.(), 0);
