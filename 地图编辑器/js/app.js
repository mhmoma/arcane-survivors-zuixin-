(function () {
  const store = window.MapEditorStore;
  const schema = window.MapEditorSchema;
  const catalog = window.MapEditorCatalog;
  const validate = window.MapEditorValidate;
  const zipIo = window.MapEditorZip;

  const el = {
    worldList: document.getElementById('worldList'),
    palette: document.getElementById('palette'),
    canvas: document.getElementById('sceneCanvas'),
    validatePanel: document.getElementById('validatePanel'),
    status: document.getElementById('statusBar'),
    worldName: document.getElementById('worldName'),
    worldId: document.getElementById('worldId'),
    worldW: document.getElementById('worldW'),
    worldH: document.getElementById('worldH'),
    spawnX: document.getElementById('spawnX'),
    spawnY: document.getElementById('spawnY'),
    entLabel: document.getElementById('entLabel'),
    entX: document.getElementById('entX'),
    entY: document.getElementById('entY'),
    entW: document.getElementById('entW'),
    entH: document.getElementById('entH'),
    entZ: document.getElementById('entZ'),
    entCls: document.getElementById('entCls'),
    entRot: document.getElementById('entRot'),
    entRotSlider: document.getElementById('entRotSlider'),
    entInteract: document.getElementById('entInteract'),
    entInteractR: document.getElementById('entInteractR'),
    entPayload: document.getElementById('entPayload'),
    entColMode: document.getElementById('entColMode'),
    entColR: document.getElementById('entColR'),
    entityHint: document.getElementById('entityHint'),
  };

  let paletteGroup = 'all';
  let placeKind = null;
  let scene;

  const history = {
    stack: [],
    max: 40,
    activeRegionId(p) {
      return scene?.state?.regionId || p.selectedRegionId || p.world?.originRegionId;
    },
    snapshotSig(snap) {
      return JSON.stringify({
        e: snap.entities,
        c: snap.collisions,
        a: snap.airWalls,
        sp: snap.spawn,
        ss: snap.sceneSize,
      });
    },
    push() {
      const p = store.getActive();
      if (!p) return false;
      const rid = this.activeRegionId(p);
      if (!rid || !p.regions[rid]) return false;
      p.selectedRegionId = rid;
      if (scene?.state) scene.state.regionId = rid;
      const reg = p.regions[rid];
      const snap = {
        worldId: p.world.id,
        regionId: rid,
        entities: JSON.parse(JSON.stringify(reg.entities || [])),
        collisions: JSON.parse(JSON.stringify(reg.collisions || [])),
        airWalls: JSON.parse(JSON.stringify(reg.airWalls || [])),
        selectedEntityId: p.selectedEntityId,
        selectedZoneId: scene?.state?.selectedZoneId ?? null,
        selectedAirWallId: scene?.state?.selectedAirWallId ?? null,
        focusKind: scene?.state?.focusKind ?? null,
        spawn: p.world.spawn ? JSON.parse(JSON.stringify(p.world.spawn)) : null,
        sceneSize: {
          worldW: p.world.scene?.worldW,
          worldH: p.world.scene?.worldH,
        },
      };
      const last = this.stack[this.stack.length - 1];
      if (last && last.worldId === snap.worldId && this.snapshotSig(last) === this.snapshotSig(snap)) {
        syncUndoBtn();
        return false;
      }
      this.stack.push(snap);
      if (this.stack.length > this.max) this.stack.shift();
      syncUndoBtn();
      return true;
    },
    clear() {
      this.stack = [];
      syncUndoBtn();
    },
    undo() {
      blurInspectorFields();
      const snap = this.stack.pop();
      if (!snap) {
        setStatus('没有可撤回的步骤', 'err');
        syncUndoBtn();
        return false;
      }
      const p = store.getActive();
      if (!p || p.world.id !== snap.worldId) {
        setStatus('撤回失败：当前地图已切换', 'err');
        syncUndoBtn();
        return false;
      }
      const reg = p.regions[snap.regionId];
      if (!reg) {
        setStatus('撤回失败：区域不存在', 'err');
        syncUndoBtn();
        return false;
      }
      reg.entities = JSON.parse(JSON.stringify(snap.entities));
      reg.collisions = JSON.parse(JSON.stringify(snap.collisions));
      reg.airWalls = JSON.parse(JSON.stringify(snap.airWalls || []));
      p.selectedRegionId = snap.regionId;
      p.selectedEntityId = snap.selectedEntityId;
      if (snap.spawn) p.world.spawn = snap.spawn;
      if (p.world.scene) {
        if (snap.sceneSize?.worldW) p.world.scene.worldW = snap.sceneSize.worldW;
        if (snap.sceneSize?.worldH) p.world.scene.worldH = snap.sceneSize.worldH;
      }
      p.dirty = true;
      if (scene?.state) {
        scene.state.regionId = snap.regionId;
        scene.state.selectedZoneId = snap.selectedZoneId;
        scene.state.selectedAirWallId = snap.selectedAirWallId || null;
        scene.state.focusKind = snap.focusKind;
        scene.state.polyDraft = null;
        scene.state.airDraft = null;
        scene.state.drag = null;
        scene.state.tool = 'select';
        scene.setProject(p, snap.regionId);
      }
      document.querySelectorAll('.tool-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.tool === 'select');
      });
      paintSceneNow();
      refreshInspector();
      markWorldListDirty();
      syncUndoBtn();
      setStatus(`已撤回上一步（还可撤 ${this.stack.length} 步）`, 'ok');
      return true;
    },
  };

  function syncUndoBtn() {
    const btn = document.getElementById('btnUndo');
    if (btn) {
      btn.disabled = history.stack.length === 0;
      btn.title = history.stack.length
        ? `撤回上一步 (Ctrl+Z) · 可撤 ${history.stack.length} 步`
        : '撤回上一步 (Ctrl+Z)';
    }
  }

  function pushHistory() {
    return history.push();
  }

  function setStatus(msg, kind = '') {
    el.status.textContent = msg;
    el.status.dataset.kind = kind;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderWorldList() {
    const list = store.list();
    el.worldList.innerHTML = '';
    for (const w of list) {
      const li = document.createElement('li');
      li.className = w.id === store.activeId ? 'active' : '';
      const tag = w.kind === 'town' ? '城镇' : w.kind === 'combat' ? '战斗' : '自定义';
      li.innerHTML = `<button type="button" data-id="${w.id}"><span class="name">${escapeHtml(w.name)}</span><span class="meta">${tag} · ${w.entityCount} 物${w.dirty ? ' · 未存' : ''}${w.builtin ? ' · 内置' : ''}</span></button>`;
      li.querySelector('button').addEventListener('click', () => {
        store.setActive(w.id);
        history.clear();
        syncScene(true);
        refreshInspector();
        renderWorldList();
      });
      el.worldList.appendChild(li);
    }
  }

  function renderPalette() {
    el.palette.innerHTML = '';
    for (const k of catalog.PROP_KINDS) {
      if (paletteGroup !== 'all' && k.group !== paletteGroup) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pal-item' + (placeKind === k.id ? ' active' : '');
      const thumb = document.createElement('canvas');
      thumb.width = 48;
      thumb.height = 48;
      thumb.className = 'pal-thumb';
      paintThumb(thumb, k);
      const meta = document.createElement('span');
      meta.className = 'pal-meta';
      meta.innerHTML = `<span class="pal-name">${escapeHtml(k.name)}</span><span class="pal-id">${escapeHtml(k.id)}</span>`;
      btn.appendChild(thumb);
      btn.appendChild(meta);
      btn.title = k.name;
      btn.addEventListener('click', () => {
        if (placeKind === k.id) {
          placeKind = null;
          scene.setTool('select', null);
          document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === 'select'));
          renderPalette();
          setStatus('已取消素材选中 · 选择/拖动模式', 'ok');
          return;
        }
        placeKind = k.id;
        scene.setTool('place', k.id);
        document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === 'place'));
        renderPalette();
        setStatus(`放置模式：${k.name}（点击场景放置）`, 'ok');
      });
      el.palette.appendChild(btn);
    }
  }

  function paintThumb(canvas, kind) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#152026';
    ctx.fillRect(0, 0, 48, 48);
    const src = window.MapEditorScene.normalizeSrc
      ? window.MapEditorScene.normalizeSrc(kind.src)
      : kind.src;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, 48, 48);
      ctx.fillStyle = '#152026';
      ctx.fillRect(0, 0, 48, 48);
      if (kind.atlas) {
        const cols = kind.atlas.cols || 4;
        const rows = kind.atlas.rows || 4;
        const fw = img.naturalWidth / cols;
        const fh = img.naturalHeight / rows;
        const ix = kind.atlas.index % cols;
        const iy = Math.floor(kind.atlas.index / cols);
        ctx.drawImage(img, ix * fw, iy * fh, fw, fh, 4, 4, 40, 40);
      } else {
        const scale = Math.min(40 / img.naturalWidth, 40 / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, (48 - w) / 2, (48 - h) / 2, w, h);
      }
    };
    img.onerror = () => {
      ctx.fillStyle = '#c45c5c';
      ctx.font = '10px sans-serif';
      ctx.fillText('缺图', 12, 28);
    };
    img.src = src;
  }

  function paintSceneNow() {
    const p = store.getActive();
    if (!scene || !p) return;
    if (scene.state) {
      scene.state.drag = null;
      scene.state.regionId = p.selectedRegionId || scene.state.regionId;
      scene.state.project = p;
    }
    try { scene.draw(); } catch (_) {}
    requestAnimationFrame(() => {
      try { scene.draw(); } catch (_) {}
    });
  }

  function blurInspectorFields() {
    const ae = document.activeElement;
    if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) {
      try { ae.blur(); } catch (_) {}
    }
  }

  function syncActiveRegion() {
    const p = store.getActive();
    if (!p) return null;
    if (scene?.state?.regionId) p.selectedRegionId = scene.state.regionId;
    if (scene?.state?.project?.selectedEntityId != null) {
      p.selectedEntityId = scene.state.project.selectedEntityId;
    }
    return p;
  }

  function getSceneSelectedEntity() {
    const p = syncActiveRegion();
    if (!p?.selectedEntityId) return null;
    const rid = p.selectedRegionId || scene?.state?.regionId || p.world?.originRegionId;
    const reg = p.regions[rid];
    return reg?.entities?.find((e) => e.id === p.selectedEntityId) || null;
  }

  function syncEntFloatBar(box) {
    const bar = document.getElementById('entFloatBar');
    const wrap = document.getElementById('sceneWrap');
    if (!bar || !wrap) return;
    if (!box || !box.ent) {
      bar.hidden = true;
      return;
    }
    const wr = wrap.getBoundingClientRect();
    const barW = 72;
    const pad = 10;
    let left = box.right + pad;
    // 右侧不够则放到左侧，避免挡住素材本体
    if (left + barW > wr.width - 4) {
      left = box.left - barW - pad;
    }
    left = Math.max(4, Math.min(left, wr.width - barW - 4));
    let top = box.midY;
    top = Math.max(40, Math.min(top, wr.height - 40));
    bar.style.left = `${Math.round(left)}px`;
    bar.style.top = `${Math.round(top)}px`;
    bar.hidden = false;
  }

  function hideEntFloatBar() {
    const bar = document.getElementById('entFloatBar');
    if (bar) bar.hidden = true;
  }

  function runEntFloatAct(act) {
    syncActiveRegion();
    const ent = getSceneSelectedEntity();
    const normRot = (r) => Math.round((((Number(r) % 360) + 360) % 360));

    if (act === 'dup') {
      if (!ent) {
        setStatus('请先选中要复制的素材', 'err');
        return;
      }
      duplicateSelectedEntity();
      return;
    }
    if (act === 'del') {
      if (!ent && !store.getActive()?.selectedEntityId) {
        setStatus('没有选中的物体', 'err');
        return;
      }
      if (scene?.state) scene.state.focusKind = 'entity';
      const ok = deleteSelectedEntity();
      if (ok) hideEntFloatBar();
      return;
    }
    if (!ent) {
      setStatus('请先选中素材', 'err');
      return;
    }
    if (act === 'flipx') {
      pushHistory();
      ent.flipX = !ent.flipX;
      store.getActive().dirty = true;
      syncScene(false);
      refreshInspector();
      setStatus(ent.flipX ? '已左右镜像' : '已取消左右镜像', 'ok');
      return;
    }
    if (act === 'flipy') {
      pushHistory();
      ent.flipY = !ent.flipY;
      store.getActive().dirty = true;
      syncScene(false);
      refreshInspector();
      setStatus(ent.flipY ? '已上下翻转' : '已取消上下翻转', 'ok');
      return;
    }
    if (act === 'rotm' || act === 'rotp') {
      pushHistory();
      const d = act === 'rotm' ? -15 : 15;
      ent.rotation = normRot((ent.rotation || 0) + d);
      store.getActive().dirty = true;
      syncScene(false);
      refreshInspector();
      setStatus(`旋转 ${ent.rotation}°`, 'ok');
      return;
    }
    if (act === 'zup' || act === 'zdn') {
      pushHistory();
      const d = act === 'zup' ? 1 : -1;
      ent.z = Math.round((Number(ent.z) || 0) + d);
      store.getActive().dirty = true;
      syncScene(false);
      refreshInspector();
      setStatus(`图层 z = ${ent.z}`, 'ok');
    }
  }

  function bindEntFloatBar() {
    const bar = document.getElementById('entFloatBar');
    if (!bar) return;
    let pendingAct = null;
    let armed = false;

    const blockToCanvas = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    };

    // 捕获阶段拦截，避免画布抢走事件
    bar.addEventListener('pointerdown', (ev) => {
      blockToCanvas(ev);
      const btn = ev.target.closest('button[data-act]');
      pendingAct = btn ? btn.dataset.act : null;
      armed = !!pendingAct;
      try {
        const canvas = el.canvas;
        if (canvas && ev.pointerId != null && canvas.hasPointerCapture?.(ev.pointerId)) {
          canvas.releasePointerCapture(ev.pointerId);
        }
      } catch (_) {}
      if (scene?.state) scene.state.drag = null;
    }, true);

    bar.addEventListener('pointerup', (ev) => {
      blockToCanvas(ev);
      if (!armed) return;
      armed = false;
      const btn = ev.target.closest('button[data-act]');
      const act = (btn && btn.dataset.act) || pendingAct;
      pendingAct = null;
      if (!act) return;
      runEntFloatAct(act);
    }, true);

    bar.addEventListener('pointercancel', () => {
      armed = false;
      pendingAct = null;
    }, true);

    bar.addEventListener('click', (ev) => {
      blockToCanvas(ev);
    }, true);

    bar.addEventListener('contextmenu', (ev) => {
      blockToCanvas(ev);
    }, true);
  }

  function duplicateSelectedEntity() {
    const p = syncActiveRegion();
    const ent = getSceneSelectedEntity();
    if (!p || !ent) {
      setStatus('请先选中要复制的素材', 'err');
      return false;
    }
    blurInspectorFields();
    pushHistory();
    const rid = p.selectedRegionId || p.world.originRegionId;
    const reg = p.regions[rid];
    if (!reg) return false;
    const copy = JSON.parse(JSON.stringify(ent));
    copy.id = `${ent.kind.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`;
    // 稍微错开，看得见副本；完整保留旋转/镜像/大小/图层/碰撞等
    copy.x = Math.round((ent.x || 0) + 48);
    copy.y = Math.round((ent.y || 0) + 36);
    reg.entities = reg.entities || [];
    reg.entities.push(copy);
    p.selectedEntityId = copy.id;
    p.dirty = true;
    if (scene?.state) {
      scene.state.focusKind = 'entity';
      scene.state.selectedZoneId = null;
      scene.state.selectedAirWallId = null;
      scene.state.drag = null;
      scene.state.tool = 'select';
    }
    document.querySelectorAll('.tool-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === 'select');
    });
    paintSceneNow();
    refreshInspector();
    markWorldListDirty();
    syncUndoBtn();
    setStatus(`已复制「${copy.interaction?.label || copy.kind}」（含角度/大小）· 可继续 Ctrl+D`, 'ok');
    return true;
  }

  function deleteSelectedEntity() {
    const p = syncActiveRegion();
    if (!p?.selectedEntityId) {
      setStatus('没有选中的物体', 'err');
      return false;
    }
    blurInspectorFields();
    pushHistory();
    if (scene?.state?.regionId) p.selectedRegionId = scene.state.regionId;
    if (!store.deleteSelectedEntity()) {
      setStatus('没有选中的物体', 'err');
      return false;
    }
    if (scene?.state) {
      if (scene.state.project) scene.state.project.selectedEntityId = null;
      scene.state.focusKind = null;
      scene.state.selectedZoneId = null;
      scene.state.selectedAirWallId = null;
      scene.state.polyDraft = null;
      scene.state.airDraft = null;
      scene.state.drag = null;
    }
    paintSceneNow();
    refreshInspector();
    markWorldListDirty();
    setStatus('已删除选中物体', 'ok');
    return true;
  }

  /** 按焦点删除：空气墙 / 碰撞体积 / 独立碰撞区 / 素材 */
  function deleteSelectedFocus() {
    const p = store.getActive();
    if (scene?.state?.regionId && p) p.selectedRegionId = scene.state.regionId;
    const focus = scene?.state?.focusKind;
    const zoneId = scene?.state?.selectedZoneId;
    const airId = scene?.state?.selectedAirWallId;

    if (focus === 'airwall' || (!p?.selectedEntityId && !zoneId && airId)) {
      blurInspectorFields();
      pushHistory();
      const ok = store.deleteAirWall(airId);
      if (!ok) {
        setStatus('没有选中的空气墙', 'err');
        return false;
      }
      scene.state.selectedAirWallId = null;
      scene.state.focusKind = null;
      scene.state.airDraft = null;
      scene.state.drag = null;
      paintSceneNow();
      refreshInspector();
      markWorldListDirty();
      setStatus('已删除空气墙', 'ok');
      return true;
    }

    if (focus === 'zone' || (!p?.selectedEntityId && zoneId)) {
      blurInspectorFields();
      pushHistory();
      const ok = store.deleteCollisionZone(zoneId);
      if (!ok) {
        setStatus('没有选中的碰撞区', 'err');
        return false;
      }
      scene.state.selectedZoneId = null;
      scene.state.focusKind = null;
      scene.state.polyDraft = null;
      scene.state.drag = null;
      paintSceneNow();
      refreshInspector();
      markWorldListDirty();
      setStatus('已删除碰撞体积', 'ok');
      return true;
    }

    if (focus === 'collision') {
      blurInspectorFields();
      pushHistory();
      const ok = store.clearSelectedCollision();
      if (!ok) {
        setStatus('没有可删的碰撞', 'err');
        return false;
      }
      scene.state.focusKind = 'entity';
      scene.state.polyDraft = null;
      scene.state.drag = null;
      paintSceneNow();
      refreshInspector();
      markWorldListDirty();
      setStatus('已删除碰撞体积（素材保留）', 'ok');
      return true;
    }

    return deleteSelectedEntity();
  }

  let _worldListTimer = 0;
  function markWorldListDirty() {
    clearTimeout(_worldListTimer);
    _worldListTimer = setTimeout(() => renderWorldList(), 120);
  }

  function syncDragFields(ent) {
    if (!ent) return;
    if (document.activeElement === el.entX || document.activeElement === el.entY
      || document.activeElement === el.entW || document.activeElement === el.entH) return;
    el.entX.value = Math.round(ent.x);
    el.entY.value = Math.round(ent.y);
    el.entW.value = ent.w;
    el.entH.value = ent.h;
    if (el.entRot && document.activeElement !== el.entRot && document.activeElement !== el.entRotSlider) {
      const r = Math.round((((Number(ent.rotation) || 0) % 360) + 360) % 360);
      el.entRot.value = r;
      if (el.entRotSlider) el.entRotSlider.value = String(r);
    }
  }

  function syncScene(fit) {
    const p = store.getActive();
    if (!scene) return;
    scene.setProject(p, p?.selectedRegionId);
    if (fit) scene.fitView();
    scene.draw();
  }

  function entityHasCollision(ent) {
    const col = ent?.collision;
    if (!col || col.mode === 'none') return false;
    if (col.mode === 'circle' && Number(col.radius) > 0) return true;
    if (col.mode === 'polygon' && (col.points?.length || 0) >= 4) return true;
    return false;
  }

  /** 选中空气墙 / 独立碰撞 / 物体碰撞时，点亮删除按钮 */
  function syncCollisionDeleteBtn(ent) {
    const delCol = document.getElementById('btnDelCollision');
    if (!delCol) return;
    const st = scene?.state;
    const canDel = !!(
      st?.selectedAirWallId
      || st?.selectedZoneId
      || st?.focusKind === 'airwall'
      || st?.focusKind === 'zone'
      || st?.focusKind === 'collision'
      || entityHasCollision(ent)
    );
    delCol.disabled = !canDel;
    delCol.classList.toggle('ready', canDel);
  }

  function refreshInspector() {
    const p = store.getActive();
    if (!p) return;
    el.worldName.value = p.world.name || '';
    el.worldId.value = p.world.id || '';
    el.worldW.value = p.world.scene?.worldW || 2800;
    el.worldH.value = p.world.scene?.worldH || 1900;
    el.spawnX.value = p.world.spawn?.x ?? 0;
    el.spawnY.value = p.world.spawn?.y ?? 0;

    const ent = store.getSelectedEntity();
    const box = document.getElementById('entityPanel') || document.getElementById('entityBox');
    if (!ent) {
      hideEntFloatBar();
      el.entityHint.textContent = scene?.state?.selectedAirWallId
        ? '已选中空气墙 · Delete /「删除碰撞 / 空气墙」可删'
        : scene?.state?.selectedZoneId
        ? '已选中独立碰撞区 · Delete /「删除碰撞 / 空气墙」可删'
        : scene?.state?.focusKind === 'spawn'
        ? '已选中出生点 · 拖动绿标移动 · 单击空地重设 · 双击空地打开设置'
        : '单击空地设置出生点；双击空地打开设置；点物体编辑；青线/框=空气墙';
      box?.querySelectorAll('input, select, textarea, button').forEach((n) => {
        if (n.id === 'btnDrawZone' || n.id === 'btnCommitPoly2' || n.id === 'btnDelCollision') return;
        if (n.tagName === 'BUTTON' && n.id !== 'btnDrawZone') n.disabled = true;
      });
      ['entLabel','entX','entY','entW','entH','entZ','entCls','entRot','entRotSlider','entInteract','entInteractR','entPayload','entColMode','entColR','btnDrawPoly','btnDelEntity','btnDupEntity'].forEach((id) => {
        const n = document.getElementById(id);
        if (n) n.disabled = true;
      });
      ['btnFlipX','btnFlipY','btnRotM90','btnRotP90','btnRotM15','btnRotP15','btnRotM1','btnRotP1','btnRot0','btnRot90','btnRot180','btnRot270'].forEach((id) => {
        const n = document.getElementById(id);
        if (n) n.disabled = true;
      });
      const drawZone = document.getElementById('btnDrawZone');
      if (drawZone) drawZone.disabled = false;
      const c2 = document.getElementById('btnCommitPoly2');
      if (c2) c2.disabled = false;
      syncCollisionDeleteBtn(null);
      const clsField = document.getElementById('classClsField');
      const clsHint = document.getElementById('classClsHint');
      if (clsField) clsField.style.display = 'none';
      if (clsHint) clsHint.style.display = 'none';
      const info = document.getElementById('colPolyInfo');
      if (info) {
        info.textContent = scene?.state?.selectedAirWallId
          ? '已选中空气墙。Delete 或点「删除碰撞 / 空气墙」可删。'
          : scene?.state?.selectedZoneId
          ? '已选中独立红色碰撞区。Delete 或点「删除碰撞 / 空气墙」可删。'
          : '点对点圈红区 = 碰撞。左键选中后可删；拖动可移动。';
      }
      return;
    }
    el.entityHint.textContent = `${ent.kind} · ${ent.id}${scene?.state?.focusKind === 'collision' ? ' · 碰撞焦点' : ''}`;
    ['entLabel','entX','entY','entW','entH','entZ','entRot','entRotSlider','entInteract','entInteractR','entPayload','entColMode','entColR','btnDrawPoly','btnCommitPoly2','btnDelCollision','btnDelEntity','btnDupEntity','btnDrawZone','btnFlipX','btnFlipY','btnRotM90','btnRotP90','btnRotM15','btnRotP15','btnRotM1','btnRotP1','btnRot0','btnRot90','btnRot180','btnRot270'].forEach((id) => {
      const n = document.getElementById(id);
      if (n) n.disabled = false;
    });
    syncCollisionDeleteBtn(ent);
    el.entLabel.value = ent.interaction?.label || '';
    el.entX.value = Math.round(ent.x);
    el.entY.value = Math.round(ent.y);
    el.entW.value = ent.w;
    el.entH.value = ent.h;
    if (el.entZ) el.entZ.value = Math.round(Number(ent.z) || 0);
    if (el.entRot) el.entRot.value = Math.round((((Number(ent.rotation) || 0) % 360) + 360) % 360);
    if (el.entRotSlider) el.entRotSlider.value = String(Math.round((((Number(ent.rotation) || 0) % 360) + 360) % 360));
    document.getElementById('btnFlipX')?.classList.toggle('active', !!ent.flipX);
    document.getElementById('btnFlipY')?.classList.toggle('active', !!ent.flipY);
    el.entInteract.value = ent.interaction?.type || 'none';
    el.entInteractR.value = ent.interaction?.radius ?? 0;
    el.entPayload.value = ent.interaction?.payload ? JSON.stringify(ent.interaction.payload) : '';
    el.entColMode.value = ent.collision?.mode || 'none';
    el.entColR.value = ent.collision?.radius ?? 0;
    document.getElementById('colRadiusField').style.opacity = el.entColMode.value === 'circle' ? '1' : '0.45';
    const isClass = ent.kind === 'classNpc';
    const clsField = document.getElementById('classClsField');
    const clsHint = document.getElementById('classClsHint');
    if (clsField) clsField.style.display = isClass ? '' : 'none';
    if (clsHint) clsHint.style.display = isClass ? '' : 'none';
    if (isClass && el.entCls) {
      el.entCls.disabled = false;
      const cls = ent.meta?.cls || ent.interaction?.payload?.cls || 'mage';
      el.entCls.value = cls;
    }
    const info = document.getElementById('colPolyInfo');
    if (info) {
      const col = ent.collision || {};
      if (col.mode === 'polygon' && col.points?.length >= 4) {
        info.textContent = `红色封闭区 = 碰撞体积（已保存 ${col.points.length} 点）。左键选中红区后 Delete 可删。`;
      } else if (col.mode === 'circle' && col.radius > 0) {
        info.textContent = `当前碰撞：圆形 r=${Math.round(col.radius)}。左键选中后可删。`;
      } else {
        info.textContent = '无碰撞。至少点 4 个顶点圈出红区 →「完成碰撞」→「应用到游戏」。';
      }
    }
  }

  async function runValidate() {
    const p = store.getActive();
    if (!p) return;
    const result = await validate.validateProject(p);
    const parts = [];
    parts.push(result.canPlay
      ? '<div class="banner ok">可通过</div>'
      : '<div class="banner err">未通过</div>');
    for (const e of result.errors) parts.push(`<div class="item err"><strong>错误</strong> ${escapeHtml(e.msg)}</div>`);
    for (const w of result.warnings) parts.push(`<div class="item warn"><strong>警告</strong> ${escapeHtml(w.msg)}</div>`);
    if (!result.errors.length && !result.warnings.length) parts.push('<div class="item ok">无警告</div>');
    el.validatePanel.innerHTML = parts.join('');
    setStatus(result.canPlay ? '校验通过' : `失败 ${result.errors.length} 错`, result.canPlay ? 'ok' : 'err');
  }

  function bindInspector() {
    el.entInteract.innerHTML = catalog.INTERACTIONS.map((i) => `<option value="${i.id}">${i.name}</option>`).join('');
    if (el.entCls) {
      el.entCls.innerHTML = (catalog.CLASS_OPTIONS || []).map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    el.worldName.addEventListener('change', () => {
      store.updateWorld({ name: el.worldName.value.trim() });
      renderWorldList();
    });
    const applySize = () => {
      pushHistory();
      store.updateWorld({
        scene: {
          worldW: Number(el.worldW.value) || 2800,
          worldH: Number(el.worldH.value) || 1900,
        },
      });
      syncScene(false);
    };
    el.worldW.addEventListener('change', applySize);
    el.worldH.addEventListener('change', applySize);
    el.spawnX.addEventListener('change', () => {
      const p = store.getActive();
      applySpawn(Number(el.spawnX.value) || 0, p.world.spawn?.y ?? 0, { record: true });
    });
    el.spawnY.addEventListener('change', () => {
      const p = store.getActive();
      applySpawn(p.world.spawn?.x ?? 0, Number(el.spawnY.value) || 0, { record: true });
    });

    const patchEnt = (patch, { record = true } = {}) => {
      const p = store.getActive();
      if (!p?.selectedEntityId) return;
      if (scene?.state?.regionId) p.selectedRegionId = scene.state.regionId;
      if (record) pushHistory();
      store.updateEntity(p.selectedRegionId, p.selectedEntityId, patch);
      syncScene(false);
      syncUndoBtn();
    };

    el.entLabel.addEventListener('change', () => patchEnt({ interaction: { label: el.entLabel.value } }));
    el.entX.addEventListener('change', () => patchEnt({ x: Number(el.entX.value) }));
    el.entY.addEventListener('change', () => patchEnt({ y: Number(el.entY.value) }));
    el.entZ?.addEventListener('change', () => patchEnt({ z: Number(el.entZ.value) || 0 }));
    el.entCls?.addEventListener('change', () => {
      const p = store.getActive();
      const ent = store.getSelectedEntity();
      if (!p || !ent || ent.kind !== 'classNpc') return;
      if (scene?.state?.regionId) p.selectedRegionId = scene.state.regionId;
      pushHistory();
      catalog.applyClassToEntity(ent, el.entCls.value);
      p.dirty = true;
      syncScene(false);
      refreshInspector();
      syncUndoBtn();
    });
    let _sizeHistReady = false;
    const applyEntSize = () => {
      const w = Number(el.entW.value);
      const h = Number(el.entH.value);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < 8 || h < 8) return;
      patchEnt({ w: Math.round(w), h: Math.round(h), scale: 1 }, { record: _sizeHistReady });
      _sizeHistReady = false;
    };
    el.entW.addEventListener('focus', () => { _sizeHistReady = true; });
    el.entH.addEventListener('focus', () => { _sizeHistReady = true; });
    el.entW.addEventListener('change', applyEntSize);
    el.entH.addEventListener('change', applyEntSize);
    el.entW.addEventListener('input', applyEntSize);
    el.entH.addEventListener('input', applyEntSize);
    const normRot = (r) => Math.round((((Number(r) % 360) + 360) % 360));
    const applyRotation = (deg, opts) => {
      const r = normRot(deg);
      if (el.entRot) el.entRot.value = r;
      if (el.entRotSlider) el.entRotSlider.value = String(r);
      patchEnt({ rotation: r }, opts);
    };
    let _rotHistReady = false;
    el.entRot?.addEventListener('focus', () => { _rotHistReady = true; });
    el.entRotSlider?.addEventListener('pointerdown', () => { _rotHistReady = true; });
    el.entRot?.addEventListener('change', () => {
      applyRotation(el.entRot.value, { record: true });
      _rotHistReady = false;
    });
    el.entRot?.addEventListener('input', () => {
      applyRotation(el.entRot.value, { record: _rotHistReady });
      _rotHistReady = false;
    });
    el.entRotSlider?.addEventListener('input', () => {
      applyRotation(el.entRotSlider.value, { record: _rotHistReady });
      _rotHistReady = false;
    });
    el.entRotSlider?.addEventListener('change', () => {
      applyRotation(el.entRotSlider.value, { record: true });
      _rotHistReady = false;
    });
    const bumpRot = (delta) => {
      const ent = store.getSelectedEntity();
      if (!ent) return;
      applyRotation((ent.rotation || 0) + delta, { record: true });
    };
    document.getElementById('btnRotM1')?.addEventListener('click', () => bumpRot(-1));
    document.getElementById('btnRotP1')?.addEventListener('click', () => bumpRot(1));
    document.getElementById('btnRotM15')?.addEventListener('click', () => bumpRot(-15));
    document.getElementById('btnRotP15')?.addEventListener('click', () => bumpRot(15));
    document.getElementById('btnRotM90')?.addEventListener('click', () => bumpRot(-90));
    document.getElementById('btnRotP90')?.addEventListener('click', () => bumpRot(90));
    document.getElementById('btnFlipX')?.addEventListener('click', () => {
      const ent = store.getSelectedEntity();
      if (!ent) return;
      patchEnt({ flipX: !ent.flipX });
    });
    document.getElementById('btnFlipY')?.addEventListener('click', () => {
      const ent = store.getSelectedEntity();
      if (!ent) return;
      patchEnt({ flipY: !ent.flipY });
    });
    document.getElementById('btnRot0')?.addEventListener('click', () => applyRotation(0, { record: true }));
    document.getElementById('btnRot90')?.addEventListener('click', () => applyRotation(90, { record: true }));
    document.getElementById('btnRot180')?.addEventListener('click', () => applyRotation(180, { record: true }));
    document.getElementById('btnRot270')?.addEventListener('click', () => applyRotation(270, { record: true }));
    el.entInteract.addEventListener('change', () => patchEnt({ interaction: { type: el.entInteract.value } }));
    el.entInteractR.addEventListener('change', () => patchEnt({ interaction: { radius: Number(el.entInteractR.value) || 0 } }));
    el.entPayload.addEventListener('change', () => {
      let payload = {};
      try { payload = el.entPayload.value.trim() ? JSON.parse(el.entPayload.value) : {}; }
      catch { setStatus('payload JSON 无效', 'err'); return; }
      patchEnt({ interaction: { payload } });
    });
    el.entColMode.addEventListener('change', () => {
      patchEnt({ collision: { mode: el.entColMode.value } });
      refreshInspector();
    });
    el.entColR.addEventListener('change', () => patchEnt({ collision: { radius: Number(el.entColR.value) || 0 } }));

    document.getElementById('btnDrawPoly').addEventListener('click', () => {
      const p = store.getActive();
      if (!p?.selectedEntityId) return;
      scene.beginPolyForSelected();
      document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === 'poly'));
      setStatus('依次点击顶点（至少 4 点），再点「完成碰撞」或双击 / Enter 保存', 'ok');
    });
    const commitPolyUi = () => {
      if (!scene.commitPoly()) {
        setStatus('至少点 4 个顶点后再保存碰撞', 'err');
      }
    };
    document.getElementById('btnCommitPoly').addEventListener('click', commitPolyUi);
    document.getElementById('btnCommitPoly2').addEventListener('click', commitPolyUi);
    document.getElementById('btnDrawZone').addEventListener('click', () => {
      const p = store.getActive();
      if (!p) return;
      p.selectedEntityId = null;
      scene.state.tool = 'poly';
      scene.state.polyDraft = { target: 'zone', entityId: null, points: [] };
      document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === 'poly'));
      setStatus('独立碰撞区：至少 4 个顶点，再点「完成碰撞」或双击闭合', 'ok');
      scene.draw();
    });
    document.getElementById('btnDelEntity').addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      // 按钮删物体时强制按素材焦点，避免误清碰撞
      if (scene?.state) scene.state.focusKind = 'entity';
      deleteSelectedEntity();
    });
    document.getElementById('btnDupEntity')?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      duplicateSelectedEntity();
    });
    document.getElementById('btnDelCollision').addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (scene?.state) {
        if (scene.state.selectedAirWallId) {
          scene.state.focusKind = 'airwall';
        } else if (scene.state.selectedZoneId && !store.getActive()?.selectedEntityId) {
          scene.state.focusKind = 'zone';
        } else {
          scene.state.focusKind = 'collision';
        }
      }
      deleteSelectedFocus();
    });

    document.getElementById('btnGround').addEventListener('change', async (ev) => {
      const file = ev.target.files?.[0];
      ev.target.value = '';
      if (!file) return;
      const p = store.getActive();
      await store.setGround(p.selectedRegionId, file, file.name);
      syncScene(false);
      setStatus('地面已更换', 'ok');
    });
  }

  function bindToolbar() {
    document.getElementById('btnNew').addEventListener('click', () => {
      const name = prompt('世界显示名', '自定义地图');
      if (name == null) return;
      let id = prompt('世界 id', 'custom-map');
      if (id == null) return;
      try {
        store.createNew({ id: id.trim().toLowerCase(), name: name.trim() });
        history.clear();
        store.persistAll();
        renderWorldList();
        syncScene(true);
        refreshInspector();
      } catch (e) { setStatus(e.message, 'err'); }
    });
    document.getElementById('btnSave').addEventListener('click', async () => {
      // 先把未闭合的碰撞草稿写入场景，再持久化
      if (scene?.flushPolyDraft?.()) {
        setStatus('已先闭合碰撞多边形，正在存盘…', 'ok');
      }
      await store.persistAll();
      renderWorldList();
      refreshInspector();
      setStatus('已保存到本机（含碰撞体积）', 'ok');
    });
    document.getElementById('btnUndo').addEventListener('click', () => history.undo());
    document.getElementById('btnDup').addEventListener('click', async () => {
      const p = store.getActive();
      if (!p) return;
      let id = prompt('新世界 id', p.world.id.replace(/^builtin-/, 'custom-') + '-copy');
      if (!id) return;
      try {
        store.duplicateActive(id.trim().toLowerCase(), p.world.name + ' 副本');
        history.clear();
        await store.persistAll();
        renderWorldList();
        syncScene(true);
        setStatus('已另存副本', 'ok');
      } catch (e) { setStatus(e.message, 'err'); }
    });
    document.getElementById('btnDelete').addEventListener('click', async () => {
      const p = store.getActive();
      if (!p) return;
      if (!confirm(`删除「${p.world.name}」？`)) return;
      try {
        await store.remove(p.world.id);
        renderWorldList();
        syncScene(true);
        refreshInspector();
      } catch (e) { setStatus(e.message, 'err'); }
    });
    document.getElementById('btnValidate').addEventListener('click', runValidate);
    document.getElementById('btnExport').addEventListener('click', async () => {
      const p = store.getActive();
      try { await zipIo.exportProjectZip(p); setStatus('已导出', 'ok'); }
      catch (e) { setStatus(e.message, 'err'); }
    });
    document.getElementById('btnApply').addEventListener('click', () => {
      const p = store.getActive();
      if (!p) return;
      try {
        const result = window.MapEditorLiveApply.applyProject(p);
        const n = result.worldLive.entities?.length || 0;
        const terrainCount = (result.worldLive.entities || []).filter((e) => String(e.kind || '').startsWith('terrain-')).length;
        const sp = result.worldLive.spawn || {};

        const sameOriginHint =
          location.port === '5188' || location.port === ''
            ? result.gameUrl
            : `请改用同源游戏页（当前编辑器端口 ${location.port}）：先从仓库根目录 serve 5188，再开 /publish/?local=1`;
        setStatus(
          `已写入 live（${result.worldLive.name} · ${n} 物体）。游戏请开：${sameOriginHint} ，进城镇即可看到；战斗图需进对应地图。`,
          'ok',
        );
        alert(
          `已应用到游戏缓存。\n\n请确认游戏打开的是同源地址：\n${result.gameUrl}\n\n（不要用 :5173）\n\n然后进入城镇 / 对应战斗图查看。\n物体数：${n}\n地形：${terrainCount}\n出生点：(${Math.round(sp.x||0)}, ${Math.round(sp.y||0)})\n类型：${result.worldLive.kind} / ${result.worldLive.mapId || '-'}`,
        );
        try {
          window.open(result.gameUrl, 'xiandao-game-live');
        } catch (_) {}
      } catch (e) {
        setStatus('应用失败：' + (e.message || e), 'err');
      }
    });
    document.getElementById('btnImport').addEventListener('change', async (ev) => {
      const file = ev.target.files?.[0];
      ev.target.value = '';
      if (!file) return;
      try {
        const project = await zipIo.importProjectZip(file);
        store.upsert(project);
        history.clear();
        await store.persistAll();
        renderWorldList();
        syncScene(true);
        setStatus('已导入', 'ok');
      } catch (e) { setStatus(e.message, 'err'); }
    });
    document.getElementById('btnResetBuiltin').addEventListener('click', async () => {
      if (!confirm('用游戏当前默认数据重置城镇+三张战斗图？（自定义世界保留）')) return;
      await store.resetBuiltins();
      history.clear();
      renderWorldList();
      syncScene(true);
      refreshInspector();
      setStatus('内置地图已重置', 'ok');
    });
    document.getElementById('btnFit').addEventListener('click', () => scene.fitView() || scene.draw());

    document.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        scene.setTool(btn.dataset.tool, placeKind);
        setStatus(`工具：${btn.textContent}`, 'ok');
      });
    });

    document.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        paletteGroup = chip.dataset.group;
        renderPalette();
      });
    });
  }

  function applySpawn(x, y, { record = false, silent = false } = {}) {
    const p = store.getActive();
    if (!p) return;
    if (record) pushHistory();
    const sx = Math.round(Number(x) || 0);
    const sy = Math.round(Number(y) || 0);
    const regionId = p.world.spawn?.regionId || p.selectedRegionId || 'origin';
    store.updateWorld({
      spawn: { ...(p.world.spawn || {}), regionId, x: sx, y: sy },
    });
    if (scene) {
      scene.state.focusKind = 'spawn';
      scene.draw();
    }
    refreshInspector();
    syncUndoBtn();
    markWorldListDirty();
    if (!silent) setStatus(`出生点 → (${sx}, ${sy})`, 'ok');
  }

  function openSpawnModal(preset) {
    const modal = document.getElementById('spawnModal');
    const p = store.getActive();
    if (!modal || !p) return;
    const mx = document.getElementById('spawnModalX');
    const my = document.getElementById('spawnModalY');
    if (preset && Number.isFinite(preset.x) && Number.isFinite(preset.y)) {
      mx.value = Math.round(preset.x);
      my.value = Math.round(preset.y);
    } else {
      mx.value = Math.round(p.world.spawn?.x ?? 0);
      my.value = Math.round(p.world.spawn?.y ?? 0);
    }
    modal.hidden = false;
    mx.focus();
    mx.select();
  }

  function closeSpawnModal() {
    const modal = document.getElementById('spawnModal');
    if (modal) modal.hidden = true;
  }

  function bindSpawnModal() {
    const modal = document.getElementById('spawnModal');
    if (!modal || modal._bound) return;
    modal._bound = true;
    document.getElementById('spawnModalCancel')?.addEventListener('click', () => closeSpawnModal());
    document.getElementById('spawnModalOk')?.addEventListener('click', () => {
      const x = Number(document.getElementById('spawnModalX')?.value) || 0;
      const y = Number(document.getElementById('spawnModalY')?.value) || 0;
      applySpawn(x, y, { record: true });
      closeSpawnModal();
    });
    document.getElementById('spawnModalCenter')?.addEventListener('click', () => {
      const p = store.getActive();
      const w = p?.world?.scene?.worldW || 2800;
      const h = p?.world?.scene?.worldH || 1900;
      document.getElementById('spawnModalX').value = Math.round(w / 2);
      document.getElementById('spawnModalY').value = Math.round(h / 2);
    });
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) closeSpawnModal();
    });
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && modal && !modal.hidden) {
        closeSpawnModal();
        ev.preventDefault();
      }
    });
  }

  async function boot() {
    scene = window.MapEditorScene.createSceneController(el.canvas, {
      onNeedRedraw: () => scene.draw(),
      onBeforeEdit: () => pushHistory(),
      onChange: () => {
        markWorldListDirty();
        refreshInspector();
        syncUndoBtn();
      },
      onSelectEntity: () => refreshInspector(),
      onDragging: (ent) => {
        hideEntFloatBar();
        syncDragFields(ent);
      },
      onSelectionHud: (box) => syncEntFloatBar(box),
      onStatus: (m) => setStatus(m, 'ok'),
      onSetSpawn: (x, y, opt) => applySpawn(x, y, { record: false, silent: !!opt?.silent }),
      onGroundDblClick: (wpt) => openSpawnModal(wpt),
      onPolySaved: () => {
        document.querySelectorAll('.tool-btn').forEach((b) => {
          b.classList.toggle('active', b.dataset.tool === (scene.state.tool || 'select'));
        });
        refreshInspector();
        markWorldListDirty();
        syncUndoBtn();
        // 存盘不阻塞交互
        store.persistAll().then(() => setStatus('碰撞已保存到本机', 'ok')).catch(() => {});
      },
      onTool: () => {},
      onDeleteSelected: () => deleteSelectedFocus(),
    });

    bindInspector();
    bindEntFloatBar();
    bindToolbar();
    bindSpawnModal();
    syncUndoBtn();

    window.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'z' || ev.key === 'Z') && !ev.shiftKey) {
        // 始终撤地图操作（不要被输入框抢走）
        ev.preventDefault();
        ev.stopPropagation();
        history.undo();
        return;
      }
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'd' || ev.key === 'D')) {
        const inField = ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName);
        if (inField) return;
        ev.preventDefault();
        ev.stopPropagation();
        duplicateSelectedEntity();
      }
    }, true);
    await store.loadAll();
    let needReseed = false;
    for (const p of store.projects.values()) {
      migrateAssetUrls(p);
      const g = p.world?.scene?.groundUrl || '';
      if (p.world?.builtin && (g.includes('../publish') || !g.startsWith('/publish/'))) needReseed = true;
    }
    if (needReseed) {
      await store.resetBuiltins();
      setStatus('已自动刷新内置地图素材路径', 'ok');
    }
    // 预热常用贴图
    for (const k of catalog.PROP_KINDS) {
      const img = new Image();
      img.src = k.src;
    }
    renderWorldList();
    renderPalette();
    syncScene(true);
    refreshInspector();
    if (!needReseed) setStatus('已载入 · 选中后点「删除此物体」或按 Delete', 'ok');

    window.addEventListener('resize', () => syncScene(false));
  }

  function migrateAssetUrls(project) {
    const fix = (u) => {
      if (!u || typeof u !== 'string') return u;
      if (u.startsWith('../publish/')) return u.replace(/^\.\.\/publish\//, '/publish/');
      if (u.startsWith('./publish/')) return u.replace(/^\.\/publish\//, '/publish/');
      return u;
    };
    if (project.world?.scene) project.world.scene.groundUrl = fix(project.world.scene.groundUrl);
    for (const reg of Object.values(project.regions || {})) {
      reg.groundUrl = fix(reg.groundUrl);
      for (const ent of reg.entities || []) {
        if (ent.meta?.srcOverride) ent.meta.srcOverride = fix(ent.meta.srcOverride);
      }
    }
    for (const bag of Object.values(project.assets || {})) {
      if (bag.groundUrlExternal) bag.groundUrlExternal = fix(bag.groundUrlExternal);
    }
  }

  boot().catch((e) => {
    console.error(e);
    setStatus('启动失败：' + (e.message || e), 'err');
  });
})();
