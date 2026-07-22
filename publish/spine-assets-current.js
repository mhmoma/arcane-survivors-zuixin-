(() => {
  'use strict';

  const root = './assets/spine';
  const current = {
    paladin: `${root}/paladin/preview.png`,
    mage: `${root}/mage/preview.png`,
    ranger: `${root}/ranger/preview.png`,
    gunslinger: `${root}/gunslinger/preview.png`,
    lewdSaintess: `${root}/lewd-saintess/preview.png`,
    scytheMaiden: `${root}/scythe-maiden/preview.png`,
  };

  if (window.AS) {
    Object.assign(window.AS, current, {
      paladinCard: current.paladin,
      mageCard: current.mage,
      rangerCard: current.ranger,
      gunslingerCard: current.gunslinger,
      lewdSaintessCard: current.lewdSaintess,
      scytheMaidenCard: current.scytheMaiden,
    });
  }
  window.CultivationSpineAssetsCurrent = current;
})();
