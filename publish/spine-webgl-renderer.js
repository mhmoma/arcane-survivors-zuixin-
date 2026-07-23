(() => {
  'use strict';

  const spine = window.spine;
  let canvas = null;
  let gl = null;
  let renderer = null;
  let contextLost = false;
  let targetCanvas = null;
  let lastDraw = 0;
  let warned = false;

  function initialize() {
    if (!spine?.webgl?.SceneRenderer) return false;
    try {
      canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = [
        'position:absolute',
        'display:none',
        'pointer-events:none',
        'z-index:2',
        'image-rendering:auto',
      ].join(';');
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      if (!gl) return false;
      renderer = new spine.webgl.SceneRenderer(canvas, gl);
      canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        contextLost = true;
        api.lastBackend = 'unavailable';
      });
      canvas.addEventListener('webglcontextrestored', () => {
        contextLost = false;
      });
      requestAnimationFrame(monitorVisibility);
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
    // idle/run 循环；施法若映射到 skill 也按非循环播完
    const loop = action === 'idle' || action === 'run';
    instance.state.setAnimation(0, name, loop);
    instance.action = action;
  }

  /** 骨骼自带 shadow 贴片常与脚位错位；局内/城镇统一用程序阴影，这里剥掉。 */
  function stripShadowSlots(skeleton) {
    if (!skeleton?.slots) return;
    for (let i = 0; i < skeleton.slots.length; i++) {
      const slot = skeleton.slots[i];
      const slotName = (slot.data?.name || '').toLowerCase();
      const att = slot.getAttachment?.() || slot.attachment;
      const attName = (att?.name || '').toLowerCase();
      if (slotName.includes('shadow') || attName.includes('shadow')) {
        slot.setAttachment(null);
      }
    }
  }

  function monitorVisibility(now) {
    if (canvas && now - lastDraw > 500) canvas.style.display = 'none';
    requestAnimationFrame(monitorVisibility);
  }

  function attachTo(target, opts = {}) {
    const parent = target?.parentElement;
    if (!parent) return false;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
    const targetRect = target.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    canvas.style.left = `${targetRect.left - parentRect.left}px`;
    canvas.style.top = `${targetRect.top - parentRect.top}px`;
    canvas.style.width = `${targetRect.width}px`;
    canvas.style.height = `${targetRect.height}px`;
    canvas.style.display = 'block';
    if (canvas.parentElement !== parent) parent.appendChild(canvas);
    // 目标：至少 2× CSS 像素，高分屏不再额外爆显存
    const baseW = Math.max(1, target.width || Math.round(targetRect.width));
    const baseH = Math.max(1, target.height || Math.round(targetRect.height));
    const cssW = Math.max(1, targetRect.width);
    const effDpr = baseW / cssW;
    const wantDpr = Math.max(effDpr, opts.minDpr || 0);
    const ss = Math.min(2.5, wantDpr / Math.max(0.01, effDpr));
    const width = Math.max(1, Math.round(baseW * ss));
    const height = Math.max(1, Math.round(baseH * ss));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    targetCanvas = target;
    return true;
  }

  function screenPlacement(context, source, x, y, options) {
    const matrix = context.getTransform();
    const ratioX = canvas.width / Math.max(1, context.canvas.width);
    const ratioY = canvas.height / Math.max(1, context.canvas.height);
    const groundY = y + (options.groundOffset || 0);
    const px = (matrix.a * x + matrix.c * groundY + matrix.e) * ratioX;
    const py = (matrix.b * x + matrix.d * groundY + matrix.f) * ratioY;
    const pixelScale = Math.max(0.001, Math.hypot(matrix.c, matrix.d) * ratioY);
    const height = (options.height || 128) * pixelScale;
    const scale = height / Math.max(1, source.bounds.size.y);
    // 对齐像素，减少亚像素发糊
    return { px: Math.round(px), py: Math.round(py), scale };
  }

  function clearOverlay() {
    if (!gl || !canvas) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function beginOverlay(context, opts = {}) {
    if (!api.available || !context?.canvas) return false;
    if (!attachTo(context.canvas, opts)) return false;
    clearOverlay();
    lastDraw = performance.now();
    return true;
  }

  function render(context, instance, source, action, x, y, options) {
    const now = performance.now();
    const speed = options.speed || 1;
    const delta = Math.min(0.05, Math.max(0, now - instance.lastTime) / 1000);
    instance.lastTime = now;
    setAction(instance, source, action);
    instance.state.update(delta * speed);
    instance.state.apply(instance.skeleton);
    stripShadowSlots(instance.skeleton);

    const placement = screenPlacement(context, source, x, y, options);
    const facing = (source.def.facing || 1) * (options.face || 1);
    const skeleton = instance.skeleton;
    const bounds = source.bounds;
    const centerX = bounds.offset.x + bounds.size.x / 2;
    skeleton.scaleX = placement.scale * facing;
    skeleton.scaleY = placement.scale;
    skeleton.x = placement.px - centerX * placement.scale * facing;
    skeleton.y = canvas.height - placement.py - bounds.offset.y * placement.scale;
    skeleton.color.a = options.alpha ?? 1;
    skeleton.updateWorldTransform();

    renderer.camera.viewportWidth = canvas.width;
    renderer.camera.viewportHeight = canvas.height;
    renderer.camera.position.x = canvas.width / 2;
    renderer.camera.position.y = canvas.height / 2;
    renderer.camera.update();

    gl.viewport(0, 0, canvas.width, canvas.height);
    if (options.clear !== false) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    renderer.begin();
    renderer.drawSkeleton(skeleton, false);
    renderer.end();
  }

  function draw(context, source, instance, action, x, y, options = {}) {
    if (!api.available || !context || !source || !instance) return false;
    try {
      if (options.clear !== false) {
        if (!attachTo(context.canvas, options)) return false;
      } else if (!targetCanvas || targetCanvas !== context.canvas) {
        if (!attachTo(context.canvas, options)) return false;
      }
      render(context, instance, source, action, x, y, options);
      lastDraw = performance.now();
      api.lastBackend = 'webgl';
      return true;
    } catch (error) {
      api.lastBackend = 'unavailable';
      if (!warned) {
        warned = true;
        console.error('Spine WebGL 渲染失败，角色渲染已停止:', error.message);
      }
      return false;
    }
  }

  /** Offscreen cell for Pixi / Texture.from — no DOM overlay. */
  function renderToCell(instance, source, action, options = {}) {
    if (!api.available || !instance || !source) return null;
    try {
      const cell = Math.max(64, options.cell || 160);
      if (canvas.width !== cell || canvas.height !== cell) {
        canvas.width = cell;
        canvas.height = cell;
      }
      canvas.style.display = 'none';
      const now = performance.now();
      const speed = options.speed || 1;
      const delta = Math.min(0.05, Math.max(0, now - instance.lastTime) / 1000);
      instance.lastTime = now;
      setAction(instance, source, action);
      instance.state.update(delta * speed);
      instance.state.apply(instance.skeleton);
      stripShadowSlots(instance.skeleton);

      const bounds = source.bounds;
      const height = options.height || 96;
      const scale = height / Math.max(1, bounds.size.y);
      const facing = (source.def.facing || 1) * (options.face || 1);
      const skeleton = instance.skeleton;
      const centerX = bounds.offset.x + bounds.size.x / 2;
      const groundY = cell - 10 + (options.groundOffset || 0);
      skeleton.scaleX = scale * facing;
      skeleton.scaleY = scale;
      skeleton.x = cell / 2 - centerX * scale * facing;
      skeleton.y = canvas.height - groundY - bounds.offset.y * scale;
      skeleton.color.a = options.alpha ?? 1;
      skeleton.updateWorldTransform();

      renderer.camera.viewportWidth = canvas.width;
      renderer.camera.viewportHeight = canvas.height;
      renderer.camera.position.x = canvas.width / 2;
      renderer.camera.position.y = canvas.height / 2;
      renderer.camera.update();

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      renderer.begin();
      renderer.drawSkeleton(skeleton, false);
      renderer.end();
      lastDraw = now;
      api.lastBackend = 'webgl-cell';
      return canvas;
    } catch (error) {
      if (!warned) {
        warned = true;
        console.error('Spine cell 渲染失败:', error.message);
      }
      return null;
    }
  }

  const api = {
    get available() {
      return Boolean(gl && renderer && !contextLost && !gl.isContextLost());
    },
    canvas: null,
    gl: null,
    get targetCanvas() {
      return targetCanvas;
    },
    lastBackend: 'unavailable',
    createTexture,
    createInstance,
    stripShadowSlots,
    draw,
    beginOverlay,
    clearOverlay,
    renderToCell,
  };

  initialize();
  api.canvas = canvas;
  api.gl = gl;
  api.lastBackend = api.available ? 'webgl' : 'unavailable';
  window.CultivationSpineGPU = api;
})();
