window.GameModules = window.GameModules || {};
window.GameModules.redeem = (() => {
  let redeeming = false;
  async function applyServerState(r) {
    if (r?.state?.meta) await StorageSync.put('arcane-meta-v3', r.state.meta, '兑换奖励');
    if (r?.state?.rift) await StorageSync.put('arcane-rift-v1', r.state.rift, '兑换奖励');
    if (r?.state?.season) await StorageSync.put('arcane-season-state-v2', r.state.season, '兑换奖励');
    await window.Progression?.reload?.();
    await window.Rift?.reload?.();
    await window.Season?.reload?.();
  }

  function message(text, ok = false) {
    const el = document.getElementById('redeemMsg');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('ok', ok);
  }
  function scytheSetItem(slot) {
    const base = Equipment.all.find(x => x.rarity === 'set' && x.class === 'scytheMaiden' && x.setId === 'reaper-waltz' && x.slot === slot);
    if (!base) return null;
    const stats = { ...(base.stats || {}), setSkillDmg: 2 };
    const resists = { ...(base.resists || {}) };
    return { ...base, uid: `gift${Date.now().toString(36)}${slot}${Math.random().toString(36).slice(2,6)}`, baseId: base.baseId, level: 38, requiredLevel: 20, season: Season?.CURRENT || 1, source: '限定激活码', rollTier: '套装特效 200%', rollMul: 1, stats, resists, corrupted: false };
  }
  async function grantScytheGift(id) {
    if (!window.Equipment?.addItem) throw new Error('奖励系统未就绪');
    await Equipment.init();
    const slots = ['weapon','helm','chest','amulet','ring','boots'].sort(() => Math.random() - .5).slice(0,4);
    for (const slot of slots) {
      const it = scytheSetItem(slot);
      if (it) await Equipment.addItem(it);
    }
    return { applied: true, slots };
  }
  async function grantSacrifice5090(id) {
    if (!window.Equipment?.addItem) throw new Error('奖励系统未就绪');
    await Equipment.init();
    const base = Equipment.all.find(x => x.baseId === 'sacrifice-laoyang-5090');
    if (!base) throw new Error('5090 数据缺失');
    const uid = `gift5090${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
    await Equipment.addItem({ uid, baseId: base.baseId, level: 1, itemPower: 120, powerTier: '祭品', requiredLevel: 1, season: Season?.CURRENT || 1, source: '误删补偿', rollTier: '唯一祭品', rollMul: 1, stats: base.stats, resists: base.resists, corrupted: false });
    return { applied: true, uid, openEquipment: true };
  }
  async function openRewardEquipment(uid) {
    document.getElementById('redeemModal')?.classList.add('hidden');
    if (typeof openEquipment === 'function') await openEquipment();
    if (typeof renderEquipment === 'function') renderEquipment('sacrifice');
    if (uid && typeof showStoreEquipDetail === 'function') showStoreEquipDetail(uid);
  }
  async function applyReward(grant) {
    if (!grant?.id) return { applied: true };
    if (grant.scytheGift) return await grantScytheGift(grant.id);
    if (grant.sacrifice5090) return await grantSacrifice5090(grant.id);
    return { applied: true };
  }
  async function submit(onSuccess) {
    if (redeeming) return;
    const input = document.getElementById('redeemInput');
    const submitBtn = document.getElementById('redeemSubmit');
    const code = (input?.value || '').trim();
    if (!code) { message('请输入兑换码'); return; }
    redeeming = true;
    if (submitBtn) submitBtn.disabled = true;
    try {
      message('兑换中，请稍候…');
      let r = await dzmm.fn.invoke('redeem', { code });
      if (!r.applied) { message(r.message || '该兑换码已使用过'); return; }
      await applyServerState(r);
      const result = await applyReward(r.clientGrant);
      if (!result.applied) { message('该兑换码奖励已领取过'); return; }
      message(r.message || '兑换成功', true);
      input.value = '';
      onSuccess?.();
      if (result.openEquipment) setTimeout(() => openRewardEquipment(result.uid), 450);
    } finally {
      redeeming = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }
  function bind(onSuccess) {
    const modal = document.getElementById('redeemModal');
    const input = document.getElementById('redeemInput');
    document.getElementById('redeemBtn').onclick = () => { modal.classList.remove('hidden'); input?.focus(); message(''); };
    document.getElementById('redeemCancel').onclick = () => modal.classList.add('hidden');
    document.getElementById('redeemSubmit').onclick = () => submit(onSuccess).catch(e => {
      console.error('兑换失败:', e.code, e.message, e.stack);
      message(e.code === 'function_not_published' ? '兑换函数还未发布，请保存游戏后上线' : e.message || '兑换失败，请稍后重试');
    });
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('redeemSubmit').click(); });
  }
  return { bind };
})();
