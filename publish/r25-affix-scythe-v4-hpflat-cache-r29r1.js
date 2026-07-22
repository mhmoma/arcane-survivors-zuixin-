'use strict';
window.GameModules = window.GameModules || {};
window.GameModules.affix = (() => {
  // 词条底层统一使用扁平 key，避免 attrDmg:{fire:x} 这类嵌套在装备挂载时漏读。
  const RES = ['physical','fire','frost','arcane','holy','shadow','poison','lust'];
  const RES_CN = { physical:'物理', fire:'火焰', frost:'霜寒', arcane:'奥术', holy:'神圣', shadow:'暗影', poison:'毒素', lust:'欲望' };

  const SURVIVAL_AFFIXES = [
    {id:'hp',stat:'hp',name:'最大生命提高',range:[.12,.18],tag:'ADDITIVE_POOL'},
    {id:'hpFlat',stat:'hpFlat',name:'最大生命',range:[520,980],tag:'ADDITIVE_POOL'},
    {id:'armor',stat:'armor',name:'总护甲提高',range:[.08,.12],tag:'ADDITIVE_POOL'},
    {id:'allRes',stat:'allRes',name:'所有属性抗性',range:[.06,.09],tag:'ADDITIVE_POOL'},
    {id:'regen',stat:'regen',name:'生命回复提高',range:[.08,.12],tag:'ADDITIVE_POOL'},
    {id:'move',stat:'move',name:'移动速度提高',range:[.10,.14],tag:'ADDITIVE_POOL'},
  ];
  const ADDITIVE_AFFIXES = [
    {id:'damage',stat:'damage',name:'全伤害提高',range:[.12,.18],tag:'ADDITIVE_POOL'},
    {id:'cooldown',stat:'cooldown',name:'冷却缩减',range:[.04,.055],tag:'ADDITIVE_POOL'},
    {id:'atkSpeed',stat:'atkSpeed',name:'攻击速度提高',range:[.06,.09],tag:'ADDITIVE_POOL'},
    {id:'skillFreq',stat:'skillFreq',name:'技能释放频率提高',range:[.06,.09],tag:'ADDITIVE_POOL'},
    {id:'range',stat:'range',name:'技能范围提高',range:[.09,.14],tag:'ADDITIVE_POOL'},
    {id:'crit',stat:'crit',name:'暴击率',range:[.09,.14],tag:'ADDITIVE_POOL'},
    {id:'projectileSpeed',stat:'projectileSpeed',name:'技能飞行速度提高',range:[.09,.14],tag:'ADDITIVE_POOL'},
    {id:'extraProjectile',stat:'extraProjectile',name:'弹幕数量提高',range:[.07,.10],tag:'ADDITIVE_POOL'},
    {id:'splitChance',stat:'splitChance',name:'弹幕分裂概率',range:[.07,.10],tag:'ADDITIVE_POOL'},
    {id:'bossDmg',stat:'bossDmg',name:'对Boss伤害提高',range:[.14,.22],tag:'ADDITIVE_POOL'},
    {id:'eliteDmg',stat:'eliteDmg',name:'对精英伤害提高',range:[.14,.22],tag:'ADDITIVE_POOL'},
    {id:'riftBossDmg',stat:'riftBossDmg',name:'秘境Boss伤害提高',range:[.16,.24],tag:'ADDITIVE_POOL'},
    {id:'riftEliteDmg',stat:'riftEliteDmg',name:'秘境精英伤害提高',range:[.14,.22],tag:'ADDITIVE_POOL'},
    {id:'shieldBreak',stat:'shieldBreak',name:'对护盾伤害提高',range:[.09,.14],tag:'ADDITIVE_POOL'},
    {id:'executeDmg',stat:'executeDmg',name:'对低血敌人伤害提高',range:[.14,.22],tag:'ADDITIVE_POOL'},
    {id:'dotTickRate',stat:'dotTickRate',name:'持续伤害生效频率提高',range:[.06,.09],tag:'ADDITIVE_POOL'},
    {id:'progressBonus',stat:'progressBonus',name:'秘境进度获取提高',range:[.03,.05],tag:'ADDITIVE_POOL'},
  ];
  const MULTIPLICATIVE_AFFIXES = RES.map(r => ({
    id:'attrDmg_'+r,
    stat:'attrDmg_'+r,
    attr:r,
    name:RES_CN[r]+'属性伤害提高',
    range:[.16,.24],
    tag:'SUB_BUCKET_TYPE'
  }));
  const RESIST_AFFIXES = RES.map(r => ({id:'res_'+r,stat:'resist_'+r,attr:r,name:RES_CN[r]+'抗性提高',range:[.08,.12],tag:'ADDITIVE_POOL'}));
  const TEMPLATE_AFFIXES = [
    {id:'critDmg',stat:'critDmg',name:'暴击伤害提高',range:[.18,.28],tag:'ADDITIVE_POOL'},
    {id:'dotDmg',stat:'dotDmg',name:'持续伤害提高',range:[.18,.28],tag:'ADDITIVE_POOL'},
    {id:'rangeDmg',stat:'rangeDmg',name:'远距离伤害提高',range:[.14,.22],tag:'ADDITIVE_POOL'},
    {id:'healthyDmg',stat:'healthyDmg',name:'对高血量敌人伤害提高',range:[.14,.22],tag:'ADDITIVE_POOL'},
    {id:'dodge',stat:'dodge',name:'闪避率',range:[.08,.12],tag:'ADDITIVE_POOL'},
    {id:'eliteDmgReduce',stat:'eliteDmgReduce',name:'受到精英伤害降低',range:[.04,.06],tag:'ADDITIVE_POOL'},
    {id:'bossDmgReduce',stat:'bossDmgReduce',name:'受到Boss伤害降低',range:[.04,.06],tag:'ADDITIVE_POOL'},
    {id:'slowResist',stat:'slowResist',name:'受到减速效果降低',range:[.10,.14],tag:'ADDITIVE_POOL'},
    {id:'healBonus',stat:'healBonus',name:'治疗效果提高',range:[.08,.12],tag:'ADDITIVE_POOL'},
  ];
  const AFFIX_BY_STAT = [...SURVIVAL_AFFIXES, ...ADDITIVE_AFFIXES, ...MULTIPLICATIVE_AFFIXES, ...RESIST_AFFIXES, ...TEMPLATE_AFFIXES].reduce((o,a)=>(o[a.stat]=a,o),{});

  function pickRandom(pool) { return pool[Math.floor(Math.random()*pool.length)]; }
  function affixKey(a) { return a.id || a.stat; }
  const WEAPON_ALLOWED = new Set(['damage','atkSpeed','range','crit','critDmg','dotDmg','rangeDmg','healthyDmg','extraProjectile','splitChance','bossDmg','eliteDmg','riftBossDmg','riftEliteDmg','shieldBreak','executeDmg','dotTickRate','progressBonus']);
  const DEFENSE_ALLOWED = new Set(['hp','hpFlat','armor','allRes','regen','move','pickup','gold','cooldown','dodge','eliteDmgReduce','bossDmgReduce','slowResist','healBonus']);
  const JEWELRY_BLOCKED = new Set(['armor','dodge','eliteDmgReduce','bossDmgReduce','healBonus']);
  function defensiveSlot(slot) { return slot === 'helm' || slot === 'chest' || slot === 'boots'; }
  function jewelrySlot(slot) { return slot === 'amulet' || slot === 'ring'; }
  function survivalPool(slot) { return slot === 'weapon' ? [] : defensiveSlot(slot) ? SURVIVAL_AFFIXES : SURVIVAL_AFFIXES.filter(a => a.stat !== 'armor'); }
  function weaponAffix(a) { return WEAPON_ALLOWED.has(a.stat) || a.stat.startsWith('attrDmg_'); }
  function defenseAffix(a) { return DEFENSE_ALLOWED.has(a.stat); }
  function jewelryAffix(a) { return !JEWELRY_BLOCKED.has(a.stat) && !a.stat.startsWith('resist_'); }
  function slotPool(slot, pool) { return pool.filter(a => slot === 'weapon' ? weaponAffix(a) : defensiveSlot(slot) ? defenseAffix(a) : jewelrySlot(slot) ? jewelryAffix(a) : a.stat !== 'armor'); }
  function available(pool, used) { return pool.filter(a => !used.has(affixKey(a)) && !used.has(a.stat)); }
  function powerScale(itemPower=1) {
    let ip = Math.max(1, Math.min(120, Number(itemPower)||1));
    return ip / 120;
  }
  function powerTier(itemPower=1) {
    let ip = Math.max(1, Math.min(120, Number(itemPower)||1));
    return ip>=105?'满级':ip>=80?'高阶':ip>=50?'进阶':ip>=25?'成长':'新手';
  }
  function rollQuality(itemPower=1, canPrimal=false) {
    let ip = Math.max(1, Math.min(120, Number(itemPower)||1)), r = Math.random() * 100;
    if (canPrimal && ip >= 105 && r >= 99) return 'primal';
    if (r >= 85 && r < 99) return 'ancient';
    return 'normal';
  }
  function isSurvivalStat(stat) { return stat === 'hp' || stat === 'hpFlat' || stat === 'armor'; }
  function qualityName(q) { return q === 'primal' ? '太古' : q === 'ancient' ? '远古' : '普通'; }
  function scaleValue(range, level, mul=1, itemPower=level, quality='normal', stat='') {
    let l = powerScale(itemPower), min = range[0] * l, max = range[1] * l;
    if (isSurvivalStat(stat) && (quality === 'ancient' || quality === 'primal')) max *= 1.3;
    let val = quality === 'primal' ? max : min + Math.random() * Math.max(0, max - min);
    return Math.round(val * mul * 1000) / 1000;
  }
  function addFlat(stats, resists, tags, used, a, level, mul, rf=null, quality='normal') {
    if (!a) return false;
    let old = Math.random, key = affixKey(a);
    if (rf !== null) Math.random = () => rf;
    let val = scaleValue(a.range, level, mul, level, quality, a.stat);
    if (rf !== null) Math.random = old;
    used.add(key); used.add(a.stat);
    if (a.attr && a.stat.startsWith('resist_')) resists[a.attr] = Math.round(((resists[a.attr]||0)+val)*1000)/1000;
    else stats[a.stat] = Math.round(((stats[a.stat]||0)+val)*1000)/1000;
    tags[key] = a.tag;
    return a.tag && a.tag.startsWith('SUB_BUCKET');
  }
  function rollFrom(pool, used, stats, resists, tags, level, mul, quality='normal') {
    let p = available(pool, used);
    if (!p.length) return false;
    return addFlat(stats, resists, tags, used, pickRandom(p), level, mul, null, quality);
  }

  function rollFixedAffixes(keys, itemPower, mul=1, high=false, quality=null) {
    let stats = {}, resists = {}, tags = {}, used = new Set(), lucky = false, q = quality || rollQuality(itemPower);
    for (const key of keys || []) {
      let a = AFFIX_BY_STAT[key];
      if (!a) continue;
      let rf = high && q !== 'primal' ? .85 + Math.random() * .15 : null;
      lucky = addFlat(stats, resists, tags, used, a, itemPower, mul, rf, q) || lucky;
    }
    return { stats, resists, tags, isLucky:lucky, quality:q, qualityName:qualityName(q) };
  }

  function rollGoldAffixes(level, mul, slot, cls, quality=null) {
    let stats = {}, resists = {}, tags = {}, used = new Set(), lucky = false, hasExtra = false, surv = slotPool(slot, survivalPool(slot)), q = quality || rollQuality(level);
    let add = slotPool(slot, ADDITIVE_AFFIXES), multi = slotPool(slot, MULTIPLICATIVE_AFFIXES), res = slotPool(slot, RESIST_AFFIXES);
    let offensePool = slot==='weapon'||slot==='amulet'||slot==='ring' ? add : add.concat(surv);
    lucky = rollFrom(surv, used, stats, resists, tags, level, mul, q) || lucky;
    lucky = rollFrom(offensePool, used, stats, resists, tags, level, mul, q) || lucky;
    lucky = rollFrom(add.concat(surv), used, stats, resists, tags, level, mul, q) || lucky;
    let fourthPool = Math.random() < .2 ? multi : add.concat(surv);
    lucky = rollFrom(fourthPool, used, stats, resists, tags, level, mul, q) || lucky;
    if (Math.random() < .2 || q === 'primal') {
      hasExtra = true;
      let fifthPool = Math.random() < .25 ? multi : add.concat(surv, multi);
      lucky = rollFrom(fifthPool, used, stats, resists, tags, level, mul, q) || lucky;
    }
    if (slot !== 'weapon' && Math.random() < .45) rollFrom(res, used, stats, resists, tags, level, mul, q);
    return { stats, resists, tags, isLucky:lucky, hasExtra, quality:q, qualityName:qualityName(q) };
  }

  const UNIQUE_ASPECTS = {
    'unique-saint-nail': {id:'aspect_saint_nail',name:'天谴重击',desc:'大蒜光环转为每秒强制引爆；秘境进度每10%伤害连乘[x]5%。',tag:'UNIQUE_ASPECT'},
    'unique-thunder-bow': {id:'aspect_thunder_bow',name:'高压雷链',desc:'回旋飞斧命中20%分裂雷链锁定精英/Boss，附加35%雷链伤害并施加易伤[x]35%。',tag:'UNIQUE_ASPECT'},
    'unique-star-tome': {id:'aspect_star_tome',name:'星界黑洞',desc:'魔法飞弹穿透生成黑洞，吸附怪物并造成30%奥术伤害。',tag:'UNIQUE_ASPECT'},
    'unique-plague-bell': {id:'aspect_plague_bell',name:'疫病加速',desc:'幽魂刃舞对DoT目标暴击伤害[x]55%，击杀精英短暂加快DoT跳字。',tag:'UNIQUE_ASPECT'},
    'unique-blaze-core': {id:'aspect_blaze_core',name:'无限火海',desc:'陨星火海可叠加，Boss停留每秒火焰伤害[x]8%叠加，最高[x]60%。',tag:'UNIQUE_ASPECT'},
    'unique-void-lantern': {id:'aspect_void_lantern',name:'虚空超载',desc:'秘境进度每10%获得[x]8%独立攻速与移速，最高5层。',tag:'UNIQUE_ASPECT'},
    'unique-dragon-heart': {id:'aspect_dragon_heart',name:'龙心殉爆',desc:'击杀精英时引发大范围殉爆，杂兵死亡有概率额外推进少量秘境进度。',tag:'UNIQUE_ASPECT'},
    'unique-elite-boots': {id:'aspect_elite_boots',name:'猎手进度',desc:'全伤害随秘境进度提高，每10%进度获得[x]4%独立乘区，最高[x]40%。',tag:'UNIQUE_ASPECT'},
    'unique-moon-crown': {id:'aspect_moon_crown',name:'寒月护盾',desc:'冰霜法球暴击转化4%生命护盾，护盾存在时免疫控制并提升飞行速度。',tag:'UNIQUE_ASPECT'},
    'unique-blood-plate': {id:'aspect_blood_plate',name:'血契反击',desc:'生命每降低10%进化技能全伤害[x]5%(最高6层)，低血触发45%真实吸血。',tag:'UNIQUE_ASPECT'},
    'unique-clock-gloves': {id:'aspect_clock_gloves',name:'逆时冷却',desc:'弹幕暴击8%概率使冷却中技能CD减少1秒，最短间隔0.25秒。',tag:'UNIQUE_ASPECT'},
    'unique-rose-mirror': {id:'aspect_rose_mirror',name:'欲念蓄池',desc:'吸收28%承伤存入欲念池，下次攻击以[x]160%喷溅；蔷薇6件联动吸收42%并提升为[x]220%。',tag:'UNIQUE_ASPECT'},
    'unique-abyss-mask': {id:'aspect_abyss_mask',name:'深渊斩杀',desc:'普通怪<25%、精英<15%、Boss<10%时触发致命暴击斩杀。',tag:'UNIQUE_ASPECT'},
    'unique-golem-soul': {id:'aspect_golem_soul',name:'岩盾守护',desc:'站立释放技能获得独立全减伤，最高35%，并将荆棘按150%加入弹幕。',tag:'UNIQUE_ASPECT'},
    'unique-demon-horn': {id:'aspect_demon_horn',name:'魔王降临',desc:'Boss激活时弹幕翻倍，对Boss独立伤害[x]35%。',tag:'UNIQUE_ASPECT'},
    'unique-pale-ring': {id:'aspect_pale_ring',name:'苍白相位',desc:'致命伤免死进入2.5秒相位，期间技能独立伤害[x]60%。',tag:'UNIQUE_ASPECT'},
    'unique-faith-boots': {id:'aspect_faith_boots',name:'黎明道路',desc:'圣光长枪留下圣痕道路，踩上移速+40%、施法频率独立连乘[x]30%。',tag:'UNIQUE_ASPECT'},
    'unique-hunt-quiver': {id:'aspect_hunt_quiver',name:'无尽箭匣',desc:'匕首雨/风裂刃按额外攻速乘算分裂，每10%攻速弹幕+20%，最多+60%。',tag:'UNIQUE_ASPECT'},
  };

  function tagLabel(tag) {
    if (tag === 'ADDITIVE_POOL') return '[+]';
    if (tag && tag.startsWith('SUB_BUCKET')) return '[x]';
    if (tag && tag.startsWith('UNIQUE_ASPECT')) return '[x]';
    return '';
  }
  function uniqueAspectDesc(baseId) { return UNIQUE_ASPECTS[baseId] || null; }

  return {
    SURVIVAL_AFFIXES, ADDITIVE_AFFIXES, MULTIPLICATIVE_AFFIXES, RESIST_AFFIXES,
    UNIQUE_ASPECTS, RES, RES_CN, TEMPLATE_AFFIXES,
    rollGoldAffixes, rollFixedAffixes, tagLabel, uniqueAspectDesc, scaleValue, powerScale, powerTier, rollQuality, qualityName, pickRandom
  };
})();
