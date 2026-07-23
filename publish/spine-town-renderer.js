(() => {
  'use strict';

  const api = window.CultivationSpine;
  const gpu = window.CultivationSpineGPU;
  const config = window.CultivationSpineConfig;
  if (!api?.actors || !gpu?.available || !config?.classes) return;

  const instances = new Map();

  function prepare(id, actions = ['idle', 'run']) {
    const source = api.actors.get(id);
    if (!source) return false;
    return actions.every(action => Boolean(source.def.animations[action]));
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
      instance = {
        id,
        action,
        startedAt: performance.now(),
        gpu: gpu?.available ? gpu.createInstance(source) : null,
      };
      instances.set(key, instance);
    } else if (instance.action !== action) {
      instance.action = action;
      instance.startedAt = performance.now();
    }
    const drawOptions = {
      elapsed: performance.now() - instance.startedAt,
      speed: options.speed || config.speeds[action] || 1,
      // 城镇默认统一身高；调用方传入 height 时优先生效
      height: options.height || 80,
      face: options.face || 1,
      alpha: options.alpha ?? 1,
      groundOffset: options.groundOffset || 0,
      clear: options.clear !== false,
      minDpr: options.minDpr,
    };
    if (!gpu.available) return false;
    instance.gpu ||= gpu.createInstance(source);
    return gpu.draw(context, source, instance.gpu, action, x, y, drawOptions);
  }

  window.CultivationSpineTown = { draw, prepare, instances };
})();
