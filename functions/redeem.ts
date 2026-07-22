const PROGRESS_KEY = 'secure_progress_v1';
const CODES: any = {
  '版本奖励': { id: 'version-reward-20260618', core: 100, message: '兑换成功：魔核 +100' },
  '更新补偿': { id: 'update-compensation-20260620', core: 150, message: '兑换成功：魔核 +150' },
  '误删补偿': { id: 'delete-compensation-5090-20260620', sacrifice5090: true, message: '兑换成功：老杨的5090 已进入装备栏' },
  'Tomkk': { id: 'tomkk-local-20260618', core: 300, seasonLevel: 20, message: '兑换成功：赛季等级升至 20，魔核 +300' },
  'Tomkk666': { id: 'tomkk-rift-tickets-20260616', riftKeys: 50, message: '兑换成功：大秘境门票 +50' },
  'Tomkk白衣胜雪': { id: 'tomkk-baiyi-20260615', gold: 6666, core: 100, message: '兑换成功：灵魂金币 +6666，魔核 +100' },
  '琦琦专属礼包': { id: 'scythe-gift-20260617', scytheGift: true, userId: '4701f6f4-6d69-4cd8-8dbe-0f20f2668162', message: '兑换成功：琦琦冥月套装 4 件、魔核 +400、金币 +20000、门票 +40、赛季等级直升 20' },
  '魔核特供': { id: 'core-grant-20260617', core: 400, userId: '835bd1b2-f27a-4490-aa59-f3d1dbde0d16', message: '兑换成功：魔核 +400' },
};

export default async function (request: any, ctx: any) {
  if (!ctx.user?.id) throw new Error('请登录后再兑换奖励');
  const code = String(request.body?.code ?? '').trim().slice(0, 40);
  const key = Object.keys(CODES).find((k) => k.toLowerCase() === code.toLowerCase());
  const reward = key ? CODES[key] : null;
  if (!reward) throw new Error('兑换码无效');
  const userId = String(ctx.user.id || '');
  if (reward.userId && reward.userId !== userId) throw new Error('该兑换码仅限指定用户领取');

  const p = normalize((await ctx.kv.get(PROGRESS_KEY))?.value);
  if (p.redeem[reward.id]) return { applied: false, message: '该兑换码已使用过', state: publicState(p) };
  applyReward(p, reward);
  p.redeem[reward.id] = new Date().toISOString();
  await ctx.kv.put(PROGRESS_KEY, p);
  return { applied: true, message: reward.message, state: publicState(p), clientGrant: clientGrant(reward) };
}

function normalize(v: any) {
  const p = v && typeof v === 'object' ? v : {};
  p.soulGold = num(p.soulGold, 0, 999999999); p.soulCore = num(p.soulCore, 0, 9999999);
  p.grants = obj(p.grants); p.classes = obj(p.classes); p.rift = obj(p.rift); p.season = obj(p.season); p.shop = obj(p.shop); p.redeem = obj(p.redeem);
  p.rift.keys = num(p.rift.keys ?? 3, 0, 999999); p.rift.maxLayer = num(p.rift.maxLayer ?? 1, 1, 150); p.rift.dust = num(p.rift.dust, 0, 999999999); p.rift.best = obj(p.rift.best); p.rift.grants = obj(p.rift.grants);
  p.season.level = num(p.season.level ?? 1, 1, 20); p.season.xp = num(p.season.xp, 0, 999999999); p.season.totalXp = num(p.season.totalXp, 0, 999999999);
  p.shop.owned = obj(p.shop.owned); p.shop.sacrifices = obj(p.shop.sacrifices);
  return p;
}
function obj(v: any) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function num(v: any, min: number, max: number) { v = Math.floor(Number(v) || 0); return Math.max(min, Math.min(max, v)); }
function applyReward(p: any, r: any) {
  p.soulGold += num(r.gold, 0, 100000); p.soulCore += num(r.core, 0, 5000);
  if (r.riftKeys) p.rift.keys += num(r.riftKeys, 0, 1000);
  if (r.seasonLevel) { p.season.level = Math.max(p.season.level, Math.min(20, num(r.seasonLevel, 1, 20))); p.season.xp = 0; }
  if (r.scytheGift) { p.soulGold += 20000; p.soulCore += 400; p.rift.keys += 40; p.season.level = Math.max(p.season.level, 20); }
  if (r.sacrifice5090) p.shop.sacrifices['sacrifice-laoyang-5090'] = new Date().toISOString();
}
function publicState(p: any) { return { ok: true, meta: { soulGold: p.soulGold, soulCore: p.soulCore, grants: p.grants, classes: p.classes }, rift: { keys: p.rift.keys, maxLayer: p.rift.maxLayer, best: p.rift.best, dust: p.rift.dust, grants: p.rift.grants }, season: { currentSeason: 1, started: { 1: true }, seasons: { 1: { level: p.season.level, xp: p.season.xp, totalXp: p.season.totalXp } } }, shop: p.shop } }
function clientGrant(r: any) { return { sacrifice5090: r.sacrifice5090 === true, scytheGift: r.scytheGift === true, id: r.id }; }
