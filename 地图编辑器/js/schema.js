/**
 * 地图包 schema v2 — 支持场景实体、互动、多边形碰撞
 */
(function (global) {
  const SCHEMA_VERSION = 2;
  const REGION_SIZE = 2048;
  const GROUND_DRAW = 512;
  const ALLOWED_GROUND_SIZES = [512, 1024, 2048];
  const MAX_GROUND_BYTES = 2.5 * 1024 * 1024;
  const ID_RE = /^[a-z][a-z0-9-]{1,47}$/;

  const DIRS = {
    up: { rx: 0, ry: -1, label: '上' },
    down: { rx: 0, ry: 1, label: '下' },
    left: { rx: -1, ry: 0, label: '左' },
    right: { rx: 1, ry: 0, label: '右' },
  };

  const PROPS_PRESETS = [
    { id: 'chaos', name: '太虚荒原' },
    { id: 'ruins', name: '上古剑冢' },
    { id: 'frost', name: '北冥雪境' },
    { id: 'town', name: '城镇' },
    { id: 'none', name: '无装饰' },
  ];

  const RULES_PRESETS = [
    { id: 'rules/chaos', name: '混沌规则' },
    { id: 'rules/ruins', name: '遗迹规则' },
    { id: 'rules/frost', name: '寒魄规则' },
  ];

  function nowIso() {
    return new Date().toISOString();
  }

  function emptyWorld(partial = {}) {
    const id = partial.id || 'custom-world';
    return {
      schemaVersion: SCHEMA_VERSION,
      id,
      name: partial.name || '未命名世界',
      enabled: true,
      builtin: false,
      kind: 'custom',
      originRegionId: 'origin',
      spawn: { regionId: 'origin', x: REGION_SIZE / 2, y: REGION_SIZE / 2 },
      defaults: {
        groundDrawSize: GROUND_DRAW,
        regionSize: REGION_SIZE,
        fill: '#080b1b',
        tint: 'rgba(5,8,20,.22)',
        rulesRef: 'rules/chaos',
        propsPreset: 'chaos',
      },
      regions: [{ id: 'origin', rx: 0, ry: 0 }],
      scene: {
        worldW: REGION_SIZE,
        worldH: REGION_SIZE,
        tileSize: GROUND_DRAW,
        groundUrl: null,
      },
      updatedAt: nowIso(),
      ...partial,
      schemaVersion: SCHEMA_VERSION,
    };
  }

  function emptyRegion(partial = {}) {
    return {
      id: partial.id || 'origin',
      name: partial.name || '初始区域',
      rx: partial.rx ?? 0,
      ry: partial.ry ?? 0,
      enabled: true,
      ground: 'ground.webp',
      preview: 'preview.webp',
      groundUrl: null,
      fill: null,
      tint: null,
      propsPreset: null,
      propsSeed: Math.floor(Math.random() * 1e9),
      rulesRef: null,
      notes: '',
      contentHash: '',
      entities: [],
      paths: [],
      collisions: [],
      airWalls: [],
      updatedAt: nowIso(),
      ...partial,
      entities: partial.entities || [],
      paths: partial.paths || [],
      collisions: partial.collisions || [],
      airWalls: partial.airWalls || [],
    };
  }

  function createProject(worldPartial, regionPartial) {
    const world = emptyWorld(worldPartial);
    const origin = emptyRegion({
      id: world.originRegionId || 'origin',
      name: regionPartial?.name || '初始区域',
      rx: 0,
      ry: 0,
      ...regionPartial,
    });
    return {
      world,
      regions: { [origin.id]: origin },
      assets: { [origin.id]: {} },
      selectedRegionId: origin.id,
      selectedEntityId: null,
      viewMode: 'scene',
      dirty: false,
    };
  }

  global.MapEditorSchema = {
    SCHEMA_VERSION,
    REGION_SIZE,
    GROUND_DRAW,
    ALLOWED_GROUND_SIZES,
    MAX_GROUND_BYTES,
    ID_RE,
    DIRS,
    PROPS_PRESETS,
    RULES_PRESETS,
    emptyWorld,
    emptyRegion,
    createProject,
    nowIso,
  };
})(window);
