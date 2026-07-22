(() => {
  'use strict';

  const spine = window.spine;
  if (!spine?.canvas) return;

  const SIZE = 320, GROUND = 270, RENDER_HEIGHT = 128;
  const COUNTS = { idle: 8, run: 12, attack: 10, skill: 12, hurt: 8 };
  const clips = new WeakMap();

  function sourceClips(source) {
    let cache = clips.get(source);
    if (!cache) {
      cache = {};
      clips.set(source, cache);
    }
    return cache;
  }

  function bake(source, action) {
    const cache = sourceClips(source);
    if (cache[action]) return cache[action];
    const name = source.def.animations[action] || source.def.animations.idle;
    const animation = source.data.findAnimation(name);
    const duration = animation?.duration || 0.5;
    const loop = action === 'idle' || action === 'run';
    const count = COUNTS[action] || 10;
    const skeleton = new spine.Skeleton(source.data);
    skeleton.scaleY = -1;
    const state = new spine.AnimationState(new spine.AnimationStateData(source.data));
    const entry = state.setAnimation(0, name, loop);
    const bounds = source.bounds;
    const scale = RENDER_HEIGHT / Math.max(1, bounds.size.y);
    const centerX = bounds.offset.x + bounds.size.x / 2;
    const bottom = bounds.offset.y + bounds.size.y;
    const frames = [];
    for (let i = 0; i < count; i += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const context = canvas.getContext('2d');
      const renderer = new spine.canvas.SkeletonRenderer(context);
      renderer.triangleRendering = true;
      entry.trackTime = duration * (loop ? i / count : i / Math.max(1, count - 1));
      skeleton.setToSetupPose();
      state.apply(skeleton);
      skeleton.updateWorldTransform();
      context.translate(SIZE / 2, GROUND);
      context.scale(source.def.facing * scale, scale);
      context.translate(-centerX, -bottom);
      renderer.draw(skeleton);
      frames.push(canvas);
    }
    cache[action] = { frames, duration, loop };
    return cache[action];
  }

  function prepare(source, actions = ['idle', 'run']) {
    actions.forEach(action => bake(source, action));
  }

  function draw(context, source, action, x, y, options = {}) {
    const clip = bake(source, action);
    const speed = options.speed || 1;
    const elapsed = Math.max(0, options.elapsed || 0) * speed / 1000;
    let progress = elapsed / Math.max(0.001, clip.duration);
    progress = clip.loop ? progress % 1 : Math.min(0.999, progress);
    const frame = clip.frames[Math.floor(progress * clip.frames.length)];
    const ratio = (options.height || RENDER_HEIGHT) / RENDER_HEIGHT;
    context.save();
    context.globalAlpha = options.alpha ?? 1;
    context.translate(x, y + (options.groundOffset || 0));
    context.scale((options.face || 1) * ratio, ratio);
    context.drawImage(frame, -SIZE / 2, -GROUND);
    context.restore();
  }

  window.CultivationSpineFrames = { draw, prepare, bake, clips };
})();
