(() => {
  'use strict';

  const spine = window.spine;
  const SIZE = 320;
  const GROUND = 270;
  const RENDER_HEIGHT = 128;
  let canvas = null;
  let gl = null;
  let renderer = null;
  let contextLost = false;
  let warned = false;

  function initialize() {
    if (!spine?.webgl?.SceneRenderer) return false;
    try {
      canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      });
      if (!gl) return false;
      renderer = new spine.webgl.SceneRenderer(canvas, gl);
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        contextLost = true;
        api.lastBackend = 'canvas';
      });
      canvas.addEventListener('webglcontextrestored', () => {
        contextLost = false;
      });
      return true;
    } catch (error) {
      console.warn('Spine WebGL 初始化失败:', error.message);
      return false;
    }
  }

  function createTexture(image) {
    if (!api.available) return null;
    return new spine.webgl.GLTexture(gl, image);
  }

  function createInstance(source) {
    if (!source?.data) return null;
    const skeleton = new spine.Skeleton(source.data);
    const state = new spine.AnimationState(new spine.AnimationStateData(source.data));
    return {
      skeleton,
      state,
      action: '',
      lastTime: performance.now(),
    };
  }

  function setAction(instance, source, action) {
    if (instance.action === action) return;
    const name = source.def.animations[action] || source.def.animations.idle;
    instance.state.setAnimation(0, name, action === 'idle' || action === 'run');
    instance.action = action;
  }

  function render(instance, source, action, options) {
    const now = performance.now();
    const speed = options.speed || 1;
    const delta = Math.min(0.05, Math.max(0, now - instance.lastTime) / 1000);
    instance.lastTime = now;
    setAction(instance, source, action);
    instance.state.update(delta * speed);
    instance.state.apply(instance.skeleton);

    const facing = (source.def.facing || 1) * (options.face || 1);
    const skeleton = instance.skeleton;
    skeleton.scaleX = facing;
    skeleton.scaleY = 1;
    skeleton.updateWorldTransform();

    const bounds = source.bounds;
    const worldHeight = Math.max(1, bounds.size.y);
    const viewport = worldHeight * SIZE / RENDER_HEIGHT;
    const bottomMargin = SIZE - GROUND;
    renderer.camera.viewportWidth = viewport;
    renderer.camera.viewportHeight = viewport;
    renderer.camera.position.x = (bounds.offset.x + bounds.size.x / 2) * facing;
    renderer.camera.position.y = bounds.offset.y
      + viewport * (0.5 - bottomMargin / SIZE);
    renderer.camera.update();

    gl.viewport(0, 0, SIZE, SIZE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    renderer.begin();
    renderer.drawSkeleton(skeleton, false);
    renderer.end();
  }

  function draw(context, source, instance, action, x, y, options = {}) {
    if (!api.available || !context || !source || !instance) return false;
    try {
      render(instance, source, action, options);
      const ratio = (options.height || RENDER_HEIGHT) / RENDER_HEIGHT;
      context.save();
      context.globalAlpha = options.alpha ?? 1;
      context.translate(x, y + (options.groundOffset || 0));
      context.drawImage(
        canvas,
        -SIZE * ratio / 2,
        -GROUND * ratio,
        SIZE * ratio,
        SIZE * ratio,
      );
      context.restore();
      api.lastBackend = 'webgl';
      return true;
    } catch (error) {
      api.lastBackend = 'canvas';
      if (!warned) {
        warned = true;
        console.warn('Spine WebGL 渲染失败，已切换 Canvas:', error.message);
      }
      return false;
    }
  }

  const api = {
    get available() {
      return Boolean(gl && renderer && !contextLost && !gl.isContextLost());
    },
    canvas: null,
    gl: null,
    lastBackend: 'unavailable',
    createTexture,
    createInstance,
    draw,
  };

  initialize();
  api.canvas = canvas;
  api.gl = gl;
  api.lastBackend = api.available ? 'webgl' : 'canvas';
  window.CultivationSpineGPU = api;
})();
