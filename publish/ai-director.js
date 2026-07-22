(function initBlankGameAiDirector(root) {
  'use strict';

  const namespace = root.BlankGame = root.BlankGame || {};
  const SDK = namespace.sdkAdapter;
  const Storage = namespace.storage;
  const memoryRecords = new Map();
  const attemptedSignatures = new Set();
  const LOCK_LEASE_MS = 30000;
  const LOCK_WAIT_MS = 12000;
  let ownerSequence = 0;
  let inFlight = null;

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function hasExactKeys(value, keys) {
    const actual = Object.keys(value).sort();
    const expected = keys.slice().sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
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

  function sanitizeConfigText(value, label, minimum, maximum) {
    if (typeof value !== 'string') throw new Error(label + '必须是字符串。');
    const text = value.normalize('NFC').trim();
    const length = Array.from(text).length;
    if (length < minimum || length > maximum) throw new Error(label + '长度无效。');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text) || hasInvalidUnicode(text)) {
      throw new Error(label + '包含无效字符。');
    }
    return text;
  }

  function settings() {
    const value = namespace.config && namespace.config.ai;
    if (!isPlainObject(value)) throw new Error('ai 配置缺失。');
    const model = sanitizeConfigText(value.model, 'ai.model', 1, 160);
    const prompt = sanitizeConfigText(value.prompt, 'ai.prompt', 10, 2000);
    const guestName = sanitizeConfigText(value.guestName, 'ai.guestName', 1, 40);
    if (!Number.isInteger(value.cacheVersion) || value.cacheVersion < 1 || value.cacheVersion > 999999) {
      throw new Error('ai.cacheVersion 无效。');
    }
    if (!prompt.includes('{playerName}')) throw new Error('ai.prompt 缺少 {playerName}。');
    if (!Number.isInteger(value.maxTokens) || value.maxTokens < 200 || value.maxTokens > 3000) {
      throw new Error('ai.maxTokens 无效。');
    }
    if (!Number.isInteger(value.outputMinCharacters) || value.outputMinCharacters < 1) {
      throw new Error('ai.outputMinCharacters 无效。');
    }
    if (!Number.isInteger(value.outputMaxCharacters)
      || value.outputMaxCharacters < value.outputMinCharacters
      || value.outputMaxCharacters > 280) {
      throw new Error('ai.outputMaxCharacters 无效。');
    }
    if (!Array.isArray(value.fallbacks) || value.fallbacks.length < 1 || value.fallbacks.length > 12) {
      throw new Error('ai.fallbacks 无效。');
    }
    const fallbacks = value.fallbacks.map((item, index) => (
      sanitizeConfigText(item, 'ai.fallbacks[' + index + ']', value.outputMinCharacters, value.outputMaxCharacters)
    ));
    if (!Storage
      || typeof Storage.readAiRecordState !== 'function'
      || typeof Storage.saveAiRecord !== 'function') {
      throw new Error('ai-director 缺少存储模块。');
    }
    return {
      cacheVersion: value.cacheVersion,
      model,
      prompt,
      guestName,
      maxTokens: value.maxTokens,
      outputMinCharacters: value.outputMinCharacters,
      outputMaxCharacters: value.outputMaxCharacters,
      fallbacks,
    };
  }

  function normalizePlayerName(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const text = value.normalize('NFC').trim().replace(/\s+/g, ' ');
    if (!text || Array.from(text).length > 40 || hasInvalidUnicode(text)) return fallback;
    return text;
  }

  function normalizePreview(value, maximum) {
    if (typeof value !== 'string') return '';
    const text = value
      .normalize('NFC')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return Array.from(text).slice(0, maximum).join('');
  }

  function validateAiText(value, config) {
    if (typeof value !== 'string' || /[\r\n]/.test(value) || /\u0060{3}/.test(value)) return null;
    const text = value.normalize('NFC').replace(/[ \t]+/g, ' ').trim();
    const length = Array.from(text).length;
    if (length < config.outputMinCharacters || length > config.outputMaxCharacters) return null;
    if (/[\u0000-\u001f\u007f]/.test(text) || hasInvalidUnicode(text)) return null;
    return text;
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createCoordinationError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function makeOwner() {
    ownerSequence += 1;
    let random;
    if (typeof root.crypto?.randomUUID === 'function') {
      random = root.crypto.randomUUID();
    } else if (typeof root.crypto?.getRandomValues === 'function') {
      const values = new Uint32Array(2);
      root.crypto.getRandomValues(values);
      random = `${values[0].toString(36)}-${values[1].toString(36)}`;
    } else {
      random = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
    return `${random}:${ownerSequence}`;
  }

  function delay(milliseconds) {
    return new Promise((resolve) => root.setTimeout(resolve, milliseconds));
  }

  function readLease(key) {
    const raw = root.localStorage.getItem(key);
    if (raw === null) return null;
    let value;
    try {
      value = JSON.parse(raw);
    } catch (_) {
      return null;
    }
    if (!isPlainObject(value)
      || !hasExactKeys(value, ['owner', 'expiresAt'])
      || typeof value.owner !== 'string'
      || !value.owner
      || !Number.isFinite(value.expiresAt)) return null;
    return value;
  }

  function writeLease(key, value) {
    root.localStorage.setItem(key, JSON.stringify(value));
  }

  function removeOwnedLease(key, owner) {
    try {
      if (readLease(key)?.owner === owner) root.localStorage.removeItem(key);
    } catch (_) {
      // 页面退出或隐私设置变化时，租约会在 expiresAt 后自然失效。
    }
  }

  async function withLocalLease(name, operation) {
    const key = `blank-ai-lock:${name}`;
    const owner = makeOwner();
    const deadline = Date.now() + LOCK_WAIT_MS;
    try {
      root.localStorage.getItem(key);
    } catch (_) {
      throw createCoordinationError('AI_LOCK_UNAVAILABLE', '同源 AI 协调存储不可用。');
    }

    while (Date.now() <= deadline) {
      let current;
      try {
        current = readLease(key);
      } catch (_) {
        throw createCoordinationError('AI_LOCK_UNAVAILABLE', '同源 AI 协调存储不可用。');
      }
      const now = Date.now();
      if (!current || current.expiresAt <= now) {
        try {
          writeLease(key, { owner, expiresAt: now + LOCK_LEASE_MS });
        } catch (_) {
          throw createCoordinationError('AI_LOCK_UNAVAILABLE', '同源 AI 协调租约无法写入。');
        }
        await delay(40);
        let confirmed;
        try {
          confirmed = readLease(key);
        } catch (_) {
          throw createCoordinationError('AI_LOCK_UNAVAILABLE', '同源 AI 协调租约无法确认。');
        }
        if (confirmed?.owner === owner) {
          const heartbeat = root.setInterval(() => {
            try {
              if (readLease(key)?.owner === owner) {
                writeLease(key, { owner, expiresAt: Date.now() + LOCK_LEASE_MS });
              }
            } catch (_) {
              // 预算预留会在 AI 调用前持久化；心跳失败时只让原租约自然到期。
            }
          }, Math.floor(LOCK_LEASE_MS / 3));
          try {
            return await operation();
          } finally {
            root.clearInterval(heartbeat);
            removeOwnedLease(key, owner);
          }
        }
      }
      await delay(70);
    }
    throw createCoordinationError('AI_LOCK_TIMEOUT', '等待同源 AI 协调超时。');
  }

  async function withPromptLock(promptSignature, operation) {
    const name = `blank-ai:${promptSignature}`;
    const locks = root.navigator?.locks;
    if (locks && typeof locks.request === 'function') {
      let entered = false;
      try {
        return await locks.request(name, { mode: 'exclusive' }, async () => {
          entered = true;
          return operation();
        });
      } catch (error) {
        if (entered) throw error;
      }
    }
    return withLocalLease(name, operation);
  }

  function describe(options) {
    const config = settings();
    const input = isPlainObject(options) ? options : {};
    const playerName = normalizePlayerName(input.playerName, config.guestName);
    const prompt = config.prompt.split('{playerName}').join(JSON.stringify(playerName));
    const canonical = JSON.stringify({
      cacheVersion: config.cacheVersion,
      model: config.model,
      maxTokens: config.maxTokens,
      outputMinCharacters: config.outputMinCharacters,
      outputMaxCharacters: config.outputMaxCharacters,
      prompt,
      fallbacks: config.fallbacks,
    });
    const digest = stableHash(canonical).toString(16).padStart(8, '0');
    return {
      config,
      playerName,
      prompt,
      promptSignature: `blank-greeting:v${config.cacheVersion}:${digest}:${canonical.length}`,
      onUpdate: typeof input.onUpdate === 'function' ? input.onUpdate : null,
    };
  }

  function fallbackText(info) {
    const index = stableHash(`blank-game|${info.promptSignature}|${info.playerName}`)
      % info.config.fallbacks.length;
    return info.config.fallbacks[index];
  }

  function createRecord(info, text, source, reason) {
    return Object.freeze({
      promptSignature: info.promptSignature,
      cacheVersion: info.config.cacheVersion,
      source,
      text,
      reason,
      savedAt: new Date().toISOString(),
    });
  }

  function validateRecord(value, info) {
    if (!isPlainObject(value) || !hasExactKeys(value, [
      'promptSignature', 'cacheVersion', 'source', 'text', 'reason', 'savedAt',
    ])) return null;
    if (value.promptSignature !== info.promptSignature
      || value.cacheVersion !== info.config.cacheVersion
      || (value.source !== 'ai' && value.source !== 'fallback')) return null;
    const text = validateAiText(value.text, info.config);
    if (!text) return null;
    if (value.reason !== null && (typeof value.reason !== 'string' || !value.reason)) return null;
    const savedAt = Date.parse(value.savedAt);
    if (!Number.isFinite(savedAt) || new Date(savedAt).toISOString() !== value.savedAt) return null;
    return Object.freeze({ ...value, text });
  }

  function resultFromRecord(record, cached) {
    return Object.freeze({
      text: record.text,
      source: record.source,
      reason: record.reason,
      cached: cached === true,
      promptSignature: record.promptSignature,
    });
  }

  async function findCachedRecord(info) {
    const memory = validateRecord(memoryRecords.get(info.promptSignature), info);
    if (memory) return { record: memory, closed: false, reason: null };
    try {
      const snapshot = await Storage.readAiRecordState(info.promptSignature);
      if (snapshot?.status === 'hit') {
        const stored = validateRecord(snapshot.record, info);
        if (!stored) return { record: null, closed: true, reason: 'invalid-cache' };
        memoryRecords.set(info.promptSignature, stored);
        attemptedSignatures.add(info.promptSignature);
        return { record: stored, closed: false, reason: null };
      }
      if (snapshot?.status === 'invalid') {
        return { record: null, closed: true, reason: 'invalid-cache' };
      }
      if (snapshot?.status === 'error' && SDK?.isOnline?.()) {
        return { record: null, closed: true, reason: 'kv-read-failed' };
      }
    } catch (_) {
      if (SDK?.isOnline?.()) return { record: null, closed: true, reason: 'kv-read-failed' };
    }
    return { record: null, closed: false, reason: null };
  }

  function coordinationFallback(info, reason) {
    attemptedSignatures.add(info.promptSignature);
    const record = createRecord(info, fallbackText(info), 'fallback', reason);
    memoryRecords.set(info.promptSignature, record);
    return resultFromRecord(record, false);
  }

  async function reserveBudget(info) {
    attemptedSignatures.add(info.promptSignature);
    const reservation = createRecord(info, fallbackText(info), 'fallback', 'budget-reserved');
    memoryRecords.set(info.promptSignature, reservation);
    try {
      const saved = await Storage.saveAiRecord(reservation);
      if (saved?.source === 'local' || saved?.source === 'kv') return true;
    } catch (_) {
      // 未形成可供其他标签页读取的预留时，当前标签页也不得调用 AI。
    }
    return false;
  }

  async function perform(info) {
    // 必须在跨标签页锁内重新读取缓存和预算，不能信任排队前的页面状态。
    const cached = await findCachedRecord(info);
    if (cached.record) return resultFromRecord(cached.record, true);
    if (cached.closed) {
      return coordinationFallback(info, cached.reason);
    }
    if (attemptedSignatures.has(info.promptSignature)) {
      return coordinationFallback(info, 'budget-consumed');
    }

    if (!(await reserveBudget(info))) {
      return coordinationFallback(info, 'budget-reservation-failed');
    }
    let text = fallbackText(info);
    let source = 'fallback';
    let reason = 'sdk-unavailable';
    if (SDK && typeof SDK.completeText === 'function' && SDK.isOnline()) {
      let streamed = '';
      try {
        const response = await SDK.completeText({
          model: info.config.model,
          maxTokens: info.config.maxTokens,
          messages: [{ role: 'user', content: info.prompt }],
        }, (content) => {
          const preview = normalizePreview(content, info.config.outputMaxCharacters + 1);
          if (!preview) return;
          streamed = preview;
          const validatedPreview = validateAiText(preview, info.config);
          if (validatedPreview && info.onUpdate) info.onUpdate(validatedPreview);
        });
        const validated = validateAiText(response || streamed, info.config);
        if (validated) {
          text = validated;
          source = 'ai';
          reason = null;
        } else {
          reason = 'invalid-output';
        }
      } catch (_) {
        reason = 'request-failed';
      }
    }

    const record = createRecord(info, text, source, reason);
    memoryRecords.set(info.promptSignature, record);
    try {
      await Storage.saveAiRecord(record);
    } catch (_) {
      // 当前页面仍复用内存结果，后续刷新只能依赖已成功的本地或 KV 写入。
    }
    return resultFromRecord(record, false);
  }

  async function coordinate(options) {
    const info = describe(options);
    try {
      return await withPromptLock(info.promptSignature, () => perform(info));
    } catch (error) {
      if (error?.code === 'AI_LOCK_TIMEOUT') return coordinationFallback(info, 'tab-lock-timeout');
      if (error?.code === 'AI_LOCK_UNAVAILABLE') return coordinationFallback(info, 'tab-lock-unavailable');
      throw error;
    }
  }

  function generateGreeting(options) {
    if (inFlight) return inFlight;
    inFlight = coordinate(options).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  namespace.aiDirector = Object.freeze({
    generateGreeting,
    isBusy: () => Boolean(inFlight),
    validateConfig: () => {
      settings();
      return true;
    },
  });
}(window));
