(function initBlankGameView(root) {
  'use strict';

  const namespace = root.BlankGame = root.BlankGame || {};
  const elements = {};
  const ids = [
    'appShell', 'brandEyebrow', 'brandName', 'connectionState', 'connectionLabel',
    'stage', 'stageLabel', 'spinner', 'avatarFrame', 'avatar', 'stageTitle', 'stageText',
    'actionsEyebrow', 'actionsTitle', 'actionsDescription', 'actionGrid', 'emptyActions',
    'footerText', 'footerHint',
  ];
  const tokenMap = Object.freeze({
    page: '--page',
    pageGlow: '--page-glow',
    surface: '--surface',
    surfaceMuted: '--surface-muted',
    text: '--text',
    muted: '--muted',
    line: '--line',
    stage: '--stage',
    stageText: '--stage-text',
    stageMuted: '--stage-muted',
    accent: '--accent',
    accentSoft: '--accent-soft',
    success: '--success',
    warning: '--warning',
    danger: '--danger',
    focus: '--focus',
    shadow: '--shadow',
    radiusLarge: '--radius-large',
    radiusMedium: '--radius-medium',
    radiusSmall: '--radius-small',
  });
  let initialized = false;
  let actionsBound = false;

  function init() {
    if (initialized) return elements;
    ids.forEach((id) => {
      elements[id] = document.getElementById(id);
    });
    if (ids.some((id) => !elements[id])) throw new Error('页面结构不完整。');
    elements.avatar.referrerPolicy = 'no-referrer';
    elements.avatar.addEventListener('error', () => {
      elements.avatar.removeAttribute('src');
      elements.avatar.alt = '';
      elements.avatarFrame.hidden = true;
    });
    initialized = true;
    return elements;
  }

  function applyTheme(theme) {
    const documentRoot = document.documentElement;
    documentRoot.style.colorScheme = theme.colorScheme;
    Object.entries(theme.tokens).forEach(([name, rawValue]) => {
      const property = tokenMap[name];
      const value = String(rawValue).trim();
      if (property && value.length <= 120 && !/[;{}<>]|url\s*\(/i.test(value)) {
        documentRoot.style.setProperty(property, value);
      }
    });
  }

  function configure(config) {
    const copy = config.copy;
    applyTheme(config.theme);
    document.title = config.brand.documentTitle;
    elements.brandEyebrow.textContent = config.brand.eyebrow;
    elements.brandName.textContent = config.brand.name;
    elements.actionsEyebrow.textContent = copy.section.eyebrow;
    elements.actionsTitle.textContent = copy.section.title;
    elements.actionsDescription.textContent = copy.section.description;
    elements.emptyActions.textContent = copy.section.empty;
    elements.footerText.textContent = copy.footer.text;
    elements.footerHint.textContent = copy.footer.hint;
    elements.connectionState.hidden = !config.features.sdkStatus;
    setConnection('connecting', copy.connection.connecting);
  }

  function sdkLabel(action) {
    return action.sdkLabelParts
      .map((parts) => parts.join('.'))
      .join(' / ');
  }

  function actionCard(action, showSdkLabel) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-card';
    button.dataset.action = action.id;
    button.setAttribute('aria-label', action.title);
    const top = document.createElement('span');
    top.className = 'action-card-top';
    const badge = document.createElement('span');
    badge.className = 'action-badge';
    badge.textContent = action.badge;
    const indicator = document.createElement('span');
    indicator.className = 'action-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    top.append(badge, indicator);
    const title = document.createElement('strong');
    title.textContent = action.title;
    const description = document.createElement('span');
    description.className = 'action-description';
    description.textContent = action.description;
    button.append(top, title, description);
    if (showSdkLabel) {
      const code = document.createElement('code');
      code.textContent = sdkLabel(action);
      button.appendChild(code);
    }
    const meta = document.createElement('span');
    meta.className = 'action-meta';
    meta.dataset.actionMeta = action.id;
    meta.hidden = true;
    button.appendChild(meta);
    return button;
  }

  function renderActions(actions, features) {
    const enabled = actions.filter((action) => features[action.feature] === true);
    elements.actionGrid.replaceChildren(...enabled.map((action) => (
      actionCard(action, features.showSdkLabels)
    )));
    elements.actionGrid.hidden = enabled.length === 0;
    elements.emptyActions.hidden = enabled.length !== 0;
  }

  function setConnection(mode, label) {
    const safeMode = ['online', 'offline', 'error'].includes(mode) ? mode : 'connecting';
    elements.connectionState.dataset.mode = safeMode;
    elements.connectionLabel.textContent = String(label || '');
  }

  function setStage(model) {
    if (!model || typeof model !== 'object') throw new Error('舞台数据无效。');
    const tone = ['accent', 'success', 'warning', 'danger'].includes(model.tone)
      ? model.tone
      : 'accent';
    elements.stage.dataset.tone = tone;
    elements.stageLabel.textContent = String(model.label || '');
    elements.stageTitle.textContent = String(model.title || '');
    elements.stageText.textContent = String(model.text || '');
    elements.spinner.hidden = model.busy !== true;
    elements.stage.setAttribute('aria-busy', String(model.busy === true));
    if (typeof model.avatarUrl === 'string' && model.avatarUrl) {
      elements.avatar.src = model.avatarUrl;
      elements.avatar.alt = typeof model.avatarAlt === 'string' ? model.avatarAlt : '';
      elements.avatarFrame.hidden = false;
    } else {
      elements.avatar.removeAttribute('src');
      elements.avatar.alt = '';
      elements.avatarFrame.hidden = true;
    }
  }

  function setBusy(busy) {
    elements.appShell.setAttribute('aria-busy', String(Boolean(busy)));
    elements.actionGrid.querySelectorAll('button').forEach((button) => {
      button.disabled = Boolean(busy);
    });
  }

  function setActionMeta(actionId, text) {
    const selector = '[data-action-meta="' + actionId + '"]';
    const meta = elements.actionGrid.querySelector(selector);
    if (!meta) return;
    meta.textContent = typeof text === 'string' ? text : '';
    meta.hidden = !meta.textContent;
  }

  function bindActions(handler) {
    if (actionsBound) throw new Error('示例操作不能重复绑定。');
    if (typeof handler !== 'function') throw new Error('示例操作处理器缺失。');
    elements.actionGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (button && elements.actionGrid.contains(button)) handler(button.dataset.action);
    });
    actionsBound = true;
  }

  namespace.view = Object.freeze({
    init,
    configure,
    renderActions,
    setConnection,
    setStage,
    setBusy,
    setActionMeta,
    bindActions,
  });
}(window));
