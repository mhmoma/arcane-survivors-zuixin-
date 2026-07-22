(() => {
  'use strict';

  const spine = window.spine;
  const api = window.CultivationSpine;
  const config = window.CultivationSpineConfig;
  if (!spine?.canvas || !api?.actors || !config?.classes) return;

  const instances = new Map();

  function create(id, key, context) {
    const source = api.actors.get(id);
    if (!source) return null;
    const skeleton = new spine.Skeleton(source.data);
    skeleton.scaleY = -1;
    const stateData = new spine.AnimationStateData(source.data);
    stateData.defaultMix = 0.12;
    const state = new spine.AnimationState(stateData);
    state.setAnimation(0, source.def.animations.idle, true);
    const renderer = new spine.canvas.SkeletonRenderer(context);
    renderer.triangleRendering = true;
    const instance = {
      id, key, context, skeleton, state, renderer,
      action: 'idle',
      lastTime: performance.now(),
      source,
    };
    instances.set(key, instance);
    return instance;
  }

  function get(id, key, context) {
    let instance = instances.get(key);
    if (!instance || instance.id !== id || instance.context !== context) {
      instance = create(id, key, context);
    }
    return instance;
  }

  function draw(context, id, key, x, y, options = {}) {
    if (!config.classes[id]) return false;
    const source = api.actors.get(id);
    if (!source) {
      api.load(id);
      return false;
    }
    const instance = get(id, key, context);
    if (!instance) return false;
    const action = options.moving ? 'run' : 'idle';
    if (instance.action !== action) {
      const entry = instance.state.setAnimation(
        0, source.def.animations[action], true,
      );
      entry.timeScale = config.speeds[action] || 1;
      instance.action = action;
    }
    const now = performance.now();
    const delta = Math.min(0.05, Math.max(0, (now - instance.lastTime) / 1000));
    instance.lastTime = now;
    instance.state.update(delta);
    instance.state.apply(instance.skeleton);
    instance.skeleton.updateWorldTransform();
    instance.skeleton.color.a = options.alpha ?? 1;
    const bounds = source.bounds;
    const scale = (options.height || 96) / Math.max(1, bounds.size.y);
    const centerX = bounds.offset.x + bounds.size.x / 2;
    const bottom = bounds.offset.y + bounds.size.y;
    context.save();
    context.translate(x, y + (options.groundOffset || 0));
    context.scale((options.face || 1) * source.def.facing * scale, scale);
    context.translate(-centerX, -bottom);
    instance.renderer.draw(instance.skeleton);
    context.restore();
    return true;
  }

  window.CultivationSpineTown = { draw, instances };
})();
