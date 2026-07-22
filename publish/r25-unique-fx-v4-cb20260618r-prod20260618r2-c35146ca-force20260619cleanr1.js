'use strict';
window.GameModules = window.GameModules || {};
window.GameModules.uniqueFx = (() => {
  const H = window.GameModules.uniqueFxShared;
  const U = window.GameModules.uniqueFxUpdate;
  function scytheShieldOnHit(hits) {
    if (H.hasSet('reaper-waltz', 6) && hits > 0) {
      let p = S?.player;
      if (p) {
        p.shield = Math.min(p.max, (p.shield || 0) + p.max * .01 * hits);
        if (p.shield >= p.max && (S._deathWaltzTimer || 0) <= 0) S._deathWaltzTimer = 5;
      }
    }
  }
  function getMoveBonus() { return (S?._voidBonus || 0) + (S?._faithTrailBonus ? .40 : 0); }
  function getAtkBonus() { return (S?._voidBonus || 0) + (S?._faithTrailBonus || 0); }
  function getPaleDamageMul() { return H.hasUnique('unique-pale-ring') && S._paleTimer > 0 ? 1.60 : 1; }
  function getSoulShadowCrit() {
    let bonus = S?._soulShadowCrit || 0;
    if (H.hasSet('soul-shadow', 6) && (S?.player?.shield || 0) > 0) bonus += .12;
    return Math.min(.90, bonus);
  }
  function bloodPlateStealMul(id) {
    let p = S?.player;
    if (!p || !H.hasUnique('unique-blood-plate') || p.hp / p.max >= .35) return 0;
    return H.isEvolvedDamageSkill(id) ? .45 : 0;
  }
  function getThunderVuln(e) {
    if (e._thunderVuln > 0) {
      e._thunderVuln -= 1/60;
      return 1.35;
    }
    return 1;
  }
  function getVioletVuln(e) {
    if (H.hasSet('violet-hymn') && (e.elite || e.boss) && (e._violetVuln || 0) > 0) return e._violetVuln >= 3 ? 1.40 : 1 + e._violetVuln * .14;
    return 1;
  }
  function bloodReapSplit(x, y, dmg) {
    if (!H.hasSet('blood-reaping')) return;
    let pool = window.nearbyEnemies ? window.nearbyEnemies(x, y, 240) : S.enemies, elites = pool.filter(e => !e.dead && (e.elite || e.boss) && Math.hypot(e.x - x, e.y - y) < 220);
    for (let i = 0; i < Math.min(3, elites.length); i++) {
      let target = elites[i];
      window.burstAt?.('blood', target.x, target.y, dmg * .45, 42, 0, '#a78bfa', 80, .28);
      window.dealDamage?.(target, dmg * .45, true, 'bloodReap');
      window.dealDamage?.(target, dmg * .45, true, 'bloodReap');
      S.parts.push({x:target.x,y:target.y,vx:0,vy:0,life:.45,max:.45,a:1,c:'#a78bfa',aspectRing:55});
    }
  }
  function holyLanceTrail(x, y) {
    if (!H.hasUnique('unique-faith-boots')) return;
    S.artFx.push({ x, y, type:'holy', kind:'holy', color:'#fde68a', life:4, max:4, size:32, rad:40, trail:true, faithTrail:true, dmg:0 });
  }
  function resetRunState() {
    S._roseStored = 0;
    S._paleUsed = false;
    S._paleTimer = 0;
    S._voidBonus = 0;
    S._deathShieldFull = false;
    S._deathWaltzTimer = 0;
    S._dotSpeed = 1;
    S._soulShadowCd = 0;
    S._soulShadowResetAt = 0;
    S._soulShadowCrit = 0;
    S._soulArmor = 0;
    S._soulArmorTimer = 0;
    S._soulShieldAt = 0;
    S._soulArmorHitAt = 0;
    S._soulLastStandAt = 0;
    S._fear = 0;
    S._fearGuardFxAt = 0;
    S._plagueDotRush = 0;
    S._faithTrailBonus = 0;
    S._clockCdAt = 0;
  }
  function axeReturnReset(axe) {
    if (!H.hasSet('cyclone-axe')) return;
    if (S.cd.windCutter > 0) S.cd.windCutter = 0;
    S.artFx.push({ x:axe.x, y:axe.y, type:'wind', kind:'windCutter', color:'#67e8f9', life:1.2, max:1.2, size:80, rad:56, dmg:axe.dmg*.28, spin:true });
    S.parts.push({x:axe.x,y:axe.y,vx:0,vy:0,life:.5,max:.5,a:1,c:'#67e8f9',aspectRing:65});
  }
  function huntQuiverCount(baseCount, skillId) {
    if (!H.hasUnique('unique-hunt-quiver') || (skillId !== 'daggerRain' && skillId !== 'windCutter')) return baseCount;
    let extraAtk = H.eqStat('atkSpeed') + (S._voidBonus || 0), extraCount = Math.min(.60, Math.floor(extraAtk * 10) * .20);
    return baseCount + Math.floor(extraCount * baseCount);
  }
  return {
    hasUnique: H.hasUnique, hasSet: H.hasSet, riftProgress: H.riftProgress, resetRunState,
    aspectDamageChain: H.aspectDamageChain, aspectAfterDamage: H.aspectAfterDamage, aspectDefend: H.aspectDefend,
    aspectSkillMods: H.aspectSkillMods, aspectOnKill: H.aspectOnKill, aspectUpdate: U.aspectUpdate,
    aspectArtFxTick: U.aspectArtFxTick, aspectProjectileHit: U.aspectProjectileHit,
    scytheShieldOnHit, bloodReapSplit, holyLanceTrail, axeReturnReset, huntQuiverCount,
    getMoveBonus, getAtkBonus, getPaleDamageMul, getSoulShadowCrit, bloodPlateStealMul, getThunderVuln, getVioletVuln
  };
})();
window.UniqueFx = window.GameModules.uniqueFx;
