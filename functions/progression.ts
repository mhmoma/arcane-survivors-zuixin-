const KEY = 'secure_progress_v1';
const RIFT_MAX = 150;
const COST_GROWTH = 1.72;
const CLASSES = ['paladin','mage','ranger','lewdSaintess','scytheMaiden','gunslinger'];
const BASE: any = [['hp',10,30,0,null],['damage',10,50,0,null],['speed',8,45,0,null],['magnet',8,40,0,null],['startXp',5,55,0,null],['gold',10,45,0,null]];
const SPEC: any = { paladin:[['aura',5,80,24,'damage'],['lance',5,90,24,'damage'],['nova',5,90,24,'damage'],['guard',4,110,24,'lance'],['seal',4,135,28,'aura']], mage:[['missile',5,80,24,'damage'],['fire',5,90,24,'damage'],['thunder',5,90,24,'damage'],['beam',4,110,24,'fire'],['overload',4,135,28,'thunder']], ranger:[['axe',5,80,24,'damage'],['wind',5,90,24,'damage'],['dagger',5,90,24,'damage'],['moon',4,110,24,'wind'],['mark',4,135,28,'wind']], lewdSaintess:[['splash',5,90,24,'damage'],['kiss',5,90,24,'damage'],['prayer',5,95,24,'damage'],['desire',4,120,26,'prayer'],['overflow',4,145,30,'splash']], scytheMaiden:[['arc',5,90,24,'damage'],['reaper',5,90,24,'damage'],['soul',5,95,24,'damage'],['dance',4,120,26,'reaper'],['execute',4,145,30,'arc']], gunslinger:[['quick',5,85,24,'damage'],['ricochet',5,90,24,'damage'],['roll',5,90,24,'damage'],['bomb',4,115,26,'ricochet'],['gunmaster',4,140,30,'quick']] };

export default async function (request: any, ctx: any) {
  if (!ctx.user?.id) throw new Error('请登录后再进行成长、商店或结算操作');
  const body = request.body ?? {}, args = body.args ?? {};
  const p = await read(ctx);
  switch (body.method) {
    case 'init': return publicState(p);
    case 'buyDlc': return await save(ctx, buyDlc(p, args));
    case 'buyNode': return await save(ctx, buyNode(p, args));
    case 'spend': return await save(ctx, spend(p, args));
    case 'grantCurrency': throw new Error('currency grants must use redeem or verified settlement');
    case 'runReward': return await save(ctx, runReward(p, args));
    case 'runXp': return await save(ctx, runXp(p, args));
    case 'startRift': return await save(ctx, startRift(p, args));
    case 'finishRift': return await save(ctx, finishRift(p, args));
    case 'addRiftKeys': throw new Error('rift key grants must use shop or redeem');
    case 'shopBuy': return await save(ctx, shopBuy(p, args));
    default: throw new Error('unknown progression method');
  }
}

