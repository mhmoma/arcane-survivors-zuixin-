(() => {
  'use strict';
  const COLS = 8;
  const ROWS = 8;
  const SRC = './assets/generated/cultivation-skill-icons-sheet-r1.webp?v=missile-3f-aim-r20-20260723191500';
  const INDEX = {
    garlic: 0, // 金钟罡域
    holyLance: 1, // 破邪金光
    bloodNova: 2, // 血煞归元
    flameWheel: 3, // 离火法轮
    missile: 4, // 灵符飞剑
    fireball: 5, // 三昧真火
    iceorb: 6, // 玄冰灵珠
    meteorShard: 7, // 天火坠星
    thunderChain: 8, // 紫霄雷链
    arcaneBeam: 9, // 太乙玄光
    soulOrb: 10, // 阴魂引
    crystalSpike: 11, // 地脉晶锋
    voidRift: 12, // 虚空归墟
    lightning: 13, // 九霄雷诀
    axe: 14, // 御剑回旋
    shadowBlade: 15, // 无相剑气
    windCutter: 16, // 青罡风刃
    daggerRain: 17, // 万剑归宗
    moonSlash: 18, // 太阴月刃
    poisonCloud: 19, // 万蛊瘴
    sandVortex: 20, // 黄泉沙劫
    orbit: 21, // 北斗剑阵
    lustSplash: 22, // 红尘反照
    lustKiss: 23, // 飞花问心
    lustPrayer: 24, // 莲台心域
    lustOverflow: 25, // 七情潮生
    scytheArc: 26, // 幽冥月斩
    bloodReap: 27, // 血河轮转
    wraithBlade: 28, // 斩魂飞刃
    reaperChain: 29, // 锁魂链
    graveRift: 30, // 九幽裂隙
    quickShot: 31, // 飞墨点锋
    ricochetBullet: 32, // 游墨连环
    shotgunRoll: 33, // 泼墨闪身
    fireBomb: 34, // 朱砂爆墨
    foot: 35, // 凌云步
    armor: 36, // 金刚不坏
    focus: 37, // 抱元守一
    magnet: 38, // 聚灵诀
    regen: 39, // 长生诀
    flailSpin: 40, // 降魔轮舞
    shieldOrbit: 41, // 乾坤护轮
    sanctuaryDiscipline: 42, // 金身法则
    thornVow: 43, // 荆棘道誓
    judgmentMark: 44, // 天劫印
    holyWard: 45, // 金刚护体
    judgmentLance: 46, // 万剑诛邪
    bloodOath: 47, // 血海金身
    dragonMeteor: 48, // 九龙天火
    thunderRing: 49, // 九霄雷域
    prismFinale: 50, // 太乙分光
    stormAxe: 51, // 御剑风暴
    skyTempest: 52, // 青冥剑域
    hunterBarrage: 53, // 万剑朝宗
    demonSpring: 54, // 红尘莲泉
    fallenSanctum: 55, // 六欲莲台
    ecstasyOffering: 56, // 七情焚心
    deathWaltz: 57, // 幽月轮回
    bloodScythe: 58, // 血河祭轮
    soulReaper: 59, // 斩魂天刃
    silverExecution: 60, // 万墨连锋阵
    deathRicochet: 61, // 墨海连环
    scorchedBarrage: 62, // 雷火天罗
  };
  function skillIconIndex(id) {
    if (id == null) return -1;
    if (Object.prototype.hasOwnProperty.call(INDEX, id)) return INDEX[id];
    return -1;
  }
  function skillIcon(id) {
    const i = skillIconIndex(id);
    if (i < 0) return '';
    const x = (i % COLS) * (100 / (COLS - 1));
    const y = Math.floor(i / COLS) * (100 / (ROWS - 1));
    return `<span class="skillIconSprite" style="background-position:${x}% ${y}%" title="${id}"></span>`;
  }
  window.CultivationSkillIcons = { SRC, COLS, ROWS, INDEX, skillIcon, skillIconIndex };
  window.skillIcon = skillIcon;
  window.skillIconIndex = skillIconIndex;
  console.info('技能图标图集已启用', Object.keys(INDEX).length, '枚');
})();
