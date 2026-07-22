(function initBlankGameStorage(root) {
  'use strict';

  const namespace = root.BlankGame = root.BlankGame || {};
  const SDK = namespace.sdkAdapter;
  const SCHEMA_VERSION = 2;
  const LEGACY_SCHEMA_VERSION = 1;
  const EMPTY_TIMESTAMP = '1970-01-01T00:00:00.000Z';
  let memoryState = null;
  let writeQueue = Promise.resolve();

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

  function isIsoTimestamp(value) {
    if (typeof value !== 'string') return false;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
  }

  function settings() {
    const value = namespace.config && namespace.config.storage;
    if (!isPlainObject(value)) throw new Error('storage 配置缺失。');
    if (typeof value.key !== 'string' || !value.key.trim() || value.key.length > 256) {
      throw new Error('storage.key 无效。');
    }
    if (value.version !== SCHEMA_VERSION) throw new Error('storage.version 暂不受支持。');
    if (!Number.isInteger(value.maxCount) || value.maxCount < 1 || value.maxCount > 999999999) {
      throw new Error('storage.maxCount 无效。');
    }
    if (!Number.isInteger(value.aiCacheLimit) || value.aiCacheLimit < 1 || value.aiCacheLimit > 24) {
      throw new Error('storage.aiCacheLimit 无效。');
    }
    if (!SDK || typeof SDK.kvGet !== 'function' || typeof SDK.kvPut !== 'function') {
      throw new Error('storage 缺少 SDK 适配器。');
    }
    return value;
  }

  function cloneAiRecord(record) {
    return {
      promptSignature: record.promptSignature,
      cacheVersion: record.cacheVersion,
      source: record.source,
      text: record.text,
      reason: record.reason,
      savedAt: record.savedAt,
    };
  }

  function cloneState(state) {
    return {
      version: state.version,
      updatedAt: state.updatedAt,
      demos: { kvClicks: state.demos.kvClicks },
      ai: { records: state.ai.records.map(cloneAiRecord) },
    };
  }

  function defaultState(config) {
    return {
      version: config.version,
      updatedAt: EMPTY_TIMESTAMP,
      demos: { kvClicks: 0 },
      ai: { records: [] },
    };
  }

  function decode(value) {
    if (typeof value !== 'string') return value;
    if (!value || value.length > 50000) return null;
    try {
      return JSON.parse(value);
    } catch (_) {
      return null;
    }
  }

  function validateAiRecord(value) {
    if (!isPlainObject(value) || !hasExactKeys(value, [
      'promptSignature', 'cacheVersion', 'source', 'text', 'reason', 'savedAt',
    ])) return null;
    if (typeof value.promptSignature !== 'string'
      || !/^[a-z0-9:_-]{8,160}$/i.test(value.promptSignature)) return null;
    if (!Number.isInteger(value.cacheVersion) || value.cacheVersion < 1 || value.cacheVersion > 999999) {
      return null;
    }
    if (value.source !== 'ai' && value.source !== 'fallback') return null;
    if (typeof value.text !== 'string'
      || !value.text
      || Array.from(value.text).length > 280
      || /[\u0000-\u001f\u007f]/.test(value.text)) return null;
    if (value.reason !== null
      && (typeof value.reason !== 'string'
        || !value.reason
        || value.reason.length > 80
        || /[\u0000-\u001f\u007f]/.test(value.reason))) return null;
    if (!isIsoTimestamp(value.savedAt)) return null;
    return cloneAiRecord(value);
  }

  function validateCurrentState(value, config) {
    if (!isPlainObject(value) || !hasExactKeys(value, ['version', 'updatedAt', 'demos', 'ai'])) return null;
    if (value.version !== config.version || !isIsoTimestamp(value.updatedAt)) return null;
    if (!isPlainObject(value.demos) || !hasExactKeys(value.demos, ['kvClicks'])) return null;
    if (!Number.isInteger(value.demos.kvClicks)
      || value.demos.kvClicks < 0
      || value.demos.kvClicks > config.maxCount) return null;
    if (!isPlainObject(value.ai) || !hasExactKeys(value.ai, ['records']) || !Array.isArray(value.ai.records)) {
      return null;
    }
    if (value.ai.records.length > config.aiCacheLimit) return null;
    const records = [];
    const signatures = new Set();
    for (const item of value.ai.records) {
      const record = validateAiRecord(item);
      if (!record || signatures.has(record.promptSignature)) return null;
      signatures.add(record.promptSignature);
      records.push(record);
    }
    return {
      version: config.version,
      updatedAt: value.updatedAt,
      demos: { kvClicks: value.demos.kvClicks },
      ai: { records },
    };
  }

  function migrateLegacyState(value, config) {
    if (!isPlainObject(value) || !hasExactKeys(value, ['version', 'updatedAt', 'demos'])) return null;
    if (value.version !== LEGACY_SCHEMA_VERSION || !isIsoTimestamp(value.updatedAt)) return null;
    if (!isPlainObject(value.demos) || !hasExactKeys(value.demos, ['kvClicks'])) return null;
    if (!Number.isInteger(value.demos.kvClicks)
      || value.demos.kvClicks < 0
      || value.demos.kvClicks > config.maxCount) return null;
    return {
      version: config.version,
      updatedAt: value.updatedAt,
      demos: { kvClicks: value.demos.kvClicks },
      ai: { records: [] },
    };
  }

  function validateState(value, config) {
    const decoded = decode(value);
    return validateCurrentState(decoded, config) || migrateLegacyState(decoded, config);
  }

  function readLocal(config) {
    try {
      return validateState(root.localStorage.getItem(config.key), config);
    } catch (_) {
      return null;
    }
  }

  function writeLocal(config, state) {
    try {
      root.localStorage.setItem(config.key, JSON.stringify(state));
      return true;
    } catch (_) {
      return false;
    }
  }

  async function readRemote(config) {
    try {
      const raw = await SDK.kvGet(config.key);
      if (raw === null || raw === undefined) return { status: 'miss', state: null };
      const state = validateState(raw, config);
      return { status: state ? 'hit' : 'invalid', state };
    } catch (_) {
      return { status: 'error', state: null };
    }
  }

  function latestTimestamp(states) {
    const timestamps = states.map((state) => Date.parse(state.updatedAt)).filter(Number.isFinite);
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : EMPTY_TIMESTAMP;
  }

  function mergeStates(config, candidates) {
    const valid = candidates.filter((candidate) => candidate && candidate.state);
    if (!valid.length) return defaultState(config);
    const records = new Map();
    valid.forEach((candidate) => {
      candidate.state.ai.records.forEach((record) => {
        const current = records.get(record.promptSignature);
        if (!current
          || candidate.priority > current.priority
          || (candidate.priority === current.priority
            && Date.parse(record.savedAt) > Date.parse(current.record.savedAt))) {
          records.set(record.promptSignature, {
            record: cloneAiRecord(record),
            priority: candidate.priority,
          });
        }
      });
    });
    const mergedRecords = [...records.values()]
      .sort((left, right) => (
        Date.parse(right.record.savedAt) - Date.parse(left.record.savedAt)
        || right.priority - left.priority
        || (left.record.promptSignature < right.record.promptSignature ? -1 : 1)
      ))
      .slice(0, config.aiCacheLimit)
      .map((entry) => entry.record);
    return {
      version: config.version,
      updatedAt: latestTimestamp(valid.map((candidate) => candidate.state)),
      demos: {
        kvClicks: Math.max(...valid.map((candidate) => candidate.state.demos.kvClicks)),
      },
      ai: { records: mergedRecords },
    };
  }

  async function readSources(config) {
    const local = readLocal(config);
    const remote = await readRemote(config);
    const memory = validateState(memoryState, config);
    return { local, remote, memory };
  }

  function mergeSources(config, sources, proposed) {
    return mergeStates(config, [
      { state: sources.remote.state, priority: 1 },
      { state: sources.local, priority: 2 },
      { state: sources.memory, priority: 3 },
      { state: proposed || null, priority: 4 },
    ]);
  }

  async function persist(config, sources, proposed) {
    const merged = mergeSources(config, sources, proposed);
    memoryState = cloneState(merged);
    const localSaved = writeLocal(config, merged);
    let remoteSaved = false;
    if (sources.remote.status === 'miss' || sources.remote.status === 'hit') {
      try {
        await SDK.kvPut(config.key, merged, { flush: true });
        remoteSaved = true;
      } catch (_) {
        // 远端写入失败时保留已经合并的本地与内存状态。
      }
    }
    return {
      state: cloneState(merged),
      source: remoteSaved ? 'kv' : (localSaved ? 'local' : 'memory'),
    };
  }

  async function load() {
    const config = settings();
    const sources = await readSources(config);
    const merged = mergeSources(config, sources, null);
    memoryState = cloneState(merged);
    writeLocal(config, merged);
    const source = sources.remote.state
      ? 'kv'
      : (sources.local ? 'local' : (sources.memory ? 'memory' : 'memory'));
    return { state: cloneState(merged), source };
  }

  function enqueue(operation) {
    const pending = writeQueue.then(operation);
    writeQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  function incrementDemo() {
    return enqueue(async () => {
      const config = settings();
      const sources = await readSources(config);
      const current = mergeSources(config, sources, null);
      const next = cloneState(current);
      next.updatedAt = new Date().toISOString();
      next.demos.kvClicks = Math.min(config.maxCount, current.demos.kvClicks + 1);
      const saved = await persist(config, sources, next);
      return { count: saved.state.demos.kvClicks, source: saved.source };
    });
  }

  async function readAiRecordState(promptSignature) {
    if (typeof promptSignature !== 'string') return { status: 'invalid', record: null };
    const config = settings();
    const sources = await readSources(config);
    const current = mergeSources(config, sources, null);
    memoryState = cloneState(current);
    writeLocal(config, current);
    const record = current.ai.records.find((item) => item.promptSignature === promptSignature);
    if (record) return { status: 'hit', record: cloneAiRecord(record) };
    if (sources.remote.status === 'error') return { status: 'error', record: null };
    if (sources.remote.status === 'invalid') return { status: 'invalid', record: null };
    return { status: 'miss', record: null };
  }

  async function readAiRecord(promptSignature) {
    const result = await readAiRecordState(promptSignature);
    return result.status === 'hit' ? result.record : null;
  }

  function saveAiRecord(value) {
    return enqueue(async () => {
      const record = validateAiRecord(value);
      if (!record) throw new Error('拒绝保存无效 AI 缓存。');
      const config = settings();
      const sources = await readSources(config);
      const current = mergeSources(config, sources, null);
      const next = cloneState(current);
      next.updatedAt = new Date().toISOString();
      next.ai.records = [
        record,
        ...next.ai.records.filter((item) => item.promptSignature !== record.promptSignature),
      ].slice(0, config.aiCacheLimit);
      return persist(config, sources, next);
    });
  }

  namespace.storage = Object.freeze({
    load,
    incrementDemo,
    readAiRecord,
    readAiRecordState,
    saveAiRecord,
    validateConfig: () => {
      settings();
      return true;
    },
  });
}(window));
