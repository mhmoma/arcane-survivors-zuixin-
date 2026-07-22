(function bootstrapBlankGame(root) {
  'use strict';

  const Game = root.BlankGame || {};
  const state = {
    busy: false,
    generation: 0,
    playerName: '',
    frameRendered: false,
    readyReported: false,
  };

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function readPath(value, path) {
    return path.split('.').reduce((current, key) => (
      current && Object.prototype.hasOwnProperty.call(current, key) ? current[key] : undefined
    ), value);
  }

  function requireText(value, label, maximum) {
    if (typeof value !== 'string' || !value.trim() || Array.from(value).length > maximum) {
      throw new Error(label + '无效。');
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
      throw new Error(label + '包含无效字符。');
    }
  }

  function validateAction(action, expectedFeature) {
    if (!isPlainObject(action) || action.feature !== expectedFeature) {
      throw new Error('示例操作配置无效。');
    }
    ['id', 'badge', 'title', 'description'].forEach((key) => {
      requireText(action[key], 'copy.actions.' + key, 160);
    });
    if (!Array.isArray(action.sdkLabelParts) || !action.sdkLabelParts.length) {
      throw new Error('示例 API 标签无效。');
    }
    action.sdkLabelParts.forEach((parts) => {
      if (!Array.isArray(parts) || !parts.length) throw new Error('示例 API 标签无效。');
      parts.forEach((part) => requireText(part, '示例 API 标签', 48));
    });
  }

  function validateConfig(config) {
    if (!isPlainObject(config) || config.version !== 1) throw new Error('config.js 版本无效。');
    [
      'brand.documentTitle', 'brand.eyebrow', 'brand.name', 'brand.tagline',
      'copy.loading.start', 'copy.loading.runtimeInitializing', 'copy.loading.firstFrame',
      'copy.connection.connecting', 'copy.connection.online', 'copy.connection.offline',
      'copy.connection.error', 'copy.intro.label', 'copy.intro.title', 'copy.intro.text',
      'copy.section.eyebrow', 'copy.section.title', 'copy.section.description', 'copy.section.empty',
      'copy.user.loading.label', 'copy.user.loading.title', 'copy.user.loading.text',
      'copy.user.success.label', 'copy.user.success.title', 'copy.user.success.text',
      'copy.user.fallbackName', 'copy.user.fallback.label', 'copy.user.fallback.title',
      'copy.user.fallback.text', 'copy.user.avatarAlt', 'copy.ai.loading.label',
      'copy.ai.loading.title', 'copy.ai.loading.text', 'copy.ai.streamingTitle',
      'copy.ai.successTitle', 'copy.ai.fallbackTitle', 'copy.ai.successLabel',
      'copy.ai.fallbackLabel', 'copy.storage.loading.label', 'copy.storage.loading.title',
      'copy.storage.loading.text', 'copy.storage.title', 'copy.storage.remoteText',
      'copy.storage.localText', 'copy.storage.memoryText', 'copy.storage.remoteLabel',
      'copy.storage.localLabel', 'copy.storage.countMeta', 'copy.errors.action.label',
      'copy.errors.action.title', 'copy.errors.action.text', 'copy.errors.boot.label',
      'copy.errors.boot.title', 'copy.errors.boot.text', 'copy.footer.text', 'copy.footer.hint',
    ].forEach((path) => requireText(readPath(config, path), path, 260));
    if (!config.copy.user.success.title.includes('{name}')
      || !config.copy.user.fallback.title.includes('{name}')
      || !config.copy.user.avatarAlt.includes('{name}')
      || !config.copy.storage.title.includes('{count}')
      || !config.copy.storage.countMeta.includes('{count}')) {
      throw new Error('动态文案占位符缺失。');
    }
    if (!Array.isArray(config.copy.actions) || config.copy.actions.length !== 3) {
      throw new Error('三个示例操作必须完整保留。');
    }
    const expected = { user: 'userProfile', ai: 'aiText', storage: 'kvCounter' };
    const ids = new Set();
    config.copy.actions.forEach((action) => {
      if (!expected[action.id] || ids.has(action.id)) throw new Error('示例操作 ID 无效。');
      ids.add(action.id);
      validateAction(action, expected[action.id]);
    });
    if (!isPlainObject(config.theme)
      || !['light', 'dark'].includes(config.theme.colorScheme)
      || !isPlainObject(config.theme.tokens)) {
      throw new Error('theme 配置无效。');
    }
    Object.entries(config.theme.tokens).forEach(([key, value]) => {
      requireText(value, 'theme.tokens.' + key, 120);
      if (/[;{}<>]|url\s*\(/i.test(value)) throw new Error('theme token 包含不安全内容。');
    });
    if (!isPlainObject(config.features)) throw new Error('features 配置缺失。');
    ['userProfile', 'aiText', 'kvCounter', 'showAvatar', 'showSdkLabels', 'sdkStatus']
      .forEach((key) => {
        if (typeof config.features[key] !== 'boolean') throw new Error('features.' + key + ' 无效。');
      });
    if (!isPlainObject(config.sdk)
      || !Number.isInteger(config.sdk.attachTimeoutMs)
      || config.sdk.attachTimeoutMs < 0
      || config.sdk.attachTimeoutMs > 5000) {
      throw new Error('sdk.attachTimeoutMs 无效。');
    }
    return config;
  }

  function requireModule(value, methods, label) {
    if (!value || methods.some((method) => typeof value[method] !== 'function')) {
      throw new Error(label + ' 模块缺失或不完整。');
    }
  }

  function requireRuntime() {
    Game.config = validateConfig(Game.config);
    if (!isPlainObject(Game.content)
      || !Array.isArray(Game.content.actions)
      || !isPlainObject(Game.content.user)
      || !isPlainObject(Game.content.ai)
      || !isPlainObject(Game.content.storage)) {
      throw new Error('content.js 模块缺失或不完整。');
    }
    requireModule(Game.sdkAdapter, [
      'isOnline', 'detect', 'loadingProgress', 'loadingReady', 'loadingError',
      'getUserProfile', 'kvGet', 'kvPut', 'completeText',
    ], 'sdk-adapter.js');
    requireModule(Game.storage, [
      'load', 'incrementDemo', 'readAiRecord', 'saveAiRecord', 'validateConfig',
    ], 'storage.js');
    requireModule(Game.aiDirector, ['generateGreeting', 'isBusy', 'validateConfig'], 'ai-director.js');
    requireModule(Game.view, [
      'init', 'configure', 'renderActions', 'setConnection', 'setStage',
      'setBusy', 'setActionMeta', 'bindActions',
    ], 'view.js');
    Game.storage.validateConfig();
    Game.aiDirector.validateConfig();
  }

  function format(template, values) {
    return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(values || {}, key) ? String(values[key]) : match
    ));
  }

  function present(copy, options) {
    const input = options || {};
    const values = input.values || {};
    Game.view.setStage({
      label: format(copy.label, values),
      title: format(copy.title, values),
      text: format(copy.text, values),
      tone: input.tone || 'accent',
      busy: input.busy === true,
      avatarUrl: input.avatarUrl || '',
      avatarAlt: format(input.avatarAlt || '', values),
    });
  }

  async function runAction(loadingCopy, operation) {
    if (state.busy) return;
    state.busy = true;
    const generation = ++state.generation;
    Game.view.setBusy(true);
    present(loadingCopy, { busy: true });
    try {
      await operation(generation);
    } catch (error) {
      console.error('[空白模板] 操作失败', error && error.code ? error.code : '未知错误');
      if (generation === state.generation) present(Game.config.copy.errors.action, { tone: 'danger' });
    } finally {
      if (generation === state.generation) {
        state.busy = false;
        Game.view.setBusy(false);
      }
    }
  }

  function userAction() {
    const copy = Game.content.user;
    return runAction(copy.loading, async () => {
      let user = null;
      try {
        user = await Game.sdkAdapter.getUserProfile();
      } catch (_) {
        user = null;
      }
      state.playerName = user && user.name ? user.name : copy.fallbackName;
      present(user ? copy.success : copy.fallback, {
        values: { name: state.playerName },
        tone: user ? 'success' : 'warning',
        avatarUrl: Game.config.features.showAvatar && user ? user.avatarUrl : '',
        avatarAlt: copy.avatarAlt,
      });
    });
  }

  function aiAction() {
    const copy = Game.content.ai;
    return runAction(copy.loading, async () => {
      const result = await Game.aiDirector.generateGreeting({
        playerName: state.playerName || Game.config.ai.guestName,
      });
      Game.view.setStage({
        label: result.source === 'ai' ? copy.successLabel : copy.fallbackLabel,
        title: result.source === 'ai' ? copy.successTitle : copy.fallbackTitle,
        text: result.text,
        tone: result.source === 'ai' ? 'success' : 'warning',
        busy: false,
      });
    });
  }

  function storageAction() {
    const copy = Game.content.storage;
    return runAction(copy.loading, async () => {
      const result = await Game.storage.incrementDemo();
      const remote = result.source === 'kv';
      const detail = remote
        ? copy.remoteText
        : (result.source === 'local' ? copy.localText : copy.memoryText);
      Game.view.setStage({
        label: remote ? copy.remoteLabel : copy.localLabel,
        title: format(copy.title, { count: result.count }),
        text: detail,
        tone: remote ? 'success' : 'warning',
        busy: false,
      });
      Game.view.setActionMeta('storage', format(copy.countMeta, { count: result.count }));
    });
  }

  const handlers = Object.freeze({
    user: userAction,
    ai: aiAction,
    storage: storageAction,
  });

  function reportFirstFrame() {
    Game.sdkAdapter.loadingProgress('first_frame', Game.config.copy.loading.firstFrame);
    if (Game.sdkAdapter.loadingReady()) state.readyReported = true;
  }

  async function hydrate() {
    const storagePromise = Game.config.features.kvCounter
      ? Game.storage.load()
      : Promise.resolve(null);
    const [online, saved] = await Promise.all([
      Game.sdkAdapter.detect(Game.config.sdk.attachTimeoutMs),
      storagePromise,
    ]);
    Game.view.setConnection(
      online ? 'online' : 'offline',
      online ? Game.config.copy.connection.online : Game.config.copy.connection.offline,
    );
    if (saved) {
      Game.view.setActionMeta('storage', format(Game.config.copy.storage.countMeta, {
        count: saved.state.demos.kvClicks,
      }));
    }
    if (online && state.frameRendered && !state.readyReported) reportFirstFrame();
  }

  function emergencyBootError() {
    const label = document.getElementById('stageLabel');
    const title = document.getElementById('stageTitle');
    const text = document.getElementById('stageText');
    if (label) label.textContent = '启动';
    if (title) title.textContent = '模板启动失败';
    if (text) text.textContent = '请检查配置与脚本加载顺序，然后刷新页面。';
  }

  function boot() {
    try {
      requireRuntime();
      Game.view.init();
      Game.view.configure(Game.config);
      Game.view.renderActions(Game.content.actions, Game.config.features);
      present(Game.config.copy.intro, { tone: 'accent' });
      Game.view.setBusy(false);
      Game.view.bindActions((actionId) => {
        if (handlers[actionId]) handlers[actionId]();
      });
      state.playerName = Game.config.ai.guestName;
      Game.sdkAdapter.loadingProgress(
        'runtime_initializing',
        Game.config.copy.loading.runtimeInitializing,
      );
      root.requestAnimationFrame(() => {
        state.frameRendered = true;
        reportFirstFrame();
      });
      hydrate().catch(() => {
        Game.view.setConnection('offline', Game.config.copy.connection.offline);
      });
    } catch (error) {
      console.error('[空白模板] 启动失败', error && error.message ? error.message : '未知错误');
      if (Game.sdkAdapter && typeof Game.sdkAdapter.loadingError === 'function') {
        Game.sdkAdapter.loadingError(error);
      }
      emergencyBootError();
      try {
        Game.view.init();
        Game.view.setConnection('error', Game.config.copy.connection.error);
        Game.view.setBusy(false);
      } catch (_) {
        // 紧急错误页面不能再次阻断启动流程。
      }
    }
  }

  if (Game.sdkAdapter && typeof Game.sdkAdapter.loadingProgress === 'function') {
    const startCopy = Game.config && Game.config.copy && Game.config.copy.loading
      ? Game.config.copy.loading.start
      : '正在启动空白模板';
    Game.sdkAdapter.loadingProgress('start', startCopy);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}(window));
