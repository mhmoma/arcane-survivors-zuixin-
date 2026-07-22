(() => {
  'use strict';

  const api = window.CultivationSpine;
  const frames = window.CultivationSpineFrames;
  const config = window.CultivationSpineConfig;
  if (!api?.actors || !frames || !config?.classes) return;

  const instances = new Map();

  function prepare(id, actions = ['idle', 'run']) {
    const source = api.actors.get(id);
    if (!source) return false;
    frames.prepare(source, actions);
    return true;
  }

  function draw(context, id, key, x, y, options = {}) {
    if (!config.classes[id]) return false;
    const source = api.actors.get(id);
    if (!source) {
      api.load(id);
      return false;
    }
    let instance = instances.get(key);
    const action = options.moving ? 'run' : 'idle';
    if (!instance || instance.id !== id) {
      instance = { id, action, startedAt: performance.now() };
      instances.set(key, instance);
    } else if (instance.action !== action) {
      instance.action = action;
      instance.startedAt = performance.now();
    }
    frames.draw(context, source, action, x, y, {
      elapsed: performance.now() - instance.startedAt,
      speed: config.speeds[action] || 1,
      height: options.height || 96,
      face: options.face || 1,
      alpha: options.alpha ?? 1,
      groundOffset: options.groundOffset || 0,
    });
    return true;
  }

  window.CultivationSpineTown = { draw, prepare, instances };
})();
