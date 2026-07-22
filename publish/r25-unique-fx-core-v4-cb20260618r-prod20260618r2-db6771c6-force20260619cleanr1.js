'use strict';
window.GameModules = window.GameModules || {};
window.GameModules.uniqueFxShared = (() => {
  function hasUnique(baseId) {
    let eq = window.Equipment?.equippedItems?.(S?.player?.cls) || [];
    return eq.some(it => it.baseId === baseId);
  }
  function hasSet(id, n) { return window.hasSet?.(id, n) || (S?.equipStats?.setPowers?.[id] || 0) >= (n || 6); }
  function eqStat(k) { return S?.equipStats?.[k] || 0; }
  function dotFx(f) { return !!(f?.burn || f?.poison || f?.rift); }
  function isEvolvedDamageSkill(id) {
    if (typeof EVOLUTIONS === 'undefined' || !S?.evolutions) return false;
    return Object.entries(EVOLUTIONS).some(([eid, e]) => S.evolutions[eid] && e.main === id);
  }
  function riftProgress() {
    if (S?.rift?.active) return Math.min(1, (S.rift.progress || 0) / 2000);
    if (!S?.endless) return 0;
    let layer = S.endlessLayer || 0, gap = window.endlessBossGap?.(layer) || 320;
    let kills = (S.kills || 0) - (S.endlessBossStartKills || 0);
    return Math.min(1, kills / gap);
  }
  function fearCap() { return hasUnique('sacrifice-laoyang-5090') ? eqStat('fearMax') : 0; }
  function fearNearbyCount(p, rad=260) { return (S?.enemies || []).filter(e => !e.dead && (e._fear || 0) > 0 && Math.hypot(e.x - p.x, e.y - p.y) < rad + e.r).length; }
  function gainFear(v) { if (v <= 0) return; S._fear = Math.min(fearCap(), (S._fear || 0) + v); }
  function markFear(e, t=4) { if (e) e._fear = Math.max(e._fear || 0, t); }
  function aspectDamageChain(d, id, e) {
    let p = S?.player;
    if (!p || !id) return d;
    if (hasUnique('unique-abyss-mask') && e.hp > 0) {
      let hpR = e.hp / e.max, thresh = e.boss ? .10 : e.elite ? .15 : .25;
      if (hpR <= thresh) { d = e.hp + 1; e._abyssExecute = true; S.parts.push({x:e.x,y:e.y,vx:0,vy:0,life:.6,max:.6,a:1,c:'#a78bfa',aspectRing:80}); }
    }
    if (hasUnique('unique-elite-boots')) {
      let prog = riftProgress(), mul = 1 + Math.min(.40, prog * .40);
      d *= mul;
    }
    if (hasUnique('unique-blood-plate') && isEvolvedDamageSkill(id)) {
      let loss = Math.min(6, Math.floor((1 - p.hp / p.max) * 10));
      if (loss > 0) d *= 1 + loss * .05;
    }
    if (hasUnique('unique-demon-horn') && e.boss) d *= 1.35;
    if (hasUnique('unique-plague-bell') && id === 'wraithBlade' && e._nextCrit && (e.slow > 0 || e._dotMarked > 0)) d *= 1.55;
    if (hasUnique('unique-golem-soul') && eqStat('thorns') > 0 && ['missile','holy','ice','fire','wind','moonSlash','lustKiss','soulOrb'].includes(id)) d += eqStat('thorns') * 1.5 * .01;
    if (hasUnique('unique-saint-nail') && id === 'garlic') {
      let stacks = Math.floor(riftProgress() * 10);
      if (stacks > 0) d *= Math.pow(1.05, stacks);
    }
    if (hasSet('reaper-waltz', 6) && id === 'scytheArc') {
      let shieldRate = Math.min(1, (p.shield || 0) / Math.max(1, p.max));
      d *= 1 + Math.min(.30, Math.floor(shieldRate * 10) * .03);
      if ((S._deathWaltzTimer || 0) > 0) d *= 1.25;
    }
    if (hasSet('blood-reaping', 6) && id === 'bloodReap') {
      let fearCount = fearNearbyCount(p);
      d *= 1 + Math.min(.40, fearCount * .05);
      if ((S._fear || 0) >= fearCap() * .5) d *= 1.15;
    }
    return d;
  }
  function aspectAfterDamage(d, id, e, crit) {
    let p = S?.player;
    if (!p || !id) return;
    if (hasUnique('unique-clock-gloves') && crit && S.time >= (S._clockCdAt || 0) && Math.random() < .08) {
      S._clockCdAt = S.time + .25;
      for (const k of Object.keys(S.cd || {})) if (S.cd[k] > 0) S.cd[k] = Math.max(0, S.cd[k] - 1);
      S.parts.push({x:e.x,y:e.y,vx:0,vy:-20,life:.5,max:.5,a:1,c:'#93c5fd',txt:'CD-1s'});
    }
    if (hasUnique('unique-moon-crown') && id === 'iceorb' && crit) {
      p.shield = Math.min(p.max, (p.shield || 0) + p.max * .04);
      S.parts.push({x:p.x,y:p.y,vx:0,vy:0,life:.55,max:.55,a:1,c:'#93c5fd',aspectRing:50});
    }
    if (hasUnique('unique-rose-mirror') && (S._roseStored || 0) > 0) {
      let linked = hasSet('rose-mirror', 6), stored = S._roseStored, dmg = stored * (linked ? 2.2 : 1.6), rad = linked ? 190 : 150, pool = window.nearbyEnemies ? window.nearbyEnemies(p.x, p.y, rad + 80) : S.enemies; S._roseStored = 0;
      for (const m of pool) if (!m.dead && dist(p, m) < rad + m.r) dealDamage(m, dmg, true, 'lustSplash'); S.artFx.push({x:p.x,y:p.y,type:'lustOverflow',kind:'lustOverflow',color:'#f472b6',life:.52,max:.52,size:linked?280:220});
    }
    if (hasSet('astral-missile') && id === 'missile' && crit && Math.random() < .25) {
      window.burstAt?.('missile', e.x, e.y, d * 2.2, 72, 0, '#c084fc', 140, .35);
      S.parts.push({x:e.x,y:e.y,vx:0,vy:0,life:.5,max:.5,a:1,c:'#c084fc',aspectRing:90});
    }
    if (hasSet('moon-hunter') && id === 'moonSlash' && crit) {
      window.burstAt?.('crystal', e.x, e.y, d * (1 + eqStat('critDmg')) * 1.5, 58, 1.2, '#93c5fd', 110, .42);
      S.parts.push({x:e.x,y:e.y,vx:0,vy:0,life:.55,max:.55,a:1,c:'#93c5fd',aspectRing:75});
    }
    if (hasSet('dawn-judgment') && id === 'holyLance') S.artFx.push({x:e.x,y:e.y,fromX:p.x,fromY:p.y,type:'setDawnJudgment',kind:'setDawnJudgment',color:'#fde68a',life:.42,max:.42,size:150,rot:Math.atan2(e.y-p.y,e.x-p.x)});
    if (hasSet('storm-sigil') && id === 'thunderChain' && crit) S.artFx.push({x:e.x,y:e.y,fromX:p.x,fromY:p.y,type:'setStormChain',kind:'setStormChain',color:'#fde047',life:.45,max:.45,size:120,rot:Math.atan2(e.y-p.y,e.x-p.x)});
    if (hasSet('venom-shadow') && (id === 'poisonCloud' || id === 'shadowBlade') && S.time > (e._venomFxAt || 0)) {
      e._venomFxAt = S.time + .28;
      S.artFx.push({x:e.x,y:e.y,type:'setVenomBreak',kind:'setVenomBreak',color:'#86efac',life:.46,max:.46,size:132,target:e});
    }
    if (hasSet('soul-shadow', 6) && id === 'wraithBlade' && (e.elite || e.boss)) {
      let now = S.time || 0;
      if (now > (S._soulShieldAt || 0)) {
        S._soulShieldAt = now + .18;
        p.shield = Math.min(p.max * .45, (p.shield || 0) + p.max * (e.boss ? .035 : .025));
        S.parts.push({x:p.x,y:p.y,vx:0,vy:0,life:.35,max:.35,a:1,c:'#a78bfa',txt:'影盾'});
      }
      if (e.boss && now > (S._soulArmorHitAt || 0)) {
        S._soulArmorHitAt = now + .65;
        S._soulArmor = Math.min(8, (S._soulArmor || 0) + 1);
        S._soulArmorTimer = 4;
      }
    }
    if (hasSet('reaper-waltz', 6) && id === 'scytheArc') {
      let now = S.time || 0;
      if (e.elite || e.boss) p.shield = Math.min(p.max, (p.shield || 0) + p.max * (e.boss ? .03 : .02));
      if ((S._deathWaltzTimer || 0) > 0) {
        let heal = p.max * (e.boss ? .012 : e.elite ? .008 : .003);
        p.hp = Math.min(p.max, p.hp + heal);
        if ((e.elite || e.boss) && now > (S._deathWaltzExtendAt || 0)) {
          S._deathWaltzExtendAt = now + .16;
          S._deathWaltzTimer = Math.min(8, (S._deathWaltzTimer || 0) + .3);
        }
      }
    }
    if (hasSet('blood-reaping', 6) && id === 'bloodReap') {
      markFear(e, e.boss ? 7 : e.elite ? 5 : 4);
      let low = (S._fear || 0) < fearCap() * .35, gain = e.boss ? 10 : e.elite ? 6 : 2;
      gainFear(gain * (low ? 1.75 : 1));
      if (S.time > (e._fearFxAt || 0)) {
        e._fearFxAt = S.time + .35;
        S.parts.push({x:e.x,y:e.y,vx:0,vy:-12,life:.42,max:.42,a:1,c:'#a78bfa',txt:'恐惧'});
      }
    }
  }
  function aspectDefend(rawDmg, source) {
    let p = S?.player;
    if (!p) return { dmg: rawDmg, prevent: false };
    if (hasUnique('unique-rose-mirror')) {
      let linked=hasSet('rose-mirror',6),absorb=linked ? .42 : .28,stored=rawDmg*absorb;
      S._roseStored = Math.min(p.max*(linked?2.5:1.6), (S._roseStored || 0) + stored); if (linked) S._mirrorPool = Math.min(p.max * 1.2, (S._mirrorPool || 0) + stored * .25); return { dmg: rawDmg * (1 - absorb), prevent: false };
    }
    if (hasUnique('unique-golem-soul') && !p.moving && (p.cast || 0) > 0) rawDmg *= Math.max(.65, 1 - Math.min(5, Math.floor(S.time * 2)) * .07);
    if ((S._fear || 0) > 0) {
      let fearCut = 1 - Math.min(.70, fearNearbyCount(p) * .08), capped = Math.min(rawDmg, p.max), fearLoss = capped * fearCut;
      let paid = Math.min(S._fear || 0, fearLoss);
      S._fear = Math.max(0, (S._fear || 0) - paid);
      if (paid > 0 && S.time > (S._fearGuardFxAt || 0)) {
        S._fearGuardFxAt = S.time + .28;
        S.parts.push({x:p.x,y:p.y,vx:0,vy:0,life:.42,max:.42,a:1,c:'#a78bfa',txt:`恐惧-${Math.round(paid)}`});
      }
      if (paid >= fearLoss) return { dmg: 0, prevent: false };
      rawDmg = Math.max(0, fearLoss - paid);
    }
    if (hasSet('reaper-waltz', 6) && (S._deathWaltzTimer || 0) > 0) rawDmg *= .80;
    if (hasSet('soul-shadow', 6)) {
      let stacks = S._soulArmor || 0;
      if (stacks > 0) rawDmg *= 1 - Math.min(.32, stacks * .04);
      if (p.hp - rawDmg <= p.max * .35 && stacks > 0 && S.time > (S._soulLastStandAt || 0)) {
        S._soulLastStandAt = S.time + 12;
        p.shield = Math.min(p.max * .65, (p.shield || 0) + p.max * Math.min(.45, stacks * .06));
        p.hp = Math.min(p.max, p.hp + p.max * .12);
        rawDmg *= .55;
        S._soulArmor = 0; S._soulArmorTimer = 0;
        window.showNotice?.('断魂护命：魂甲化盾！');
        S.parts.push({x:p.x,y:p.y,vx:0,vy:0,life:.65,max:.65,a:1,c:'#a78bfa',aspectRing:95});
      }
    }
    return { dmg: rawDmg, prevent: false };
  }
  function aspectSkillMods() {
    let p = S?.player;
    if (!p) return;
    S._voidBonus = hasUnique('unique-void-lantern') ? Math.min(5, Math.floor(riftProgress() * 10)) * .08 : 0;
  }
  function aspectOnKill(e) {
    let p = S?.player;
    if (!p) return;
    if (hasUnique('unique-plague-bell') && (e.elite || e.boss)) {
      S._plagueDotRush = 3;
      S.parts.push({x:e.x,y:e.y,vx:0,vy:0,life:.55,max:.55,a:1,c:'#86efac',aspectRing:115});
    }
    if (hasUnique('unique-dragon-heart')) {
      if (e.elite || e.boss) {
        let martyrDmg = (48 + p.max * .12) * (window.dmgBase?.('bloodNova') || 1);
        (window.lightBurstAt || window.burstAt)?.('blood', e.x, e.y, martyrDmg, 240, 0, '#fde68a', 220, .42);
        if (S.endless) for (const m of (window.nearbyEnemies ? window.nearbyEnemies(e.x, e.y, 280) : S.enemies)) if (m !== e && !m.boss && !m.dead && Math.hypot(m.x - e.x, m.y - e.y) < 260) m.hp -= m.max * .18;
      }
      if (!e.boss && !e.elite && S.endless && Math.random() < .35) S.kills += Math.max(1, Math.floor(window.endlessBossGap?.(S.endlessLayer || 1) * .005));
    }
    if (hasSet('soul-shadow', 6) && e._lastHitBy === 'wraithBlade' && (S.time || 0) >= (S._soulShadowResetAt || 0)) {
      S._soulShadowResetAt = (S.time || 0) + .45;
      S._soulShadowCd = 1; S._soulShadowCrit = Math.min(.75, (S._soulShadowCrit || 0) + .15);
      S._soulArmor = Math.min(8, (S._soulArmor || 0) + (e.elite || e.boss ? 2 : 1));
      S._soulArmorTimer = 4;
      S.artFx.push({x:e.x,y:e.y,type:'setSoulShadowBurst',kind:'setSoulShadowBurst',color:'#a78bfa',life:.58,max:.58,size:170,rot:Math.random()*Math.PI});
    }
    if (hasSet('blood-reaping', 6) && (e._fear || 0) > 0) {
      gainFear(e.boss ? 60 : e.elite ? 25 : 8);
      S.parts.push({x:e.x,y:e.y,vx:0,vy:0,life:.48,max:.48,a:1,c:'#fb7185',txt:'恐惧吸收'});
    }
    if (hasSet('crimson-vessel') && (e._lastHitBy === 'lustSplash' || e._lastHitBy === 'lustKiss')) {
      let near = window.nearbyEnemies ? window.nearbyEnemies(e.x, e.y, 300) : S.enemies, elite = window.nearest?.(near.filter(m => !m.dead && (m.elite || m.boss)), e); if (elite) for (const m of near.filter(m => !m.dead && !m.boss && !m.elite && Math.hypot(m.x - e.x, m.y - e.y) < 220).slice(0, 4)) m._kamikaze = { target: elite, timer: 2.1, dmg: m.max * .42 };
      if (S.player?.cls === 'lewdSaintess') window.gainLust?.(e.boss ? 18 : e.elite ? 10 : 4);
    }
  } return { hasUnique, hasSet, eqStat, dotFx, isEvolvedDamageSkill, riftProgress, fearCap, aspectDamageChain, aspectAfterDamage, aspectDefend, aspectSkillMods, aspectOnKill };
})();
