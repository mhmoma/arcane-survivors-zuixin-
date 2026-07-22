(function initBlankGameContent(root) {
  'use strict';

  // 内容层是 config.js 中 copy 的只读投影，便于未来替换整套内容包。
  const namespace = root.BlankGame = root.BlankGame || {};
  const copy = namespace.config && namespace.config.copy;
  if (!copy) throw new Error('content.js 需要先加载 config.js。');

  namespace.content = Object.freeze({
    actions: copy.actions,
    user: copy.user,
    ai: copy.ai,
    storage: copy.storage,
  });
}(window));
