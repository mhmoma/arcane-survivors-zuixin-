(() => {
  'use strict';

  const root = './assets/spine';
  /**
   * @param {string} dir
   * @param {string} file
   * @param {number} height
   * @param {string|object} skillOrOpts skill 名，或 { skill, facing, run, castAction, ... }
   * @param {number} [facing]
   */
  const make = (dir, file, height, skillOrOpts = 'skill', facing = 1) => {
    const opts = typeof skillOrOpts === 'object' && skillOrOpts
      ? skillOrOpts
      : { skill: skillOrOpts, facing };
    const skill = opts.skill || 'skill';
    return {
      atlas: `${root}/${dir}/${file}.atlas`,
      skeleton: `${root}/${dir}/${file}.skel`,
      texture: `${root}/${dir}/${file}.png`,
      preview: `${root}/${dir}/preview.png`,
      height,
      groundOffset: 32,
      facing: opts.facing ?? facing ?? 1,
      // 施法默认 attack；个别包（剑侠）attack 是近战挥砍，施法应走 skill
      castAction: opts.castAction || 'attack',
      animations: {
        idle: opts.idle || 'stand',
        // 机关包 run 不对劲，行走用 walk
        run: opts.run || 'run',
        attack: opts.attack || 'attack',
        skill,
        hurt: opts.hurt || 'hurt',
      },
    };
  };

  window.CultivationSpineConfig = {
    classes: {
      paladin: make('paladin', 'cha_6075', 84),
      mage: make('mage', 'cha_2134', 84),
      // 剑侠：施法播 skill（出手/咏唱），不用近战 attack
      ranger: make('ranger', 'cha_2114', 81, { castAction: 'skill' }),
      // 机关：移动播 walk（run 在本包里不像正常行走）
      gunslinger: make('gunslinger', 'cha_1186', 92, { run: 'walk' }),
      lewdSaintess: make('lewd-saintess', 'cha_60501', 86),
      // 镰刀撑大 getBounds，局内/城镇需更高 height 才与其他职业体型接近
      scytheMaiden: make('scythe-maiden', 'cha_5106', 128, 'skill_ex'),
    },
    speeds: {
      idle: 1,
      run: 1.15,
      attack: 3.3,
      skill: 2.7,
      hurt: 1.45,
    },
  };
})();
