(function initBlankGameSdkAdapter(root) {
  'use strict';

  const namespace = root.BlankGame = root.BlankGame || {};
  const PHASES = new Set(['start', 'resource_loading', 'runtime_initializing', 'first_frame', 'ready']);
  const MAX_KV_BYTES = 5 * 1024 * 1024;

  function sdk() {
    return window.dzmm || null;
  }

  function localError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function hasInvalidUnicode(value) {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (next < 0xdc00 || next > 0xdfff) return true;
        index += 1;
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        return true;
      }
    }
    return false;
  }

  function cleanText(value, label, minimum, maximum) {
    if (typeof value !== 'string') throw localError('INVALID_REQUEST', label + '必须是字符串。');
    const text = value.normalize('NFC').trim();
    const length = Array.from(text).length;
    if (length < minimum || length > maximum) {
      throw localError('INVALID_REQUEST', label + '长度不符合要求。');
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text) || hasInvalidUnicode(text)) {
      throw localError('INVALID_REQUEST', label + '包含无效字符。');
    }
    return text;
  }

  function requireMethod(area, method) {
    const current = sdk();
    const owner = area ? current && current[area] : current;
    if (!owner || typeof owner[method] !== 'function') {
      throw localError('SDK_UNAVAILABLE', 'Gamefy SDK 暂不可用。');
    }
    return { owner, method: owner[method] };
  }

  function validateKey(key) {
    return cleanText(key, 'KV 键', 1, 256);
  }

  function validateJsonValue(value, seen) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw localError('INVALID_REQUEST', 'KV 数据包含无效数字。');
      return;
    }
    if (!value || typeof value !== 'object') {
      throw localError('INVALID_REQUEST', 'KV 数据必须可以安全序列化。');
    }
    if (seen.has(value)) throw localError('INVALID_REQUEST', 'KV 数据不能包含循环引用。');
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => validateJsonValue(item, seen));
    } else if (isPlainObject(value)) {
      Object.entries(value).forEach(([key, item]) => {
        cleanText(key, 'KV 字段名', 1, 256);
        validateJsonValue(item, seen);
      });
    } else {
      throw localError('INVALID_REQUEST', 'KV 数据只能包含普通对象和数组。');
    }
    seen.delete(value);
  }

  function validateKvValue(value) {
    if (value === null) throw localError('INVALID_REQUEST', 'KV 数据不能为 null。');
    validateJsonValue(value, new Set());
    const serialized = JSON.stringify(value);
    const bytes = typeof TextEncoder === 'function'
      ? new TextEncoder().encode(serialized).byteLength
      : serialized.length * 3;
    if (bytes > MAX_KV_BYTES) throw localError('INVALID_REQUEST', 'KV 数据超过大小限制。');
  }

  function isOnline() {
    return Boolean(sdk());
  }

  async function detect(timeoutMs) {
    const requested = Number(timeoutMs);
    const timeout = Number.isFinite(requested) ? Math.max(0, Math.min(5000, requested)) : 0;
    if (isOnline() || timeout === 0) return isOnline();
    const deadline = Date.now() + timeout;
    return new Promise((resolve) => {
      function check() {
        if (isOnline()) return resolve(true);
        const remaining = deadline - Date.now();
        if (remaining <= 0) return resolve(false);
        window.setTimeout(check, Math.min(50, remaining));
      }
      check();
    });
  }

  function loadingProgress(phase, message) {
    if (!PHASES.has(phase)) return false;
    try {
      if (window.dzmm && window.dzmm.loading && typeof window.dzmm.loading.progress === 'function') {
        window.dzmm.loading.progress({
          phase,
          message: typeof message === 'string' ? message.slice(0, 160) : undefined,
        });
        return true;
      }
    } catch (_) {
      // 启动遥测不能阻断页面。
    }
    return false;
  }

  function loadingReady() {
    try {
      if (window.dzmm && window.dzmm.loading && typeof window.dzmm.loading.ready === 'function') {
        window.dzmm.loading.ready();
        return true;
      }
    } catch (_) {
      // 启动遥测不能阻断页面。
    }
    return false;
  }

  function loadingError(error) {
    const message = error && typeof error.message === 'string'
      ? error.message.slice(0, 160)
      : '游戏启动失败。';
    try {
      if (window.dzmm && window.dzmm.loading && typeof window.dzmm.loading.error === 'function') {
        window.dzmm.loading.error('BOOT_FAILED', message);
        return true;
      }
    } catch (_) {
      // 启动遥测不能阻断页面。
    }
    return false;
  }

  async function getUserProfile() {
    const target = requireMethod('user', 'info');
    const response = await target.method.call(target.owner);
    if (!isPlainObject(response)) {
      throw localError('INVALID_RESPONSE', '用户服务返回了无效数据。');
    }
    const name = response.name === null || response.name === undefined || response.name === ''
      ? null
      : cleanText(response.name, '玩家名称', 1, 64);
    let avatarUrl = null;
    if (response.avatarUrl !== null && response.avatarUrl !== undefined && response.avatarUrl !== '') {
      const rawUrl = cleanText(response.avatarUrl, '玩家头像地址', 1, 2048);
      let parsed;
      try {
        parsed = new URL(rawUrl, window.location.href);
      } catch (_) {
        throw localError('INVALID_RESPONSE', '玩家头像地址无效。');
      }
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw localError('INVALID_RESPONSE', '玩家头像地址不安全。');
      }
      avatarUrl = parsed.href;
    }
    return Object.freeze({ name, avatarUrl });
  }

  async function kvGet(key) {
    const safeKey = validateKey(key);
    const target = requireMethod('kv', 'get');
    const response = await target.method.call(target.owner, safeKey);
    if (response === null || response === undefined) return null;
    if (!isPlainObject(response) || !Object.prototype.hasOwnProperty.call(response, 'value')) {
      throw localError('INVALID_RESPONSE', 'KV 读取返回了无效数据。');
    }
    return response.value;
  }

  async function kvPut(key, value, options) {
    const safeKey = validateKey(key);
    validateKvValue(value);
    const input = options === undefined ? {} : options;
    if (!isPlainObject(input) || Object.keys(input).some((keyName) => keyName !== 'flush')) {
      throw localError('INVALID_REQUEST', 'KV 写入选项无效。');
    }
    if (input.flush !== undefined && typeof input.flush !== 'boolean') {
      throw localError('INVALID_REQUEST', 'KV flush 选项必须是布尔值。');
    }
    const target = requireMethod('kv', 'put');
    return target.method.call(target.owner, safeKey, value, { flush: input.flush === true });
  }

  function validateMessages(messages) {
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 20) {
      throw localError('INVALID_REQUEST', 'AI 消息数量无效。');
    }
    return messages.map((message) => {
      if (!isPlainObject(message)) throw localError('INVALID_REQUEST', 'AI 消息结构无效。');
      const keys = Object.keys(message);
      if (keys.length !== 2 || !keys.includes('role') || !keys.includes('content')) {
        throw localError('INVALID_REQUEST', 'AI 消息只能包含 role 和 content。');
      }
      if (message.role !== 'user' && message.role !== 'assistant') {
        throw localError('INVALID_REQUEST', 'AI 消息 role 无效。');
      }
      return {
        role: message.role,
        content: cleanText(message.content, 'AI 消息内容', 1, 12000),
      };
    });
  }

  function mergeStream(current, next) {
    if (!current || next.startsWith(current)) return next;
    if (current.endsWith(next)) return current;
    return current + next;
  }

  async function completeText(options, onText) {
    if (!isPlainObject(options)) throw localError('INVALID_REQUEST', 'AI 请求结构无效。');
    const model = cleanText(options.model, 'AI 模型', 1, 160);
    const maxTokens = Number(options.maxTokens);
    if (!Number.isInteger(maxTokens) || maxTokens < 200 || maxTokens > 3000) {
      throw localError('INVALID_REQUEST', 'AI maxTokens 必须在 200 到 3000 之间。');
    }
    if (onText !== undefined && typeof onText !== 'function') {
      throw localError('INVALID_REQUEST', 'AI 流式回调无效。');
    }
    const messages = validateMessages(options.messages);
    const target = requireMethod('', 'completions');
    let streamed = '';
    const response = await target.method.call(target.owner, {
      model,
      messages,
      maxTokens,
    }, (content, done) => {
      if (typeof content !== 'string') return;
      const clean = content.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
      streamed = mergeStream(streamed, clean).slice(0, 4000);
      if (onText) {
        try {
          onText(streamed, Boolean(done));
        } catch (_) {
          // 展示回调失败不应中断已经发出的请求。
        }
      }
    });
    if (typeof response === 'string' && response.trim()) return response;
    if (isPlainObject(response)) {
      if (typeof response.text === 'string' && response.text.trim()) return response.text;
      if (typeof response.content === 'string' && response.content.trim()) return response.content;
    }
    return streamed;
  }

  namespace.sdkAdapter = Object.freeze({
    isOnline,
    detect,
    loadingProgress,
    loadingReady,
    loadingError,
    getUserProfile,
    kvGet,
    kvPut,
    completeText,
  });
}(window));