async function read(ctx: any) { return normalize((await ctx.kv.get(KEY))?.value); }
async function save(ctx: any, p: any) { await ctx.kv.put(KEY, p); return publicState(p); }
function normalize(v: any) {
  const p = v && typeof v === 'object' ? v : {};
  p.soulGold = num(p.soulGold, 0, 999999999); p.soulCore = num(p.soulCore, 0, 9999999);
  p.grants = obj(p.grants); p.classes = obj(p.classes); p.rift = obj(p.rift); p.season = obj(p.season); p.shop = obj(p.shop); p.redeem = obj(p.redeem);
  for (const c of CLASSES) { const cd = p.classes[c] = obj(p.classes[c]); cd.upgrades = obj(cd.upgrades); cd.unlocks = obj(cd.unlocks); }
  p.rift.keys = num(p.rift.keys ?? 3, 0, 999999); p.rift.maxLayer = num(p.rift.maxLayer ?? 1, 1, RIFT_MAX); p.rift.dust = num(p.rift.dust, 0, 999999999); p.rift.best = obj(p.rift.best); p.rift.grants = obj(p.rift.grants);
  p.season.started = p.season.started !== false; p.season.level = num(p.season.level ?? 1, 1, 20); p.season.xp = num(p.season.xp, 0, 999999999); p.season.totalXp = num(p.season.totalXp, 0, 999999999); p.season.xpSigs = obj(p.season.xpSigs);
  p.shop.owned = obj(p.shop.owned); p.shop.sacrifices = obj(p.shop.sacrifices);
  return p;
}
function publicState(p: any) { return { ok: true, meta: { soulGold: p.soulGold, soulCore: p.soulCore, grants: p.grants, classes: p.classes }, rift: { keys: p.rift.keys, maxLayer: p.rift.maxLayer, best: p.rift.best, dust: p.rift.dust, grants: p.rift.grants, activeRun: p.rift.activeRun ? { layer: p.rift.activeRun.layer, startedAt: p.rift.activeRun.startedAt } : null }, season: { currentSeason: 1, started: { 1: true }, seasons: { 1: { level: p.season.level, xp: p.season.xp, totalXp: p.season.totalXp, lastGain: p.season.lastGain || 0, lastUps: p.season.lastUps || 0 } } }, shop: p.shop, lastRiftResult: p.rift.lastResult || null }; }
function obj(v: any) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function num(v: any, min: number, max: number) { v = Math.floor(Number(v) || 0); return Math.max(min, Math.min(max, v)); }
function nodes(c: string) { return BASE.concat(SPEC[c] || []).map((x: any) => ({ id: x[0], max: x[1], base: x[2], core: x[3] || 0, pre: x[4] || null })); }
function cls(p: any, c: string) { if (!CLASSES.includes(c)) throw new Error('invalid class'); return p.classes[c]; }
function level(p: any, c: string, id: string) { return num(cls(p, c).upgrades[id], 0, 999); }
function node(c: string, id: string) { return nodes(c).find((n: any) => n.id === id); }
function cost(p: any, c: string, id: string) { const n = node(c, id), lv = level(p, c, id); return !n || lv >= n.max ? 0 : Math.round(n.base * Math.pow(COST_GROWTH, lv)); }
function buyDlc(p: any, a: any) { const c = String(a.classId || a.cls || ''); const d = cls(p, c); if (c !== 'lewdSaintess' || d.unlocks.dlc) return p; if (p.soulCore < 200) throw new Error('魔核不足'); p.soulCore -= 200; d.unlocks.dlc = true; return p; }
function buyNode(p: any, a: any) { const c = String(a.classId || a.cls || ''), id = String(a.id || ''); const n = node(c, id), d = cls(p, c); if (!n) throw new Error('invalid node'); if (n.pre && level(p, c, n.pre) <= 0) throw new Error('需要先升级前置节点'); if (n.core && !d.unlocks[id] && level(p, c, id) <= 0) { if (p.soulCore < n.core) throw new Error('魔核不足'); p.soulCore -= n.core; d.unlocks[id] = true; return p; } const lv = level(p, c, id), price = cost(p, c, id); if (lv >= n.max) throw new Error('已满级'); if (p.soulGold < price) throw new Error('灵魂金币不足'); p.soulGold -= price; d.upgrades[id] = lv + 1; d.unlocks[id] = true; return p; }
function spend(p: any, a: any) { const gold = num(a.gold, 0, 9999999), core = num(a.core, 0, 999999); if (p.soulGold < gold || p.soulCore < core) throw new Error('资源不足'); p.soulGold -= gold; p.soulCore -= core; return p; }
function grantCurrency(p: any, a: any) { const id = String(a.id || '').slice(0, 80); if (!id) throw new Error('invalid grant'); if (p.grants[id]) return p; p.grants[id] = new Date().toISOString(); p.soulGold += num(a.gold, 0, 100000); p.soulCore += num(a.core, 0, 2000); return p; }
function rewardGold(p: any, r: any) { const c = String(r.classId || r.cls || 'paladin'), base = num(r.gold, 0, 20000), time = Math.floor(num(r.time, 0, 86400) / 30) * 10, boss = num(r.bossKills, 0, 80) * 80, goals = num(r.goals, 0, 3) * 40, lv = num(r.level, 1, 300), lvl = lv >= 30 ? 100 : lv >= 20 ? 60 : lv >= 10 ? 30 : 0, bonus = (level(p, c, 'gold') || 0) * .05; return Math.min(60000, base + time + boss + goals + lvl + Math.round((base + time + boss + goals + lvl) * bonus)); }
function runReward(p: any, a: any) { const r = verifiedRun(p, a); if (r) { const sig = `reward:${r.id || r.at || ''}`; if (p.lastRunSig === sig) return p; p.lastRunSig = sig; p.soulGold += rewardGold(p, { ...r, gold: 0, time: r.time, bossKills: r.bossKills, level: r.level, endlessLayer: r.layer, classId: r.classId }); p.soulCore += num(r.bossKills, 0, 80) + (r.win ? 2 : 0); return p; } if (num(a.endlessLayer,0,1000) > 0) throw new Error('秘境奖励必须使用已验证结算记录'); const endlessLayer = 0, sig = JSON.stringify([num(a.time,0,86400),num(a.bossKills,0,100),num(a.level,1,300),!!a.win,endlessLayer]); if (p.lastRunSig === sig) return p; p.lastRunSig = sig; p.soulGold += rewardGold(p, a); p.soulCore += num(a.bossKills, 0, 80) + (a.win ? 2 : 0); if (a.win === true) p.rift.keys += 8; return p; }
function runXp(p: any, a: any) { const r = verifiedRun(p, a); if (r) { const sig = `xp:${r.id || r.at || ''}`; if (p.season.xpSigs[sig]) return p; p.season.xpSigs[sig] = new Date().toISOString(); const gain = Math.min(50000, Math.max(10, num(r.kills,0,20000) + num(r.bossKills,0,80) * 85 + Math.floor(num(r.time,0,86400) / 10) * 8 + (r.win ? 500 : 0) + num(r.layer,0,300) * 180)); addXp(p, gain); return p; } if (num(a.endlessLayer,0,1000) > 0) throw new Error('秘境经验必须使用已验证结算记录'); const gain = Math.min(50000, Math.max(10, num(a.kills,0,20000) + num(a.bossKills,0,80) * 85 + Math.floor(num(a.time,0,86400) / 10) * 8 + (a.win ? 500 : 0))); addXp(p, gain); return p; }
function verifiedRun(p: any, a: any) { const r = p.rift?.pendingBoard; if (!r || r.win !== true) return null; return { ...r, layer: num(r.layer,1,RIFT_MAX), time: num(r.time,0,900), level: num(r.level,1,300), kills: num(r.kills,0,20000), bossKills: num(r.bossKills,0,80), classId: cleanId(r.classId,24), win: true }; }
function addXp(p: any, gain: number) { p.season.xp += gain; p.season.totalXp += gain; let ups = 0; while (p.season.level < 20 && p.season.xp >= need(p.season.level)) { p.season.xp -= need(p.season.level); p.season.level++; ups++; } p.season.lastGain = gain; p.season.lastUps = ups; }
function need(lv: number) { return lv >= 20 ? 0 : Math.round(80 + lv * lv * 22 + lv * 38); }
function startRift(p: any, a: any) { const layer = num(a.layer, 1, RIFT_MAX); if (layer > p.rift.maxLayer) throw new Error(`当前只解锁到 ${p.rift.maxLayer} 层`); if (layer >= 10) { if (p.rift.keys < 1) throw new Error('秘境门票不足'); p.rift.keys--; } const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; p.rift.activeRun = { token, layer, startedAt: Date.now() }; return p; }
function finishRift(p: any, a: any) { const ar = p.rift.activeRun; if (!ar) throw new Error('秘境开局记录无效或已结算'); const layer = num(a.layer, 1, RIFT_MAX), win = a.win === true; if (layer !== ar.layer) throw new Error('秘境层数不匹配'); const wall = Math.floor((Date.now() - Number(ar.startedAt || 0)) / 1000); const minClear = 20 + Math.floor(layer * 0.55); if (win && wall < minClear) throw new Error('通关时间异常'); if (win && wall > 930) throw new Error('秘境结算已超时'); const time = Math.min(900, Math.max(0, wall)); const classId = cleanId(a.classId, 24); const maxLevel = Math.min(300, 30 + Math.floor(time / 5) + layer); const level = win ? maxLevel : Math.min(maxLevel, 30 + Math.floor(time / 8)); const kills = win ? 1200 : Math.min(num(a.kills, 0, 20000), Math.floor(time * 30)); const gainDust = win ? Math.round(8 + layer * 1.65) : Math.floor(layer / 4); const ticketDrop = win && layer >= 10 && stableChance(String(ar.token || ar.startedAt), 30); p.rift.dust += gainDust; if (win) { p.rift.maxLayer = Math.max(p.rift.maxLayer, Math.min(RIFT_MAX, layer + 10)); if (ticketDrop) p.rift.keys++; const b = p.rift.best[layer]; if (!b || time < b.time) p.rift.best[layer] = { time, classId, at: Date.now() }; } const result = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, layer, time, win, level, kills, bossKills: win ? 1 : 0, classId, at: new Date().toISOString(), consumed: false }; p.rift.lastResult = { layer, time, win, level, kills, bossKills: result.bossKills, classId, at: result.at }; p.rift.pendingBoard = win ? result : null; delete p.rift.activeRun; return p; }
function cleanId(v: any, len: number) { return String(v ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, len); }
function stableChance(s: string, pct: number) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 100 < pct; }
function addRiftKeys(p: any, a: any) { const id = String(a.id || '').slice(0, 80), amount = num(a.amount, 0, 1000); if (id) { if (p.rift.grants[id]) return p; p.rift.grants[id] = new Date().toISOString(); } p.rift.keys += amount; return p; }
function shopBuy(p: any, a: any) { const item = String(a.item || ''), clsId = String(a.classId || ''), id = String(a.id || ''); if (item === 'ticket') { spend(p, { gold: 2000 }); p.rift.keys++; return p; } if (item === 'sacrifice') { if (p.shop.sacrifices[id]) return p; spend(p, { core: 150 }); p.shop.sacrifices[id] = new Date().toISOString(); return p; } if (item === 'costume') { if (!CLASSES.includes(clsId) || !id) throw new Error('invalid costume'); p.shop.owned[clsId] = obj(p.shop.owned[clsId]); if (p.shop.owned[clsId][id]) return p; spend(p, { core: 200 }); p.shop.owned[clsId][id] = new Date().toISOString(); return p; } throw new Error('unknown shop item'); }
