(function () {
  'use strict';
  /**
   * 主动技能施法：设 cast 窗口；Spine 按职业 castAction 播（剑侠=skill，其它=attack）。
   * castPose=3 保留给 sheet 回退路径。
   */
  const CAST_DUR = 0.26;

  function playCast(dur) {
    const p = S?.player;
    if (!p) return;
    const d = dur == null ? CAST_DUR : dur;
    p.cast = d;
    p.castMax = d;
    p.castPose = 3;
  }

  // 强制统一：任何 playPlayerCast 都走施法姿态
  window.playPlayerCast = function (dur, _pose) {
    playCast(dur == null ? CAST_DUR : dur);
  };

  function wrapAfter(name, fn) {
    const base = window[name];
    if (typeof base !== 'function') return;
    window[name] = function () {
      const r = base.apply(this, arguments);
      fn(r, arguments);
      return r;
    };
  }

  // 投射 / 近战斩 / 射线 / 落击 / 落点领域：出手即施法
  wrapAfter('castProjectile', () => playCast(0.24));
  wrapAfter('homingProjectile', () => playCast(0.24));
  wrapAfter('slashAttack', () => playCast(0.22));
  wrapAfter('beamAttack', () => playCast(0.22));
  wrapAfter('fallingAttack', () => playCast(0.24));
  wrapAfter('areaOnTarget', () => playCast(0.24));
  wrapAfter('scytheArcAttack', () => playCast(0.24));
  wrapAfter('volley', () => playCast(0.24));

  function snapCds(bag) {
    const out = Object.create(null);
    if (!S?.cd || !bag) return out;
    for (let i = 0; i < bag.length; i++) {
      const k = bag[i];
      out[k] = S.cd[k] || 0;
    }
    return out;
  }

  function anySkillFired(before, bag) {
    if (!S?.cd || !S?.skills || !before) return false;
    for (let i = 0; i < bag.length; i++) {
      const k = bag[i];
      if (!(S.skills[k] > 0)) continue;
      const prev = before[k] || 0;
      const now = S.cd[k] || 0;
      // skills() 开头会先扣 CD；真正释放时会把 CD 设成较大正值
      if (now > prev + 0.35) return true;
    }
    return false;
  }

  // 主动攻击技（含各职业签名技）
  const SKILL_BAG = [
    'missile', 'fireball', 'iceorb', 'holyLance', 'windCutter', 'moonSlash', 'soulOrb', 'lustKiss', 'quickShot',
    'axe', 'shadowBlade', 'daggerRain', 'poisonCloud', 'sandVortex',
    'lightning', 'thunderChain', 'meteorShard', 'crystalSpike', 'voidRift', 'arcaneBeam',
    'bloodNova', 'garlic',
    'lustSplash', 'lustPrayer', 'lustOverflow',
    'scytheArc', 'bloodReap', 'wraithBlade', 'reaperChain', 'graveRift',
    'ricochetBullet', 'shotgunRoll', 'fireBomb',
    'flailSpin', 'shieldOrbit', 'orbit', 'flameWheel'
  ];

  const EVO_BAG = [
    'holyWard', 'judgmentLance', 'bloodOath', 'dragonMeteor', 'thunderRing', 'prismFinale',
    'stormAxe', 'skyTempest', 'hunterBarrage', 'demonSpring', 'fallenSanctum', 'ecstasyOffering',
    'deathWaltz', 'bloodScythe', 'soulReaper', 'silverExecution', 'deathRicochet', 'scorchedBarrage',
    'astralImplosion', 'frostCore', 'lunarHunt', 'venomPhantom', 'roseBind'
  ];

  const baseSkills = window.skills;
  window.skills = function (dt) {
    const before = snapCds(SKILL_BAG);
    const r = baseSkills ? baseSkills.apply(this, arguments) : undefined;
    if (anySkillFired(before, SKILL_BAG)) playCast(CAST_DUR);
    // 琦琦等若写了近战 pose=2，统一改成施法
    if (S?.player?.cast > 0) S.player.castPose = 3;
    return r;
  };

  const baseEvo = window.evolutionSkills;
  window.evolutionSkills = function (dt) {
    const before = snapCds(EVO_BAG);
    // evo 用 evoCd
    const evoBefore = Object.create(null);
    if (S?.evoCd) {
      for (let i = 0; i < EVO_BAG.length; i++) {
        const k = EVO_BAG[i];
        evoBefore[k] = S.evoCd[k] || 0;
      }
    }
    const r = baseEvo ? baseEvo.apply(this, arguments) : undefined;
    let fired = anySkillFired(before, EVO_BAG);
    if (!fired && S?.evoCd) {
      for (let i = 0; i < EVO_BAG.length; i++) {
        const k = EVO_BAG[i];
        const prev = evoBefore[k] || 0;
        const now = S.evoCd[k] || 0;
        if (now > prev + 0.35) {
          fired = true;
          break;
        }
      }
    }
    if (fired) playCast(CAST_DUR);
    if (S?.player?.cast > 0) S.player.castPose = 3;
    return r;
  };

  // 剑芒翻滚位移期间也保持施法姿态（它是主动技）
  const baseMove = window.movePlayer;
  window.movePlayer = function (dt) {
    const r = baseMove ? baseMove.apply(this, arguments) : undefined;
    if (S?.gunRollDash?.t > 0 && S.player) {
      S.player.cast = Math.max(S.player.cast || 0, 0.12);
      S.player.castMax = Math.max(S.player.castMax || 0, 0.12);
      S.player.castPose = 3;
    }
    return r;
  };

  // Spine：按职业 castAction 播施法（见 spine-characters-config）；skill 大招通道仍可用 trigger
  const SC = window.SpineCombat;
  if (SC && !SC.__castAnimPatched) {
    SC.__castAnimPatched = true;
  }

  console.info('[cast-anim] 施法窗口已挂接；Spine castAction 按职业配置');
})();
