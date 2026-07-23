/**
 * 场景画布：平移缩放、拖拽摆放、互动半径、点对点多边形碰撞
 */
(function (global) {
  const Catalog = () => global.MapEditorCatalog;
  const imgCache = new Map();

  function loadImage(src) {
    if (!src) return null;
    const key = normalizeSrc(src);
    if (imgCache.has(key)) return imgCache.get(key);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = key;
    imgCache.set(key, img);
    return img;
  }

  function normalizeSrc(src) {
    if (!src) return src;
    if (src.startsWith('blob:') || src.startsWith('data:') || src.startsWith('http')) return src;
    // 兼容旧相对路径
    if (src.startsWith('../publish/')) return src.replace(/^\.\.\/publish\//, '/publish/');
    if (src.startsWith('./publish/')) return src.replace(/^\.\/publish\//, '/publish/');
    if (src.startsWith('publish/')) return '/' + src;
    return src;
  }

  function atlasFrame(img, atlas, dw, dh, ctx, dx, dy) {
    if (!img?.complete || !img.naturalWidth) return false;
    const cols = atlas.cols || 4;
    const rows = atlas.rows || 4;
    const fw = img.naturalWidth / cols;
    const fh = img.naturalHeight / rows;
    const ix = atlas.index % cols;
    const iy = Math.floor(atlas.index / cols);
    ctx.drawImage(img, ix * fw, iy * fh, fw, fh, dx, dy, dw, dh);
    return true;
  }

  /** 脚底中心锚点：旋转（度）+ 镜像 */
  function withEntityXform(ctx, e, w, h, drawBody) {
    const rot = (Number(e.rotation) || 0) * Math.PI / 180;
    const sx = e.flipX ? -1 : 1;
    const sy = e.flipY ? -1 : 1;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(rot);
    ctx.scale(sx, sy);
    drawBody(ctx, -w / 2, -h, w, h);
    ctx.restore();
  }

  function createSceneController(canvas, hooks = {}) {
    const state = {
      camera: { x: 0, y: 0, zoom: 0.35 },
      tool: 'select', // select | place | poly | pan
      placeKind: null,
      drag: null,
      polyDraft: null, // { target: 'entity'|'zone', entityId?, points: [] }
      hoverId: null,
      project: null,
      regionId: null,
      spacePan: false,
      selectedZoneId: null,
      selectedAirWallId: null,
      airDraft: null, // { mode:'segment', a:[x,y] } | { mode:'rect', x,y }
      /** entity | collision | zone | airwall | spawn — Delete 按焦点删除 */
      focusKind: null,
    };

    function getSpawn() {
      const sp = state.project?.world?.spawn;
      if (!sp) return { x: 0, y: 0 };
      return { x: Number(sp.x) || 0, y: Number(sp.y) || 0 };
    }

    function hitSpawn(wx, wy) {
      const sp = getSpawn();
      const r = Math.max(16 / state.camera.zoom, 12);
      return Math.hypot(wx - sp.x, wy - sp.y) <= r;
    }

    function drawSpawn(ctx) {
      const sp = getSpawn();
      const z = state.camera.zoom;
      const hi = state.focusKind === 'spawn';
      const r = 10 / z;
      ctx.save();
      // 十字准星
      ctx.strokeStyle = hi ? 'rgba(94, 234, 212, 0.95)' : 'rgba(52, 211, 153, 0.85)';
      ctx.lineWidth = 2 / z;
      ctx.beginPath();
      ctx.moveTo(sp.x - 18 / z, sp.y);
      ctx.lineTo(sp.x + 18 / z, sp.y);
      ctx.moveTo(sp.x, sp.y - 18 / z);
      ctx.lineTo(sp.x, sp.y + 18 / z);
      ctx.stroke();
      // 圆点
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
      ctx.fillStyle = hi ? 'rgba(45, 212, 191, 0.95)' : 'rgba(16, 185, 129, 0.9)';
      ctx.fill();
      ctx.strokeStyle = hi ? 'rgba(255, 255, 255, 0.9)' : 'rgba(236, 253, 245, 0.75)';
      ctx.lineWidth = 1.5 / z;
      ctx.stroke();
      // 旗杆式标签
      ctx.fillStyle = hi ? 'rgba(204, 251, 241, 0.98)' : 'rgba(167, 243, 208, 0.95)';
      ctx.font = `bold ${12 / z}px Segoe UI, Microsoft YaHei, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('出生点', sp.x, sp.y - 22 / z);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    function region() {
      const p = state.project;
      if (!p) return null;
      return p.regions[state.regionId || p.selectedRegionId];
    }

    function sceneSize(reg, world) {
      const sc = world?.scene || {};
      return {
        W: sc.worldW || world?.defaults?.regionSize || 2800,
        H: sc.worldH || 1900,
        tile: sc.tileSize || 512,
        groundUrl: reg?.groundUrl || state.project?.assets?.[reg?.id]?.groundUrlExternal || sc.groundUrl,
        fill: reg?.fill || world?.defaults?.fill || '#080b1b',
      };
    }

    function worldFromEvent(ev) {
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      const { x, y, zoom } = state.camera;
      return { x: (sx - x) / zoom, y: (sy - y) / zoom, sx, sy };
    }

    function hitEntity(wx, wy, ents) {
      // 自上而下（z 大优先）；按旋转/镜像后的局部包围盒命中
      const sorted = [...ents].filter((e) => e.enabled !== false).sort((a, b) => (b.z || 0) - (a.z || 0));
      for (const e of sorted) {
        const { w, h } = entityLocalSize(e);
        const { lx, ly } = worldToEntityLocal(e, wx, wy);
        if (lx >= -w / 2 && lx <= w / 2 && ly >= -h && ly <= 8) return e;
      }
      return null;
    }

    function draw() {
      const p = state.project;
      const reg = region();
      if (!p || !reg) return;
      const world = p.world;
      const { W, H, tile, groundUrl, fill } = sceneSize(reg, world);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = canvas.clientWidth || canvas.parentElement?.clientWidth || 800;
      const cssH = canvas.clientHeight || canvas.parentElement?.clientHeight || 560;
      const bw = Math.floor(cssW * dpr);
      const bh = Math.floor(cssH * dpr);
      // 避免每帧重置 canvas（会清空并卡顿）
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = '#070c10';
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.save();
      ctx.translate(state.camera.x, state.camera.y);
      ctx.scale(state.camera.zoom, state.camera.zoom);

      // 地面
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, W, H);
      const gImg = loadImage(groundUrl);
      if (gImg?.complete && gImg.naturalWidth) {
        for (let y = 0; y < H; y += tile) {
          for (let x = 0; x < W; x += tile) {
            ctx.drawImage(gImg, x, y, tile, tile);
          }
        }
      } else if (gImg && !gImg._hooked) {
        gImg._hooked = true;
        gImg.onload = () => hooks.onNeedRedraw?.();
      }

      // 路径
      for (const path of reg.paths || []) {
        if (!path.points?.length) continue;
        ctx.beginPath();
        path.points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.strokeStyle = 'rgba(110,150,130,.35)';
        ctx.lineWidth = path.strokeOuter || 80;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.strokeStyle = 'rgba(212,175,106,.16)';
        ctx.lineWidth = path.strokeInner || 40;
        ctx.stroke();
      }

      // 独立碰撞区（未选中时淡显；选中高亮）
      for (const zone of reg.collisions || []) {
        const hi = state.selectedZoneId === zone.id && !p.selectedEntityId;
        drawPoly(ctx, zone.points || [], {
          fill: hi ? 'rgba(220,90,90,0.28)' : 'rgba(200,80,80,0.08)',
          stroke: hi ? 'rgba(255,140,120,0.95)' : 'rgba(220,100,100,0.35)',
          selected: hi,
        });
      }

      // 空气墙
      for (const aw of reg.airWalls || []) {
        drawAirWall(ctx, aw, aw.id === state.selectedAirWallId);
      }
      if (state.airDraft) drawAirDraft(ctx, state.airDraft);

      // 实体
      const ents = [...(reg.entities || [])].sort((a, b) => ((a.z || 0) - (b.z || 0)) || ((a.y || 0) - (b.y || 0)));
      for (const e of ents) {
        drawEntity(ctx, e, e.id === p.selectedEntityId);
      }

      // 出生点（画在实体之上，便于点选）
      drawSpawn(ctx);

      // 世界边框
      ctx.strokeStyle = 'rgba(180,200,190,0.35)';
      ctx.lineWidth = 4 / state.camera.zoom;
      ctx.strokeRect(0, 0, W, H);

      // 多边形草稿：点数≥4 时预览红色封闭碰撞区
      if (state.polyDraft?.points?.length) {
        const pts = state.polyDraft.points;
        if (pts.length >= 4) {
          ctx.beginPath();
          pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
          ctx.closePath();
          ctx.fillStyle = 'rgba(220,90,90,0.35)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,150,120,0.95)';
          ctx.lineWidth = 2 / state.camera.zoom;
          ctx.stroke();
        } else {
          ctx.beginPath();
          pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
          ctx.strokeStyle = '#7ec8b0';
          ctx.lineWidth = 2 / state.camera.zoom;
          ctx.setLineDash([8 / state.camera.zoom, 6 / state.camera.zoom]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        for (const [px, py] of pts) {
          ctx.beginPath();
          ctx.arc(px, py, 5 / state.camera.zoom, 0, Math.PI * 2);
          ctx.fillStyle = '#d4b45a';
          ctx.fill();
        }
        if (pts.length >= 4) {
          const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
          const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
          ctx.fillStyle = 'rgba(255,220,180,0.95)';
          ctx.font = `${12 / state.camera.zoom}px Segoe UI, Microsoft YaHei`;
          ctx.textAlign = 'center';
          ctx.fillText('红色封闭区 = 碰撞（需≥4点）', cx, cy);
          ctx.textAlign = 'left';
        }
      }

      ctx.restore();

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(10, 10, 280, 54);
      ctx.fillStyle = '#e8e4d8';
      ctx.font = '12px Segoe UI, Microsoft YaHei, sans-serif';
      ctx.fillText(`工具: ${toolLabel(state.tool)}  ·  缩放 ${(state.camera.zoom * 100).toFixed(0)}%`, 18, 30);
      ctx.fillStyle = '#8a968c';
      ctx.fillText('单击空地设出生点 · 双击空地开设置 · 可拖绿标', 18, 50);
      emitSelectionHud();
    }

    function toolLabel(t) {
      return ({ select: '选择/拖动', place: '放置素材', poly: '碰撞连线', 'air-line': '空气墙·线', 'air-rect': '空气墙·框', pan: '平移' })[t] || t;
    }

    function entityLocalSize(e) {
      return {
        w: Math.max(8, (e.w || 64) * (e.scale || 1)),
        h: Math.max(8, (e.h || 64) * (e.scale || 1)),
      };
    }

    /** 世界坐标 ↔ 实体脚底局部（含旋转/镜像） */
    function worldToEntityLocal(e, wx, wy) {
      const rot = (Number(e.rotation) || 0) * Math.PI / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      let x = wx - e.x;
      let y = wy - e.y;
      let lx = x * cos + y * sin;
      let ly = -x * sin + y * cos;
      if (e.flipX) lx = -lx;
      if (e.flipY) ly = -ly;
      return { lx, ly };
    }

    function entityLocalToWorld(e, lx, ly) {
      let x = lx;
      let y = ly;
      if (e.flipX) x = -x;
      if (e.flipY) y = -y;
      const rot = (Number(e.rotation) || 0) * Math.PI / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      return {
        x: e.x + x * cos - y * sin,
        y: e.y + x * sin + y * cos,
      };
    }

    function resizeHandles(e) {
      const { w, h } = entityLocalSize(e);
      // 四角 + 四边中点（路面/花坛等扁长素材更好拖）
      const locals = [
        { id: 'nw', lx: -w / 2, ly: -h },
        { id: 'n', lx: 0, ly: -h },
        { id: 'ne', lx: w / 2, ly: -h },
        { id: 'e', lx: w / 2, ly: -h / 2 },
        { id: 'se', lx: w / 2, ly: 0 },
        { id: 's', lx: 0, ly: 0 },
        { id: 'sw', lx: -w / 2, ly: 0 },
        { id: 'w', lx: -w / 2, ly: -h / 2 },
      ];
      return locals.map((hnd) => {
        const p = entityLocalToWorld(e, hnd.lx, hnd.ly);
        return { id: hnd.id, x: p.x, y: p.y };
      });
    }

    function hitResizeHandle(wx, wy, e) {
      if (!e) return null;
      // 屏幕约 14px；边中点稍大一点更好点
      const hs = Math.max(14 / state.camera.zoom, 10);
      const edgeHs = Math.max(18 / state.camera.zoom, 12);
      for (const hnd of resizeHandles(e)) {
        const edge = hnd.id === 'n' || hnd.id === 's' || hnd.id === 'e' || hnd.id === 'w';
        const r = edge ? edgeHs : hs;
        if (Math.abs(wx - hnd.x) <= r && Math.abs(wy - hnd.y) <= r) return hnd.id;
      }
      return null;
    }

    /** 选中物上方的旋转手柄（世界坐标） */
    function rotateHandlePos(e) {
      const { h } = entityLocalSize(e);
      const lift = Math.max(28 / state.camera.zoom, 18);
      return entityLocalToWorld(e, 0, -h - lift);
    }

    function hitRotateHandle(wx, wy, e) {
      if (!e) return false;
      const hs = Math.max(16 / state.camera.zoom, 12);
      const p = rotateHandlePos(e);
      return Math.hypot(wx - p.x, wy - p.y) <= hs;
    }

    /** 根据指针相对脚底中心的方向设任意角度；Shift 吸附 15° */
    function applyFreeRotation(ent, wx, wy, snap15) {
      // 画布 y 向下；默认 0° 朝上，对应 atan2 的 -90°
      let deg = Math.atan2(wy - ent.y, wx - ent.x) * 180 / Math.PI + 90;
      deg = ((deg % 360) + 360) % 360;
      if (snap15) deg = Math.round(deg / 15) * 15;
      else deg = Math.round(deg);
      deg = ((deg % 360) + 360) % 360;
      ent.rotation = deg;
    }

    function applyCornerResize(ent, wx, wy, corner, drag) {
      // 对边固定：四角/四边各自调节对应宽高，拖底边会下移脚点而不是压扁
      const ow = Number(drag?.ow) || entityLocalSize(ent).w;
      const oh = Number(drag?.oh) || entityLocalSize(ent).h;
      const ox = Number(drag?.ox ?? ent.x);
      const oy = Number(drag?.oy ?? ent.y);
      const flipX = drag ? !!drag.flipX : !!ent.flipX;
      const flipY = drag ? !!drag.flipY : !!ent.flipY;
      const rotDeg = drag?.rot != null ? Number(drag.rot) : (Number(ent.rotation) || 0);
      const rot = rotDeg * Math.PI / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);

      let dx = wx - ox;
      let dy = wy - oy;
      let lx = dx * cos + dy * sin;
      let ly = -dx * sin + dy * cos;
      if (flipX) lx = -lx;
      if (flipY) ly = -ly;

      let left = -ow / 2;
      let right = ow / 2;
      let top = -oh;
      let bottom = 0;
      const c = corner || 'se';
      const moveW = c === 'w' || c === 'nw' || c === 'sw';
      const moveE = c === 'e' || c === 'ne' || c === 'se';
      const moveN = c === 'n' || c === 'nw' || c === 'ne';
      const moveS = c === 's' || c === 'sw' || c === 'se';

      if (moveW) left = Math.min(lx, right - 16);
      if (moveE) right = Math.max(lx, left + 16);
      if (moveN) top = Math.min(ly, bottom - 16);
      if (moveS) bottom = Math.max(ly, top + 16);

      const nw = Math.max(16, right - left);
      const nh = Math.max(16, bottom - top);

      // 新脚底中心（局部）→ 世界，使未拖动的边保持不动
      let flx = (left + right) / 2;
      let fly = bottom;
      if (flipX) flx = -flx;
      if (flipY) fly = -fly;
      ent.x = ox + flx * cos - fly * sin;
      ent.y = oy + flx * sin + fly * cos;
      ent.w = Math.round(nw);
      ent.h = Math.round(nh);
      if (ent.scale && ent.scale !== 1) ent.scale = 1;
    }

    /** 选中素材在画布上的屏幕包围盒（相对 canvas 左上） */
    function selectedEntityScreenBox() {
      const p = state.project;
      const id = p?.selectedEntityId;
      if (!id || state.drag) return null;
      if (state.focusKind && state.focusKind !== 'entity') return null;
      const reg = region();
      const ent = reg?.entities?.find((e) => e.id === id);
      if (!ent || ent.enabled === false) return null;
      const { w, h } = entityLocalSize(ent);
      const pts = [
        entityLocalToWorld(ent, -w / 2, -h),
        entityLocalToWorld(ent, w / 2, -h),
        entityLocalToWorld(ent, w / 2, 0),
        entityLocalToWorld(ent, -w / 2, 0),
      ];
      const { x: cx, y: cy, zoom } = state.camera;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const pt of pts) {
        const sx = pt.x * zoom + cx;
        const sy = pt.y * zoom + cy;
        minX = Math.min(minX, sx);
        minY = Math.min(minY, sy);
        maxX = Math.max(maxX, sx);
        maxY = Math.max(maxY, sy);
      }
      return {
        ent,
        left: minX,
        top: minY,
        right: maxX,
        bottom: maxY,
        midY: (minY + maxY) / 2,
      };
    }

    function emitSelectionHud() {
      hooks.onSelectionHud?.(selectedEntityScreenBox());
    }

    function drawEntity(ctx, e, selected) {
      const kind = Catalog().kindById(e.kind);
      const w = (e.w || 64) * (e.scale || 1);
      const h = (e.h || 64) * (e.scale || 1);
      const src = normalizeSrc(e.meta?.srcOverride || e.src || kind?.src);
      const img = loadImage(src);
      let drawn = false;
      withEntityXform(ctx, e, w, h, (c, dx, dy, dw, dh) => {
        if (kind?.atlas && img) {
          drawn = atlasFrame(img, kind.atlas, dw, dh, c, dx, dy);
        } else if (img?.complete && img.naturalWidth) {
          c.drawImage(img, dx, dy, dw, dh);
          drawn = true;
        }
        if (!drawn) {
          c.fillStyle = '#2a3a40';
          c.fillRect(dx, dy, dw, dh);
          c.strokeStyle = '#7ec8b0';
          c.strokeRect(dx, dy, dw, dh);
          drawn = true;
        }
      });
      if (img && !img.complete && !img._hooked) {
        img._hooked = true;
        img.onload = () => hooks.onNeedRedraw?.();
      }

      // 互动半径
      if (e.interaction && e.interaction.type !== 'none' && e.interaction.radius > 0) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.interaction.radius, 0, Math.PI * 2);
        ctx.strokeStyle = selected ? 'rgba(126,200,176,0.85)' : 'rgba(126,200,176,0.35)';
        ctx.lineWidth = 1.5 / state.camera.zoom;
        ctx.setLineDash([6 / state.camera.zoom, 4 / state.camera.zoom]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 碰撞体积：未选中淡显，选中高亮；使用世界坐标（画在哪就是哪）
      const col = e.collision || {};
      if (col.mode === 'circle' && col.radius > 0) {
        const c = Catalog().circleWorldCenter(e);
        ctx.beginPath();
        ctx.arc(c.x, c.y, col.radius, 0, Math.PI * 2);
        ctx.fillStyle = selected ? 'rgba(220,90,90,0.32)' : 'rgba(220,90,90,0.08)';
        ctx.fill();
        ctx.strokeStyle = selected ? 'rgba(255,150,120,0.95)' : 'rgba(220,90,90,0.28)';
        ctx.lineWidth = (selected ? 2.5 : 1) / state.camera.zoom;
        ctx.stroke();
        if (selected) {
          ctx.fillStyle = 'rgba(255,200,160,0.9)';
          ctx.font = `${11 / state.camera.zoom}px Segoe UI, Microsoft YaHei`;
          ctx.textAlign = 'center';
          ctx.fillText(`碰撞圆 r=${Math.round(col.radius)}（可拖动）`, c.x, c.y - col.radius - 8 / state.camera.zoom);
          ctx.textAlign = 'left';
        }
      } else if (col.mode === 'polygon' && col.points?.length >= 4) {
        const worldPts = Catalog().collisionPolyWorld(e);
        drawPoly(ctx, worldPts, {
          fill: selected ? 'rgba(220,90,90,0.32)' : 'rgba(220,90,90,0.08)',
          stroke: selected ? 'rgba(255,150,120,0.95)' : 'rgba(220,90,90,0.28)',
          selected,
        });
        if (selected) {
          const cx = worldPts.reduce((s, p) => s + p[0], 0) / worldPts.length;
          const cy = worldPts.reduce((s, p) => s + p[1], 0) / worldPts.length;
          ctx.fillStyle = 'rgba(255,200,160,0.9)';
          ctx.font = `${11 / state.camera.zoom}px Segoe UI, Microsoft YaHei`;
          ctx.textAlign = 'center';
          ctx.fillText(`碰撞多边形 · ${col.points.length} 点（可拖动）`, cx, cy);
          ctx.textAlign = 'left';
        }
      }

      if (selected) {
        // 选中框跟随旋转/镜像
        withEntityXform(ctx, e, w, h, (c, dx, dy, dw, dh) => {
          c.strokeStyle = '#d4b45a';
          c.lineWidth = 2 / state.camera.zoom;
          c.strokeRect(dx - 2, dy - 2, dw + 4, dh + 4);
        });
        // 缩放手柄（随旋转/镜像，四角方块 + 四边短条）
        const hs = 8 / state.camera.zoom;
        ctx.fillStyle = '#d4b45a';
        ctx.strokeStyle = '#1a1410';
        ctx.lineWidth = 1 / state.camera.zoom;
        for (const hnd of resizeHandles(e)) {
          ctx.beginPath();
          const edge = hnd.id === 'n' || hnd.id === 's' || hnd.id === 'e' || hnd.id === 'w';
          if (edge) {
            const along = (hnd.id === 'n' || hnd.id === 's') ? hs * 2.2 : hs * 0.7;
            const across = (hnd.id === 'n' || hnd.id === 's') ? hs * 0.7 : hs * 2.2;
            // 短条沿边方向，近似（旋转后仍用轴对齐小条，足够点选）
            ctx.rect(hnd.x - along, hnd.y - across, along * 2, across * 2);
          } else {
            ctx.rect(hnd.x - hs, hnd.y - hs, hs * 2, hs * 2);
          }
          ctx.fill();
          ctx.stroke();
        }
        // 自由旋转手柄：青色圆点 + 连线
        const rh = rotateHandlePos(e);
        const top = entityLocalToWorld(e, 0, -h);
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(rh.x, rh.y);
        ctx.strokeStyle = 'rgba(56,189,248,0.85)';
        ctx.lineWidth = 1.5 / state.camera.zoom;
        ctx.stroke();
        const rr = 7 / state.camera.zoom;
        ctx.beginPath();
        ctx.arc(rh.x, rh.y, rr, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
        ctx.strokeStyle = '#0c4a6e';
        ctx.lineWidth = 1.2 / state.camera.zoom;
        ctx.stroke();
        const bits = [];
        if (e.flipX) bits.push('左右镜像');
        if (e.flipY) bits.push('上下翻转');
        bits.push(`${Math.round((((Number(e.rotation) || 0) % 360) + 360) % 360)}°`);
        ctx.fillStyle = 'rgba(125,211,252,0.95)';
        ctx.font = `${11 / state.camera.zoom}px Segoe UI, Microsoft YaHei`;
        ctx.textAlign = 'center';
        ctx.fillText(bits.join(' · '), rh.x, rh.y - 12 / state.camera.zoom);
        ctx.textAlign = 'left';
      }

      // 标签
      const label = e.interaction?.label || kind?.name || e.id;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = `${11 / state.camera.zoom}px Segoe UI, Microsoft YaHei`;
      const tw = ctx.measureText(label).width;
      ctx.fillRect(e.x - tw / 2 - 4, e.y + 6, tw + 8, 14 / state.camera.zoom);
      ctx.fillStyle = '#f2efe6';
      ctx.textAlign = 'center';
      ctx.fillText(label, e.x, e.y + 6 + 11 / state.camera.zoom);
      ctx.textAlign = 'left';
    }

    function drawPoly(ctx, points, { fill, stroke, selected }) {
      if (!points || points.length < 2) return;
      ctx.beginPath();
      points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.strokeStyle = selected ? '#d4b45a' : stroke;
      ctx.lineWidth = (selected ? 2.5 : 1.5) / state.camera.zoom;
      ctx.stroke();
      for (const [px, py] of points) {
        ctx.beginPath();
        ctx.arc(px, py, 4 / state.camera.zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#d4b45a';
        ctx.fill();
      }
    }

    function fitView() {
      const p = state.project;
      const reg = region();
      if (!p || !reg) return;
      const { W, H } = sceneSize(reg, p.world);
      const cssW = canvas.clientWidth || 800;
      const cssH = canvas.clientHeight || 560;
      const zoom = Math.min(cssW / W, cssH / H) * 0.92;
      state.camera.zoom = Math.max(0.08, Math.min(2, zoom));
      state.camera.x = (cssW - W * state.camera.zoom) / 2;
      state.camera.y = (cssH - H * state.camera.zoom) / 2;
    }

    function setProject(project, regionId) {
      state.project = project;
      state.regionId = regionId || project?.selectedRegionId;
      draw();
    }

    function setTool(tool, placeKind) {
      // 离开碰撞工具时：点数够则自动保存，否则丢弃草稿
      if (state.tool === 'poly' && tool !== 'poly' && state.polyDraft) {
        if (state.polyDraft.points?.length >= 4) {
          commitPoly({ keepTool: true });
        } else {
          state.polyDraft = null;
        }
      }
      if ((state.tool === 'air-line' || state.tool === 'air-rect') && tool !== 'air-line' && tool !== 'air-rect') {
        state.airDraft = null;
      }
      state.tool = tool;
      if (placeKind == null || tool !== 'place') state.placeKind = null;
      else state.placeKind = placeKind;
      draw();
      hooks.onTool?.(state.tool);
    }

    function beginPolyForSelected() {
      const p = state.project;
      const reg = region();
      if (!p || !reg) return;
      const ent = reg.entities?.find((e) => e.id === p.selectedEntityId);
      state.tool = 'poly';
      state.polyDraft = {
        target: ent ? 'entity' : 'zone',
        entityId: ent?.id || null,
        points: [],
      };
      hooks.onStatus?.('点选顶点连线（至少 4 点）；双击或 Enter 闭合；Esc 取消');
      draw();
    }

    // —— 事件 ——
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const before = worldFromEvent(ev);
      const factor = ev.deltaY > 0 ? 0.9 : 1.1;
      state.camera.zoom = Math.max(0.08, Math.min(2.5, state.camera.zoom * factor));
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      state.camera.x = sx - before.x * state.camera.zoom;
      state.camera.y = sy - before.y * state.camera.zoom;
      draw();
    }, { passive: false });

    canvas.addEventListener('pointerdown', (ev) => {
      // 只捕获画布自身的指针，避免盖住旁侧菜单
      if (ev.target !== canvas) return;
      try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}
      const wpt = worldFromEvent(ev);
      const reg = region();
      if (!reg) return;

      // 中键 / 右键 / 空格 / 平移工具：拖动画布
      if (ev.button === 1 || ev.button === 2 || state.tool === 'pan' || state.spacePan) {
        state.drag = { type: 'pan', lx: ev.clientX, ly: ev.clientY, cx: state.camera.x, cy: state.camera.y };
        return;
      }

      if (state.tool === 'poly') {
        if (!state.polyDraft) beginPolyForSelected();
        state.polyDraft.points.push([wpt.x, wpt.y]);
        draw();
        hooks.onPolyDraft?.(state.polyDraft);
        return;
      }

      if (state.tool === 'air-line') {
        if (!state.airDraft || state.airDraft.mode !== 'segment') {
          state.airDraft = { mode: 'segment', a: [wpt.x, wpt.y] };
          hooks.onStatus?.('空气墙线段：再点终点');
          draw();
          return;
        }
        hooks.onBeforeEdit?.();
        const wall = {
          id: `aw-${Math.random().toString(36).slice(2, 8)}`,
          mode: 'segment',
          a: [Math.round(state.airDraft.a[0]), Math.round(state.airDraft.a[1])],
          b: [Math.round(wpt.x), Math.round(wpt.y)],
          thickness: 18,
          enabled: true,
        };
        reg.airWalls = reg.airWalls || [];
        reg.airWalls.push(wall);
        state.airDraft = null;
        state.selectedAirWallId = wall.id;
        state.selectedZoneId = null;
        state.project.selectedEntityId = null;
        state.focusKind = 'airwall';
        state.project.dirty = true;
        hooks.onSelectEntity?.(null);
        state.tool = 'select';
        document.querySelectorAll('.tool-btn').forEach((b) => {
          b.classList.toggle('active', b.dataset.tool === 'select');
        });
        hooks.onChange?.();
        hooks.onStatus?.('空气墙线段已保存 · 左键选中后 Delete 可删');
        draw();
        return;
      }

      if (state.tool === 'air-rect') {
        state.airDraft = { mode: 'rect', x: wpt.x, y: wpt.y, w: 0, h: 0 };
        state.drag = { type: 'air-rect-new', lx: wpt.x, ly: wpt.y };
        hooks.onStatus?.('拖动拉出矩形空气墙；松开完成（自动回到选择）');
        draw();
        return;
      }

      if (state.tool === 'place' && state.placeKind) {
        // 点到已有素材 → 选中（方便改大小/复制），不强制再放一个
        const existing = hitEntity(wpt.x, wpt.y, reg.entities || []);
        if (existing && !ev.shiftKey) {
          state.project.selectedEntityId = existing.id;
          state.selectedZoneId = null;
          state.selectedAirWallId = null;
          state.focusKind = 'entity';
          state.tool = 'select';
          state.placeKind = null;
          document.querySelectorAll('.tool-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.tool === 'select');
          });
          document.querySelectorAll('.pal-item').forEach((b) => b.classList.remove('active'));
          hooks.onSelectEntity?.(existing.id);
          hooks.onStatus?.('已选中素材 · 拖四角/边点改大小 · Ctrl+D 复制');
          draw();
          return;
        }
        hooks.onBeforeEdit?.();
        const ent = Catalog().makeEntity(state.placeKind, wpt.x, wpt.y);
        reg.entities = reg.entities || [];
        reg.entities.push(ent);
        state.project.selectedEntityId = ent.id;
        state.focusKind = 'entity';
        state.project.dirty = true;
        hooks.onChange?.();
        draw();
        return;
      }

      // select：优先旋转手柄，再四角缩放；再优先拖红色碰撞区
      // 出生点：优先于空地点击（可拖动）
      if ((state.tool === 'select' || !state.tool) && hitSpawn(wpt.x, wpt.y)) {
        state.project.selectedEntityId = null;
        state.selectedZoneId = null;
        state.selectedAirWallId = null;
        state.focusKind = 'spawn';
        hooks.onSelectEntity?.(null);
        state.drag = {
          type: 'spawn',
          lx: wpt.x,
          ly: wpt.y,
          sx: wpt.x,
          sy: wpt.y,
          cx: ev.clientX,
          cy: ev.clientY,
          armed: false,
          historyPushed: false,
        };
        hooks.onStatus?.('已选中出生点 · 拖动可移动 · 单击空地可重设');
        draw();
        return;
      }

      const selected = (reg.entities || []).find((e) => e.id === state.project.selectedEntityId);
      if (selected && (state.tool === 'select' || !state.tool) && hitRotateHandle(wpt.x, wpt.y, selected)) {
        hooks.onBeforeEdit?.();
        state.drag = { type: 'rotate', id: selected.id };
        state.focusKind = 'entity';
        hooks.onSelectEntity?.(selected.id);
        hooks.onStatus?.('拖动旋转 · 任意角度 · 按住 Shift 吸附 15°');
        draw();
        return;
      }
      const corner = selected ? hitResizeHandle(wpt.x, wpt.y, selected) : null;
      if (corner && (state.tool === 'select' || !state.tool)) {
        const { w: ow, h: oh } = entityLocalSize(selected);
        hooks.onBeforeEdit?.();
        state.drag = {
          type: 'resize',
          id: selected.id,
          corner,
          ow,
          oh,
          ox: selected.x,
          oy: selected.y,
          flipX: !!selected.flipX,
          flipY: !!selected.flipY,
          rot: Number(selected.rotation) || 0,
        };
        state.focusKind = 'entity';
        hooks.onSelectEntity?.(selected.id);
        hooks.onStatus?.('拖角/边改大小（对边固定）');
        draw();
        return;
      }

      // 空气墙：左键选中（可 Delete）；拖动需移动超过阈值才真正挪动
      const awHit = hitAirWall(wpt.x, wpt.y, reg.airWalls || []);
      if (awHit) {
        const corner = awHit.mode === 'rect' ? hitAirRectHandle(wpt.x, wpt.y, awHit) : null;
        state.selectedAirWallId = awHit.id;
        state.selectedZoneId = null;
        state.project.selectedEntityId = null;
        state.focusKind = 'airwall';
        hooks.onSelectEntity?.(null);
        if (corner) {
          hooks.onBeforeEdit?.();
          state.drag = { type: 'air-resize', id: awHit.id, corner };
          hooks.onStatus?.('拖动角点调整矩形空气墙');
        } else {
          state.drag = {
            type: 'air-move',
            id: awHit.id,
            lx: wpt.x,
            ly: wpt.y,
            sx: wpt.x,
            sy: wpt.y,
            cx: ev.clientX,
            cy: ev.clientY,
            armed: false,
          };
          hooks.onStatus?.('已选中空气墙 · Delete 删除 · 按住拖动可移动');
        }
        draw();
        return;
      }

      // 碰撞体积：左键选中即可删；移动超阈值才拖
      const colHit = hitEntityCollision(wpt.x, wpt.y, reg.entities || []);
      if (colHit) {
        state.project.selectedEntityId = colHit.id;
        state.selectedZoneId = null;
        state.selectedAirWallId = null;
        state.focusKind = 'collision';
        ensureWorldCollision(colHit);
        state.drag = {
          type: 'col',
          id: colHit.id,
          lx: wpt.x,
          ly: wpt.y,
          sx: wpt.x,
          sy: wpt.y,
          cx: ev.clientX,
          cy: ev.clientY,
          armed: false,
        };
        hooks.onStatus?.('已选中碰撞体积 · Delete 删除 · 按住拖动可移动');
        hooks.onSelectEntity?.(colHit.id);
        draw();
        return;
      }

      const zone = hitZone(wpt.x, wpt.y, reg.collisions || []);
      if (zone) {
        state.project.selectedEntityId = null;
        state.selectedZoneId = zone.id;
        state.selectedAirWallId = null;
        state.focusKind = 'zone';
        state.drag = {
          type: 'zone',
          id: zone.id,
          lx: wpt.x,
          ly: wpt.y,
          sx: wpt.x,
          sy: wpt.y,
          cx: ev.clientX,
          cy: ev.clientY,
          armed: false,
        };
        hooks.onSelectEntity?.(null);
        hooks.onStatus?.('已选中独立碰撞区 · Delete 可删除 · 按住拖动可移动');
        draw();
        return;
      }

      const hit = hitEntity(wpt.x, wpt.y, reg.entities || []);
      if (hit) {
        state.project.selectedEntityId = hit.id;
        state.selectedZoneId = null;
        state.selectedAirWallId = null;
        state.focusKind = 'entity';
        state.drag = {
          type: 'entity',
          id: hit.id,
          ox: wpt.x - hit.x,
          oy: wpt.y - hit.y,
          lx: wpt.x,
          ly: wpt.y,
          cx: ev.clientX,
          cy: ev.clientY,
          armed: false,
          historyPushed: false,
        };
        const col = hit.collision || {};
        if (col.mode === 'polygon' && col.points?.length >= 4) {
          hooks.onStatus?.('已选中素材 · 点红区可选中碰撞；Delete 删除素材');
        } else if (col.mode === 'circle' && col.radius > 0) {
          hooks.onStatus?.(`已选中素材 · 碰撞圆 r=${Math.round(col.radius)}`);
        } else {
          hooks.onStatus?.('已选中素材');
        }
        hooks.onSelectEntity?.(hit.id);
        draw();
      } else {
        // 选择工具下点空地：设置出生点
        state.project.selectedEntityId = null;
        state.selectedZoneId = null;
        state.selectedAirWallId = null;
        if (state.tool === 'select' || !state.tool) {
          const sx = Math.round(wpt.x);
          const sy = Math.round(wpt.y);
          hooks.onBeforeEdit?.();
          state.focusKind = 'spawn';
          hooks.onSetSpawn?.(sx, sy);
          hooks.onSelectEntity?.(null);
          hooks.onStatus?.(`出生点已设为 (${sx}, ${sy}) · 双击空地打开设置`);
        } else {
          state.focusKind = null;
          hooks.onSelectEntity?.(null);
        }
        draw();
      }
    });

    canvas.addEventListener('pointermove', (ev) => {
      // 左键已松开却还在 drag → 强制放下（防止粘鼠标）
      if (state.drag && state.drag.type !== 'pan' && !(ev.buttons & 1)) {
        finishPointerDrag(ev);
        return;
      }
      if (!state.drag) return;
      if (state.drag.type === 'pan') {
        state.camera.x = state.drag.cx + (ev.clientX - state.drag.lx);
        state.camera.y = state.drag.cy + (ev.clientY - state.drag.ly);
        draw();
        return;
      }
      if (state.drag.type === 'resize') {
        const wpt = worldFromEvent(ev);
        const reg = region();
        const ent = reg?.entities?.find((e) => e.id === state.drag.id);
        if (ent) {
          applyCornerResize(ent, wpt.x, wpt.y, state.drag.corner, state.drag);
          state.project.dirty = true;
          hooks.onDragging?.(ent);
          draw();
        }
        return;
      }
      if (state.drag.type === 'rotate') {
        const wpt = worldFromEvent(ev);
        const reg = region();
        const ent = reg?.entities?.find((e) => e.id === state.drag.id);
        if (ent) {
          applyFreeRotation(ent, wpt.x, wpt.y, !!ev.shiftKey);
          state.project.dirty = true;
          hooks.onDragging?.(ent);
          draw();
        }
        return;
      }
      if (state.drag.type === 'col') {
        const wpt = worldFromEvent(ev);
        if (!armDragIfNeeded(state.drag, ev, wpt)) return;
        const reg = region();
        const ent = reg?.entities?.find((e) => e.id === state.drag.id);
        if (ent) {
          const dx = wpt.x - state.drag.lx;
          const dy = wpt.y - state.drag.ly;
          translateCollision(ent, dx, dy);
          state.drag.lx = wpt.x;
          state.drag.ly = wpt.y;
          state.project.dirty = true;
          hooks.onDragging?.(ent);
          draw();
        }
        return;
      }
      if (state.drag.type === 'zone') {
        const wpt = worldFromEvent(ev);
        if (!armDragIfNeeded(state.drag, ev, wpt)) return;
        const reg = region();
        const zone = reg?.collisions?.find((z) => z.id === state.drag.id);
        if (zone?.points) {
          const dx = wpt.x - state.drag.lx;
          const dy = wpt.y - state.drag.ly;
          zone.points = zone.points.map(([x, y]) => [x + dx, y + dy]);
          state.drag.lx = wpt.x;
          state.drag.ly = wpt.y;
          state.project.dirty = true;
          draw();
        }
        return;
      }
      if (state.drag.type === 'air-rect-new') {
        const wpt = worldFromEvent(ev);
        if (state.airDraft?.mode === 'rect') {
          const x0 = state.drag.lx, y0 = state.drag.ly;
          state.airDraft.x = Math.min(x0, wpt.x);
          state.airDraft.y = Math.min(y0, wpt.y);
          state.airDraft.w = Math.abs(wpt.x - x0);
          state.airDraft.h = Math.abs(wpt.y - y0);
          draw();
        }
        return;
      }
      if (state.drag.type === 'air-move') {
        const wpt = worldFromEvent(ev);
        if (!armDragIfNeeded(state.drag, ev, wpt)) return;
        const reg = region();
        const aw = (reg?.airWalls || []).find((z) => z.id === state.drag.id);
        if (aw) {
          const dx = wpt.x - state.drag.lx;
          const dy = wpt.y - state.drag.ly;
          translateAirWall(aw, dx, dy);
          state.drag.lx = wpt.x;
          state.drag.ly = wpt.y;
          state.project.dirty = true;
          draw();
        }
        return;
      }
      if (state.drag.type === 'air-resize') {
        const wpt = worldFromEvent(ev);
        const reg = region();
        const aw = (reg?.airWalls || []).find((z) => z.id === state.drag.id);
        if (aw?.mode === 'rect') {
          resizeAirRect(aw, state.drag.corner, wpt.x, wpt.y);
          state.project.dirty = true;
          draw();
        }
        return;
      }
      if (state.drag.type === 'spawn') {
        const wpt = worldFromEvent(ev);
        if (!armDragIfNeeded(state.drag, ev, wpt)) return;
        if (!state.drag.historyPushed) {
          hooks.onBeforeEdit?.();
          state.drag.historyPushed = true;
        }
        const sx = Math.round(wpt.x);
        const sy = Math.round(wpt.y);
        hooks.onSetSpawn?.(sx, sy, { silent: true });
        state.focusKind = 'spawn';
        draw();
        return;
      }
      if (state.drag.type === 'entity') {
        const wpt = worldFromEvent(ev);
        if (!armDragIfNeeded(state.drag, ev, wpt)) return;
        const reg = region();
        const ent = reg?.entities?.find((e) => e.id === state.drag.id);
        if (ent) {
          if (!state.drag.historyPushed) {
            hooks.onBeforeEdit?.();
            state.drag.historyPushed = true;
          }
          ent.x = wpt.x - state.drag.ox;
          ent.y = wpt.y - state.drag.oy;
          state.project.dirty = true;
          hooks.onDragging?.(ent);
          draw();
        }
      }
    });

    function finishPointerDrag(ev) {
      if (state.drag?.type === 'air-rect-new' && state.airDraft?.mode === 'rect') {
        const d = state.airDraft;
        const reg = region();
        if (reg && d.w >= 12 && d.h >= 12) {
          hooks.onBeforeEdit?.();
          const wall = {
            id: `aw-${Math.random().toString(36).slice(2, 8)}`,
            mode: 'rect',
            x: Math.round(d.x),
            y: Math.round(d.y),
            w: Math.round(d.w),
            h: Math.round(d.h),
            enabled: true,
          };
          reg.airWalls = reg.airWalls || [];
          reg.airWalls.push(wall);
          state.selectedAirWallId = wall.id;
          state.selectedZoneId = null;
          state.project.selectedEntityId = null;
          state.focusKind = 'airwall';
          state.project.dirty = true;
          hooks.onSelectEntity?.(null);
          state.tool = 'select';
          document.querySelectorAll('.tool-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.tool === 'select');
          });
          hooks.onChange?.();
          hooks.onStatus?.('矩形空气墙已保存 · 左键选中后 Delete 可删');
        } else if (state.airDraft) {
          hooks.onStatus?.('矩形太小，已取消（至少约 12×12）');
        }
        state.airDraft = null;
        state.drag = null;
        try { if (ev?.pointerId != null) canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
        draw();
        return;
      }
      if (state.drag?.type === 'entity' || state.drag?.type === 'resize'
        || state.drag?.type === 'rotate'
        || state.drag?.type === 'col' || state.drag?.type === 'zone'
        || state.drag?.type === 'air-move' || state.drag?.type === 'air-resize'
        || state.drag?.type === 'pan') {
        const dragType = state.drag.type;
        // 先清空 drag，再通知/重绘，否则浮层会因 drag 仍在而隐藏
        state.drag = null;
        if (dragType !== 'pan') hooks.onChange?.();
        draw();
        try { if (ev?.pointerId != null) canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
        return;
      }
      state.drag = null;
      try { if (ev?.pointerId != null) canvas.releasePointerCapture(ev.pointerId); } catch (_) {}
    }

    canvas.addEventListener('pointerup', finishPointerDrag);
    canvas.addEventListener('pointercancel', finishPointerDrag);
    canvas.addEventListener('lostpointercapture', () => {
      if (state.drag) finishPointerDrag(null);
    });
    // 窗口级兜底：松手一定放下，避免粘鼠标
    window.addEventListener('pointerup', (ev) => {
      if (state.drag && state.drag.type !== 'pan') finishPointerDrag(ev);
    });
    window.addEventListener('blur', () => {
      if (state.drag) finishPointerDrag(null);
    });
    canvas.addEventListener('dblclick', (ev) => {
      if (state.tool === 'poly' && state.polyDraft?.points?.length >= 4) {
        commitPoly();
        return;
      }
      // 双击空地：弹出出生点 / 世界设置
      if (state.tool === 'poly' || state.tool === 'air-line' || state.tool === 'air-rect' || state.tool === 'place') {
        return;
      }
      const wpt = worldFromEvent(ev);
      const reg = region();
      if (!reg) return;
      if (hitEntity(wpt.x, wpt.y, reg.entities || [])) return;
      if (hitEntityCollision(wpt.x, wpt.y, reg.entities || [])) return;
      if (hitZone(wpt.x, wpt.y, reg.collisions || [])) return;
      if (hitAirWall(wpt.x, wpt.y, reg.airWalls || [])) return;
      hooks.onGroundDblClick?.(wpt);
    });

    window.addEventListener('keydown', (ev) => {
      const tag = ev.target && ev.target.tagName;
      const inField = tag && /INPUT|TEXTAREA|SELECT/.test(tag)
        && !ev.target.disabled && !ev.target.readOnly;
      if (ev.code === 'Space' && !inField) { state.spacePan = true; ev.preventDefault(); }
      if (ev.key === 'Enter' && state.polyDraft?.points?.length >= 4) {
        commitPoly();
      }
      if (ev.key === 'Escape') {
        state.polyDraft = null;
        state.airDraft = null;
        state.tool = 'select';
        draw();
        hooks.onStatus?.('已取消');
      }
      // Delete / Backspace：按焦点删除碰撞或素材，并立刻重绘
      // 输入框里编辑文字时不拦截 Delete（避免删不掉字符）
      const delKey = (ev.key === 'Delete' || ev.code === 'Delete' || ev.key === 'Del') && !inField;
      const backKey = (ev.key === 'Backspace' || ev.code === 'Backspace') && !inField;
      if (delKey || backKey) {
        ev.preventDefault();
        ev.stopPropagation();
        const ok = hooks.onDeleteSelected?.();
        if (!ok) {
          const reg = region();
          if (reg && state.project?.selectedEntityId) {
            hooks.onBeforeEdit?.();
            reg.entities = (reg.entities || []).filter((e) => e.id !== state.project.selectedEntityId);
            state.project.selectedEntityId = null;
            state.focusKind = null;
            state.selectedZoneId = null;
            state.selectedAirWallId = null;
            state.polyDraft = null;
            state.project.dirty = true;
            hooks.onChange?.();
          }
        }
        state.drag = null;
        draw();
      }
    });
    window.addEventListener('keyup', (ev) => {
      if (ev.code === 'Space') state.spacePan = false;
    });

    function commitPoly(opts = {}) {
      const draft = state.polyDraft;
      const reg = region();
      const p = state.project;
      if (!draft || !reg || !p || draft.points.length < 4) {
        hooks.onStatus?.('至少需要 4 个顶点才能构成碰撞体积');
        return false;
      }
      hooks.onBeforeEdit?.();
      // 世界坐标：红色封闭区画在哪，游戏里就在哪挡人
      const worldPts = draft.points.map(([x, y]) => [Math.round(x), Math.round(y)]);
      if (draft.target === 'entity' && draft.entityId) {
        const ent = reg.entities.find((e) => e.id === draft.entityId);
        if (ent) {
          Catalog().setCollisionPolyWorld(ent, worldPts);
          p.selectedEntityId = ent.id;
          state.selectedZoneId = null;
          state.focusKind = 'collision';
        }
      } else {
        const id = `zone-${Math.random().toString(36).slice(2, 7)}`;
        reg.collisions = reg.collisions || [];
        reg.collisions.push({
          id,
          name: '自定义碰撞区',
          mode: 'polygon',
          space: 'world',
          points: worldPts,
          blockOutside: false,
        });
        state.selectedZoneId = id;
        p.selectedEntityId = null;
        state.focusKind = 'zone';
      }
      state.polyDraft = null;
      if (!opts.keepTool) state.tool = 'select';
      p.dirty = true;
      hooks.onChange?.();
      hooks.onPolySaved?.();
      hooks.onStatus?.('红色封闭碰撞区已保存；点「应用到游戏」后进城镇/地图即可挡住角色');
      draw();
      return true;
    }

    /** 若有未闭合草稿且 ≥4 点则提交；返回是否提交成功 */
    function flushPolyDraft() {
      if (state.polyDraft?.points?.length >= 4) return commitPoly({ keepTool: true });
      return false;
    }

    function pointInPoly(wx, wy, pts) {
      if (!pts || pts.length < 3) return false;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1];
        const xj = pts[j][0], yj = pts[j][1];
        const intersect = ((yi > wy) !== (yj > wy))
          && (wx < ((xj - xi) * (wy - yi)) / ((yj - yi) || 1e-9) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    function hitZone(wx, wy, zones) {
      for (let i = (zones || []).length - 1; i >= 0; i--) {
        const z = zones[i];
        if (pointInPoly(wx, wy, z.points || [])) return z;
      }
      return null;
    }

    function hitEntityCollision(wx, wy, ents) {
      const sorted = [...ents].filter((e) => e.enabled !== false).sort((a, b) => (b.z || 0) - (a.z || 0));
      for (const e of sorted) {
        const col = e.collision || {};
        if (col.mode === 'polygon' && col.points?.length >= 4) {
          if (pointInPoly(wx, wy, Catalog().collisionPolyWorld(e))) return e;
        } else if (col.mode === 'circle' && col.radius > 0) {
          const c = Catalog().circleWorldCenter(e);
          if (Math.hypot(wx - c.x, wy - c.y) <= col.radius) return e;
        }
      }
      return null;
    }

    /** 把旧 local 多边形升为世界坐标，便于独立拖动 */
    function ensureWorldCollision(ent) {
      const col = ent.collision || {};
      if (col.mode === 'polygon' && col.points?.length >= 4 && col.space !== 'world') {
        Catalog().setCollisionPolyWorld(ent, Catalog().collisionPolyWorld(ent));
      } else if (col.mode === 'circle' && col.space !== 'world') {
        const c = Catalog().circleWorldCenter(ent);
        ent.collision = {
          ...col,
          mode: 'circle',
          space: 'world',
          x: c.x,
          y: c.y,
          radius: col.radius,
        };
      }
    }

    function translateCollision(ent, dx, dy) {
      ensureWorldCollision(ent);
      const col = ent.collision;
      if (col.mode === 'polygon' && col.points) {
        col.points = col.points.map(([x, y]) => [x + dx, y + dy]);
        col.space = 'world';
      } else if (col.mode === 'circle') {
        col.space = 'world';
        col.x = (col.x ?? ent.x) + dx;
        col.y = (col.y ?? ent.y) + dy;
      }
    }



    function armDragIfNeeded(drag, ev, wpt, threshPx = 12) {
      if (!drag) return false;
      if (drag.armed) return true;
      // 用屏幕像素判断，避免低缩放时世界坐标一抖就触发粘拖
      const cx = drag.cx ?? ev.clientX;
      const cy = drag.cy ?? ev.clientY;
      if (Math.hypot(ev.clientX - cx, ev.clientY - cy) < threshPx) return false;
      if (drag.type !== 'entity') hooks.onBeforeEdit?.();
      drag.armed = true;
      drag.lx = wpt.x;
      drag.ly = wpt.y;
      return true;
    }

    function distToSeg(px, py, ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    function drawAirWall(ctx, aw, hi) {
      const z = state.camera.zoom;
      if (aw.mode === 'segment' && aw.a && aw.b) {
        const th = (Number(aw.thickness) || 18);
        ctx.beginPath();
        ctx.moveTo(aw.a[0], aw.a[1]);
        ctx.lineTo(aw.b[0], aw.b[1]);
        ctx.strokeStyle = hi ? 'rgba(80,220,255,0.95)' : 'rgba(56,189,248,0.55)';
        ctx.lineWidth = Math.max(th, 6 / z);
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.fillStyle = hi ? '#7dd3fc' : '#38bdf8';
        for (const p of [aw.a, aw.b]) {
          ctx.beginPath();
          ctx.arc(p[0], p[1], 5 / z, 0, Math.PI * 2);
          ctx.fill();
        }
        if (hi) {
          const mx = (aw.a[0] + aw.b[0]) / 2, my = (aw.a[1] + aw.b[1]) / 2;
          ctx.fillStyle = 'rgba(186,230,253,0.95)';
          ctx.font = `${11 / z}px Segoe UI, Microsoft YaHei`;
          ctx.textAlign = 'center';
          ctx.fillText('空气墙·线', mx, my - 8 / z);
          ctx.textAlign = 'left';
        }
      } else if (aw.mode === 'rect') {
        ctx.fillStyle = hi ? 'rgba(56,189,248,0.22)' : 'rgba(56,189,248,0.08)';
        ctx.strokeStyle = hi ? 'rgba(125,211,252,0.95)' : 'rgba(56,189,248,0.45)';
        ctx.lineWidth = 2 / z;
        ctx.fillRect(aw.x, aw.y, aw.w, aw.h);
        ctx.strokeRect(aw.x, aw.y, aw.w, aw.h);
        if (hi) {
          ctx.fillStyle = 'rgba(186,230,253,0.95)';
          ctx.font = `${11 / z}px Segoe UI, Microsoft YaHei`;
          ctx.textAlign = 'center';
          ctx.fillText('空气墙·框', aw.x + aw.w / 2, aw.y + aw.h / 2);
          ctx.textAlign = 'left';
          const hs = 6 / z;
          for (const [hx, hy] of airRectHandles(aw)) {
            ctx.fillStyle = '#e0f2fe';
            ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
          }
        }
      }
    }

    function drawAirDraft(ctx, d) {
      const z = state.camera.zoom;
      if (d.mode === 'segment' && d.a) {
        ctx.beginPath();
        ctx.arc(d.a[0], d.a[1], 6 / z, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
      } else if (d.mode === 'rect') {
        ctx.fillStyle = 'rgba(56,189,248,0.15)';
        ctx.strokeStyle = 'rgba(125,211,252,0.9)';
        ctx.lineWidth = 2 / z;
        ctx.setLineDash([8 / z, 6 / z]);
        ctx.fillRect(d.x, d.y, d.w || 0, d.h || 0);
        ctx.strokeRect(d.x, d.y, d.w || 0, d.h || 0);
        ctx.setLineDash([]);
      }
    }

    function airRectHandles(aw) {
      return [
        [aw.x, aw.y],
        [aw.x + aw.w, aw.y],
        [aw.x, aw.y + aw.h],
        [aw.x + aw.w, aw.y + aw.h],
      ];
    }

    function hitAirRectHandle(wx, wy, aw) {
      const hs = 10 / state.camera.zoom;
      const ids = ['nw', 'ne', 'sw', 'se'];
      const pts = airRectHandles(aw);
      for (let i = 0; i < 4; i++) {
        if (Math.abs(wx - pts[i][0]) <= hs && Math.abs(wy - pts[i][1]) <= hs) return ids[i];
      }
      return null;
    }

    function hitAirWall(wx, wy, walls) {
      for (let i = (walls || []).length - 1; i >= 0; i--) {
        const aw = walls[i];
        if (!aw || aw.enabled === false) continue;
        if (aw.mode === 'segment' && aw.a && aw.b) {
          const th = (Number(aw.thickness) || 18) + 6 / state.camera.zoom;
          if (distToSeg(wx, wy, aw.a[0], aw.a[1], aw.b[0], aw.b[1]) <= th) return aw;
        } else if (aw.mode === 'rect') {
          if (wx >= aw.x && wx <= aw.x + aw.w && wy >= aw.y && wy <= aw.y + aw.h) return aw;
        }
      }
      return null;
    }

    function translateAirWall(aw, dx, dy) {
      if (aw.mode === 'segment') {
        aw.a = [aw.a[0] + dx, aw.a[1] + dy];
        aw.b = [aw.b[0] + dx, aw.b[1] + dy];
      } else if (aw.mode === 'rect') {
        aw.x += dx;
        aw.y += dy;
      }
    }

    function resizeAirRect(aw, corner, wx, wy) {
      let L = aw.x, T = aw.y, R = aw.x + aw.w, B = aw.y + aw.h;
      if (corner === 'nw') { L = wx; T = wy; }
      else if (corner === 'ne') { R = wx; T = wy; }
      else if (corner === 'sw') { L = wx; B = wy; }
      else if (corner === 'se') { R = wx; B = wy; }
      aw.x = Math.min(L, R);
      aw.y = Math.min(T, B);
      aw.w = Math.max(12, Math.abs(R - L));
      aw.h = Math.max(12, Math.abs(B - T));
    }

    return {
      state,
      draw,
      fitView,
      setProject,
      setTool,
      beginPolyForSelected,
      commitPoly,
      flushPolyDraft,
      loadImage,
      normalizeSrc,
      selectedEntityScreenBox,
      clearImageCache() { imgCache.clear(); },
    };
  }

  global.MapEditorScene = { createSceneController, loadImage: (s) => loadImage(s), normalizeSrc };
})(window);
