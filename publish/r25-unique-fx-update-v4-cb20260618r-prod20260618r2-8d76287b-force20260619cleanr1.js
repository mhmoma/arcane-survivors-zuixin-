'use strict';
window.GameModules = window.GameModules || {};
window.GameModules.uniqueFxUpdate = (() => {
  const H = window.GameModules.uniqueFxShared;
  function aspectUpdate(dt) {
    let p = S?.player;
    if (!p) return;
    S._plagueDotRush = Math.max(0, (S._plagueDotRush || 0) - dt);
    for (const e of S.enemies || []) {
      e._dotMarked = Math.max(0, (e._dotMarked || 0) - dt);
      e._fear = Math.max(0, (e._fear || 0) - dt);
      e._blazeBurn = Math.max(0, (e._blazeBurn || 0) - dt * .35);
      e._emberBurn = Math.max(0, (e._emberBurn || 0) - dt * .35);
      e._violetVuln = Math.max(0, (e._violetVuln || 0) - dt * .45);
    }
    S._fear = Math.min(H.fearCap?.() || 0, S._fear || 0);
    S._faithTrailBonus = 0;
    S._soulShadowCrit = Math.max(0, (S._soulShadowCrit || 0) - dt * .08);
    if (H.hasUnique('unique-faith-boots')) {
      for (const f of S.artFx || []) {
        if (f.faithTrail && Math.hypot(p.x - f.x, p.y - f.y) < (f.rad || 40) + p.r) {
          S._faithTrailBonus = .30;
          if (S.time > (S._faithTrailNoticeAt || 0)) {
            S._faithTrailNoticeAt = S.time + .45;
            S.parts.push({x:p.x,y:p.y,vx:0,vy:0,life:.28,max:.28,a:1,c:'#fde68a',aspectRing:58});
          }
          break;
        }
      }
    }
    if (S._paleTimer > 0) {
      S._paleTimer -= dt;
      if (S._paleTimer <= 0) S._paleTimer = 0;
    }
    if (H.hasSet('reaper-waltz', 6) && (p.shield || 0) >= p.max && (S._deathWaltzTimer || 0) <= 0) {
      S._deathWaltzTimer = 5;
      if (S.time > (S._deathWaltzNoticeAt || 0)) {
        S._deathWaltzNoticeAt = S.time + 3;
        window.showNotice?.('死神状态：冥月圆舞！');
      }
    }
    if ((S._deathWaltzTimer || 0) > 0) S._deathWaltzTimer = Math.max(0, S._deathWaltzTimer - dt);
    S._deathShieldFull = H.hasSet('reaper-waltz') && (S._deathWaltzTimer || 0) > 0;
    S._dotSpeed = S._deathShieldFull ? 2.5 : 1;
    if (S._soulShadowCd > 0) {
      S._soulShadowCd = 0;
      for (const k of Object.keys(S.cd || {})) if (k !== 'wraithBlade') S.cd[k] = 0;
      S.cd.wraithBlade = Math.min(S.cd.wraithBlade || .28, .28);
    }
    if (S._soulArmorTimer > 0) {
      S._soulArmorTimer -= dt;
      if (S._soulArmorTimer <= 0) { S._soulArmorTimer = 0; S._soulArmor = 0; }
    }
    updateKamikaze(dt);
    updateAureateGuardian(dt, p);
  }
  function updateKamikaze(dt) {
    for (const e of S.enemies) {
      if (!e._kamikaze || e.dead) continue;
      let k = e._kamikaze;
      k.timer -= dt;
      let a = Math.atan2(k.target.y - e.y, k.target.x - e.x);
      e.x += Math.cos(a) * e.spd * 2.5 * dt;
      e.y += Math.sin(a) * e.spd * 2.5 * dt;
      if (Math.hypot(e.x - k.target.x, e.y - k.target.y) < e.r + k.target.r + 8 || k.timer <= 0) {
        window.burstAt?.('lustSplash', e.x, e.y, k.dmg * (window.dmgBase?.('lustSplash') || 1), 64, 0, '#fb7185', 110, .32);
        window.dealDamage?.(k.target, k.dmg * 2.4, true, 'lustSplash');
        if (S.player?.cls === 'lewdSaintess') window.gainLust?.(6);
        e.hp = 0;
        delete e._kamikaze;
      }
    }
  }
  function updateAureateGuardian(dt, p) {
    if (!H.hasSet('aureate-guardian') || !S.skills.garlic) return;
    let lv = window.skillLv?.('garlic') || 1, rad = 50 + lv * 10 + 34;
    if (S.time > (S._aureateFxAt || 0)) {
      S._aureateFxAt = S.time + .7;
      S.artFx.push({x:p.x,y:p.y,type:'setAureateBlackhole',kind:'setAureateBlackhole',color:'#fde68a',life:.62,max:.62,size:rad*3.1,rot:S.time,setPlayer:true});
    }
    let pool = window.nearbyEnemies ? window.nearbyEnemies(p.x, p.y, rad * 1.5 + 70) : S.enemies;
    for (const e of pool) {
      let d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < rad * 1.5 && d > 8) {
        let force = (1 - d / (rad * 1.5)) * 60 * dt, a = Math.atan2(p.y - e.y, p.x - e.x);
        e.x += Math.cos(a) * force;
        e.y += Math.sin(a) * force;
      }
    }
  }
  function aspectArtFxTick(f, dt) {
    let rad = f.rad || f.size || 80, pool = window.nearbyEnemies ? window.nearbyEnemies(f.x, f.y, rad + 80) : S.enemies;
    if (H.hasUnique('unique-plague-bell') && H.dotFx(f)) for (const e of pool) if (Math.hypot(e.x - f.x, e.y - f.y) < rad + e.r) e._dotMarked = .35;
    if (H.hasUnique('unique-blaze-core') && f.burn) {
      for (const e of pool) if (e.boss && Math.hypot(e.x - f.x, e.y - f.y) < rad + e.r) { e._blazeBurn = (e._blazeBurn || 0) + dt; f.blazeMul = 1 + Math.min(.6, e._blazeBurn * .08); }
    }
    if (H.hasSet('ember-meteor') && f.burn) {
      for (const e of pool) if (e.boss && Math.hypot(e.x - f.x, e.y - f.y) < rad + e.r) { e._emberBurn = (e._emberBurn || 0) + dt; f.emberMul = 1 + Math.min(1.5, e._emberBurn * .20); }
    }
    if (H.dotFx(f)) f.tickMul = (S._plagueDotRush > 0 ? 2.0 : 1) * (H.hasSet('reaper-waltz') && S._deathShieldFull ? (S._dotSpeed || 1) : 1) * (f.emberMul || 1) * (f.blazeMul || 1);
    if (H.hasSet('violet-hymn') && f.prayer) {
      let p = S?.player;
      if (p && p.hp >= p.max) {
        let e = window.nearest?.(window.nearbyEnemies ? window.nearbyEnemies(p.x, p.y, 620) : S.enemies, p);
        if (e) {
            window.dealDamage?.(e, f.dmg * 3.6 * dt, true, 'lustPrayer');
          if (e.elite || e.boss) e._violetVuln = Math.min(3.6,(e._violetVuln || 0) + dt*1.35);
        }
      }
    }
  }
  function aspectProjectileHit(m, e, dmg) {
    let p = S?.player;
    if (!p) return dmg;
    if (H.hasUnique('unique-thunder-bow') && m.kind === 'axe' && Math.random() < .20) {
      let pool = window.nearbyEnemies ? window.nearbyEnemies(e.x, e.y, 300) : S.enemies, elite = window.nearest?.(pool.filter(x => x !== e && (x.elite || x.boss) && Math.hypot(x.x - e.x, x.y - e.y) < 280), e);
      if (elite) {
        window.dealDamage?.(elite, dmg * .35, true, 'thunderChain');
        e._thunderVuln = 3;
        S.bolts.push({ x: elite.x, y: elite.y, x2: e.x, y2: e.y, life: .22, chain: true });
        S.parts.push({x:e.x,y:e.y,vx:0,vy:0,life:.45,max:.45,a:1,c:'#fde047',aspectRing:60});
      }
    }
    if (H.hasUnique('unique-star-tome') && m.kind === 'missile' && m.pierce && !m._blackhole) {
      m._blackhole = true;
      S.artFx.push({ x:e.x, y:e.y, type:'voidRift', kind:'missile', color:'#c084fc', life:1.8, max:1.8, size:100, rad:80, pull:true, dmg:dmg*.30 });
    }
    return dmg;
  }
  return { aspectUpdate, aspectArtFxTick, aspectProjectileHit };
})();
