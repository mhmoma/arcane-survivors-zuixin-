window.GameModules = window.GameModules || {};
window.GameModules.saveTransfer = (() => {
  const VERSION = 1;
  const BASE_KEYS = ['arcane-cosmetics-v1','arcane-layout-v2'];

  function seasonKey(base){return window.Season?.key ? Season.key(base) : base}
  function runSaveKey(){return seasonKey('arcane-save-v2')}
  function keys(){return BASE_KEYS.slice()}
  async function kvGet(k){return await StorageSync.get(k)}
  async function kvPut(k,v){await StorageSync.put(k,v,'导入存档')}
  function enc(obj){return btoa(unescape(encodeURIComponent(JSON.stringify(obj))))}
  function dec(text){return JSON.parse(decodeURIComponent(escape(atob(String(text).trim()))))}
  function msg(text, ok=false){const el=document.getElementById('saveTransferMsg');if(!el)return;el.textContent=text;el.classList.toggle('ok',ok)}
  function plainObject(v){return !!v && typeof v === 'object' && !Array.isArray(v)}
  function validImportValue(k,v){
    if (!plainObject(v)) return false;
    if (k === 'arcane-cosmetics-v1') return plainObject(v.owned) || plainObject(v.selected);
    if (k === 'arcane-layout-v2') return true;
    return true;
  }
  async function clearRunSave(){await kvPut(runSaveKey(),{ended:true,at:Date.now()})}
  async function refreshRuntimeData(){
    await window.Season?.reload?.();
    await window.Progression?.reload?.();
    await window.Equipment?.reload?.();
    await window.Rift?.reload?.();
    if (typeof initBootData === 'function') await initBootData();
  }

  async function exportText(){
    const data = {};
    for (const k of keys()) data[k] = await kvGet(k);
    return enc({ game:'arcane-survivors', version:VERSION, build:window.__ARCANE_BUILD||'', at:Date.now(), data });
  }
  async function importText(text){
    const pack = dec(text);
    if (pack?.game !== 'arcane-survivors' || !plainObject(pack.data)) throw new Error('存档文本格式不正确');
    const allowed = keys();
    let count = 0;
    for (const [k,v] of Object.entries(pack.data)) {
      if (!allowed.includes(k) || v === null) continue;
      if (!validImportValue(k, v)) throw new Error(`存档字段 ${k} 结构异常`);
      await kvPut(k,v);
      count++;
    }
    if (!count) throw new Error('存档文本没有可导入的数据');
    await clearRunSave();
    await refreshRuntimeData();
    return true;
  }
  async function doExport(){
    const box=document.getElementById('saveTransferText');
    try{box.value=await exportText();box.focus();box.select();msg('已生成存档文本，复制保存即可。',true)}
    catch(e){console.error('导出存档失败:',e.code,e.message,e.stack);msg('导出失败，请稍后重试')}
  }
  async function doImport(){
    const box=document.getElementById('saveTransferText'),text=box?.value||'';
    try{await importText(text);msg('导入成功：仅恢复外观与布局，货币、装备、秘境、赛季等竞争数据不会从导入包恢复。',true)}
    catch(e){console.error('导入存档失败:',e.code,e.message,e.stack);msg(e.message||'导入失败，存档文本无效')}
  }
  function open(){document.getElementById('saveTransferModal')?.classList.remove('hidden');msg('')}
  function close(){document.getElementById('saveTransferModal')?.classList.add('hidden')}
  function bind(){
    document.getElementById('saveTransferBtn')?.addEventListener('click', open);
    document.getElementById('saveTransferClose')?.addEventListener('click', close);
    document.getElementById('saveExportBtn')?.addEventListener('click', doExport);
    document.getElementById('saveImportBtn')?.addEventListener('click', doImport);
  }
  return { bind, exportText, importText };
})();
window.SaveTransfer = window.GameModules.saveTransfer;
window.addEventListener('load', () => window.SaveTransfer?.bind?.());
