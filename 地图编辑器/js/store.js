(function (global) {
  const LS_KEY = 'xiandao-map-editor-v2';
  const S = () => global.MapEditorSchema;
  const Catalog = () => global.MapEditorCatalog;

  function revokeUrls(assets) {
    for (const bag of Object.values(assets || {})) {
      if (bag.groundUrl && bag.ground) URL.revokeObjectURL(bag.groundUrl);
      if (bag.previewUrl && bag.preview) URL.revokeObjectURL(bag.previewUrl);
    }
  }

  function ensureAssetUrls(project) {
    for (const [id, bag] of Object.entries(project.assets || {})) {
      if (bag.ground && !bag.groundUrl) bag.groundUrl = URL.createObjectURL(bag.ground);
      if (bag.preview && !bag.previewUrl) bag.previewUrl = URL.createObjectURL(bag.preview);
      project.assets[id] = bag;
    }
  }

  function cloneMeta(project) {
    return {
      world: JSON.parse(JSON.stringify(project.world)),
      regions: JSON.parse(JSON.stringify(project.regions)),
      selectedRegionId: project.selectedRegionId || null,
      selectedEntityId: project.selectedEntityId || null,
      viewMode: project.viewMode || 'scene',
    };
  }

  const DB_NAME = 'xiandao-map-editor-v2';
  const DB_STORE = 'blobs';

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function listFromLs() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || '{"projects":[],"seededBuiltins":false}');
    } catch {
      return { projects: [], seededBuiltins: false };
    }
  }

  function saveLsIndex(data) {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }

  const store = {
    projects: new Map(),
    activeId: null,

    list() {
      return [...this.projects.values()].map((p) => ({
        id: p.world.id,
        name: p.world.name,
        dirty: !!p.dirty,
        builtin: !!p.world.builtin,
        kind: p.world.kind || 'custom',
        regionCount: (p.world.regions || []).length,
        entityCount: Object.values(p.regions).reduce((n, r) => n + (r.entities?.length || 0), 0),
      }));
    },

    getActive() {
      return this.activeId ? this.projects.get(this.activeId) : null;
    },

    setActive(id) {
      if (!this.projects.has(id)) return null;
      this.activeId = id;
      return this.getActive();
    },

    upsert(project, { markDirty = true } = {}) {
      ensureAssetUrls(project);
      if (!project.viewMode) project.viewMode = 'scene';
      if (markDirty) project.dirty = true;
      this.projects.set(project.world.id, project);
      this.activeId = project.world.id;
      return project;
    },

    remove(id) {
      const p = this.projects.get(id);
      if (p?.world?.builtin) throw new Error('内置地图不能删除，可另存为自定义');
      if (p) revokeUrls(p.assets);
      this.projects.delete(id);
      if (this.activeId === id) this.activeId = this.projects.keys().next().value || null;
      return this.persistAll();
    },

    createNew({ id, name } = {}) {
      let wid = id || 'custom-world';
      if (this.projects.has(wid)) {
        let n = 2;
        while (this.projects.has(`${wid}-${n}`)) n++;
        wid = `${wid}-${n}`;
      }
      if (!S().ID_RE.test(wid)) throw new Error('世界 id 非法');
      const project = S().createProject({
        id: wid,
        name: name || '未命名世界',
        kind: 'custom',
        scene: { worldW: 2800, worldH: 1900, tileSize: 512, groundUrl: Catalog().GROUNDS.town },
      });
      const reg = project.regions.origin;
      reg.groundUrl = Catalog().GROUNDS.town;
      reg.entities = [];
      reg.paths = [];
      reg.collisions = [];
      project.assets.origin = { groundUrlExternal: Catalog().GROUNDS.town };
      return this.upsert(project);
    },

    duplicateActive(newId, newName) {
      const src = this.getActive();
      if (!src) throw new Error('无活动世界');
      const meta = cloneMeta(src);
      meta.world.id = newId;
      meta.world.name = newName || meta.world.name + ' 副本';
      meta.world.builtin = false;
      const project = {
        world: meta.world,
        regions: meta.regions,
        assets: JSON.parse(JSON.stringify(src.assets)),
        selectedRegionId: meta.selectedRegionId,
        selectedEntityId: null,
        viewMode: 'scene',
        dirty: true,
      };
      // blobs 不能 JSON 克隆，浅拷贝引用
      project.assets = {};
      for (const [rid, bag] of Object.entries(src.assets || {})) {
        project.assets[rid] = { ...bag };
      }
      return this.upsert(project);
    },

    addNeighbor(dirKey) {
      const project = this.getActive();
      if (!project) throw new Error('无活动世界');
      const selectedId = project.selectedRegionId || project.world.originRegionId;
      const base = project.regions[selectedId];
      if (!base) throw new Error('请先选中一个区域');
      const dir = S().DIRS[dirKey];
      if (!dir) throw new Error('未知方向');
      const rx = base.rx + dir.rx;
      const ry = base.ry + dir.ry;
      const occupied = Object.values(project.regions).find((r) => r.rx === rx && r.ry === ry);
      if (occupied) throw new Error(`(${rx},${ry}) 已被「${occupied.name}」占用`);

      let nid = `r${rx < 0 ? 'm' : ''}${Math.abs(rx)}-${ry < 0 ? 'm' : ''}${Math.abs(ry)}`;
      if (!S().ID_RE.test(nid) || project.regions[nid]) nid = `region-${Date.now().toString(36)}`;

      const region = S().emptyRegion({
        id: nid,
        name: `${base.name}${dir.label}邻`,
        rx, ry,
        groundUrl: base.groundUrl || project.world.scene?.groundUrl,
        entities: [],
        paths: [],
        collisions: [],
      });
      project.regions[nid] = region;
      project.assets[nid] = {
        groundUrlExternal: region.groundUrl || null,
      };
      project.world.regions.push({ id: nid, rx, ry });
      project.world.updatedAt = S().nowIso();
      project.selectedRegionId = nid;
      project.dirty = true;
      return region;
    },

    setSelected(regionId) {
      const p = this.getActive();
      if (!p || !p.regions[regionId]) return;
      p.selectedRegionId = regionId;
    },

    updateWorld(patch) {
      const p = this.getActive();
      if (!p) return;
      Object.assign(p.world, patch, { updatedAt: S().nowIso() });
      if (patch.scene) p.world.scene = { ...p.world.scene, ...patch.scene };
      p.dirty = true;
    },

    updateRegion(regionId, patch) {
      const p = this.getActive();
      if (!p || !p.regions[regionId]) return;
      Object.assign(p.regions[regionId], patch, { updatedAt: S().nowIso() });
      const entry = p.world.regions.find((r) => r.id === regionId);
      if (entry) {
        entry.rx = p.regions[regionId].rx;
        entry.ry = p.regions[regionId].ry;
      }
      p.dirty = true;
    },

    updateEntity(regionId, entityId, patch) {
      const p = this.getActive();
      const reg = p?.regions[regionId];
      const ent = reg?.entities?.find((e) => e.id === entityId);
      if (!ent) return;
      if (patch.interaction) ent.interaction = { ...ent.interaction, ...patch.interaction };
      if (patch.collision) ent.collision = { ...ent.collision, ...patch.collision };
      if (patch.meta) ent.meta = { ...ent.meta, ...patch.meta };
      const { interaction, collision, meta, ...rest } = patch;
      Object.assign(ent, rest);
      p.dirty = true;
    },

    getSelectedEntity() {
      const p = this.getActive();
      if (!p?.selectedEntityId) return null;
      const reg = p.regions[p.selectedRegionId];
      return reg?.entities?.find((e) => e.id === p.selectedEntityId) || null;
    },

    /** 删除当前选中摆放物，成功返回 true */
    deleteSelectedEntity() {
      const p = this.getActive();
      if (!p?.selectedEntityId) return false;
      const rid = p.selectedRegionId || p.world.originRegionId;
      const reg = p.regions[rid];
      if (!reg) return false;
      const before = (reg.entities || []).length;
      const id = p.selectedEntityId;
      reg.entities = (reg.entities || []).filter((e) => e.id !== id);
      p.selectedEntityId = null;
      p.dirty = true;
      return reg.entities.length < before;
    },

    /** 清除选中物体的碰撞体积（保留物体） */
    clearSelectedCollision() {
      const ent = this.getSelectedEntity();
      if (!ent) return false;
      ent.collision = { mode: 'none', radius: 0, points: [], space: 'world' };
      this.getActive().dirty = true;
      return true;
    },

    /** 删除独立碰撞区 */
    deleteCollisionZone(zoneId) {
      const p = this.getActive();
      if (!p || !zoneId) return false;
      const rid = p.selectedRegionId || p.world.originRegionId;
      const reg = p.regions[rid];
      if (!reg) return false;
      const before = (reg.collisions || []).length;
      reg.collisions = (reg.collisions || []).filter((z) => z.id !== zoneId);
      p.dirty = true;
      return reg.collisions.length < before;
    },

    /** 删除空气墙 */
    deleteAirWall(wallId) {
      const p = this.getActive();
      if (!p || !wallId) return false;
      const rid = p.selectedRegionId || p.world.originRegionId;
      const reg = p.regions[rid];
      if (!reg) return false;
      const before = (reg.airWalls || []).length;
      reg.airWalls = (reg.airWalls || []).filter((z) => z.id !== wallId);
      p.dirty = true;
      return (reg.airWalls || []).length < before;
    },

    async setGround(regionId, blob, fileName) {
      const p = this.getActive();
      if (!p || !p.regions[regionId]) return;
      const bag = p.assets[regionId] || {};
      if (bag.groundUrl && bag.ground) URL.revokeObjectURL(bag.groundUrl);
      bag.ground = blob;
      bag.groundUrl = URL.createObjectURL(blob);
      bag.groundName = fileName || 'ground.webp';
      delete bag.groundUrlExternal;
      p.assets[regionId] = bag;
      p.regions[regionId].ground = 'ground.webp';
      p.regions[regionId].groundUrl = bag.groundUrl;
      if (p.world.scene) p.world.scene.groundUrl = bag.groundUrl;
      p.dirty = true;
    },

    async setPreview(regionId, blob, fileName) {
      const p = this.getActive();
      if (!p || !p.regions[regionId]) return;
      const bag = p.assets[regionId] || {};
      if (bag.previewUrl && bag.preview) URL.revokeObjectURL(bag.previewUrl);
      bag.preview = blob;
      bag.previewUrl = URL.createObjectURL(blob);
      bag.previewName = fileName || 'preview.webp';
      p.assets[regionId] = bag;
      p.regions[regionId].preview = 'preview.webp';
      p.dirty = true;
    },

    async persistAll() {
      const prev = listFromLs();
      const index = { projects: [], seededBuiltins: true };
      for (const [id, p] of this.projects) {
        const meta = cloneMeta(p);
        index.projects.push({ id, meta });
        const assetPayload = {};
        for (const [rid, bag] of Object.entries(p.assets || {})) {
          assetPayload[rid] = {
            ground: bag.ground || null,
            preview: bag.preview || null,
            groundUrlExternal: bag.groundUrlExternal || null,
          };
        }
        await idbPut(`assets:${id}`, assetPayload);
      }
      const keep = new Set(this.projects.keys());
      for (const old of prev.projects || []) {
        if (!keep.has(old.id)) await idbDelete(`assets:${old.id}`);
      }
      saveLsIndex(index);
      for (const p of this.projects.values()) p.dirty = false;
    },

    async loadAll() {
      const index = listFromLs();
      for (const p of this.projects.values()) revokeUrls(p.assets);
      this.projects.clear();

      for (const entry of index.projects || []) {
        const assetsRaw = (await idbGet(`assets:${entry.id}`)) || {};
        const assets = {};
        for (const [rid, bag] of Object.entries(assetsRaw)) {
          assets[rid] = {
            ground: bag.ground || null,
            preview: bag.preview || null,
            groundUrlExternal: bag.groundUrlExternal || null,
          };
        }
        const project = {
          world: entry.meta.world,
          regions: entry.meta.regions,
          assets,
          selectedRegionId: entry.meta.selectedRegionId || entry.meta.world.originRegionId,
          selectedEntityId: entry.meta.selectedEntityId || null,
          viewMode: entry.meta.viewMode || 'scene',
          dirty: false,
        };
        // 外链地面写回 region
        for (const [rid, bag] of Object.entries(assets)) {
          if (bag.groundUrlExternal && project.regions[rid] && !project.regions[rid].groundUrl) {
            project.regions[rid].groundUrl = bag.groundUrlExternal;
          }
        }
        ensureAssetUrls(project);
        this.projects.set(project.world.id, project);
      }

      if (!index.seededBuiltins || !this.projects.size) {
        await this.seedBuiltins({ force: !this.projects.size });
      }

      this.activeId = this.activeId && this.projects.has(this.activeId)
        ? this.activeId
        : (this.projects.get('builtin-town') ? 'builtin-town' : this.projects.keys().next().value || null);
      return this.list();
    },

    async seedBuiltins({ force = false } = {}) {
      const builtins = Catalog().allBuiltins();
      for (const b of builtins) {
        if (!force && this.projects.has(b.world.id)) continue;
        // 强制刷新内置时覆盖
        this.projects.set(b.world.id, b);
      }
      await this.persistAll();
    },

    async resetBuiltins() {
      for (const b of Catalog().allBuiltins()) {
        this.projects.set(b.world.id, b);
      }
      await this.persistAll();
      this.activeId = 'builtin-town';
    },
  };

  global.MapEditorStore = store;
})(window);
