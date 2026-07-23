(function (global) {
  const CELL = 112;
  const PAD = 48;

  function computeBounds(regions) {
    const list = Object.values(regions || {});
    if (!list.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const r of list) {
      minX = Math.min(minX, r.rx);
      maxX = Math.max(maxX, r.rx);
      minY = Math.min(minY, r.ry);
      maxY = Math.max(maxY, r.ry);
    }
    // 四周留一圈空位给「+」
    return { minX: minX - 1, maxX: maxX + 1, minY: minY - 1, maxY: maxY + 1 };
  }

  function draw(canvas, project, { onSelect, onAddDir } = {}) {
    if (!canvas || !project) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = computeBounds(project.regions);
    const cols = bounds.maxX - bounds.minX + 1;
    const rows = bounds.maxY - bounds.minY + 1;
    const cssW = cols * CELL + PAD * 2;
    const cssH = rows * CELL + PAD * 2;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 背景
    const g = ctx.createLinearGradient(0, 0, cssW, cssH);
    g.addColorStop(0, '#0c1418');
    g.addColorStop(1, '#121c22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);

    // 细网格
    ctx.strokeStyle = 'rgba(140,170,160,0.08)';
    ctx.lineWidth = 1;
    for (let x = PAD; x <= cssW - PAD; x += CELL) {
      ctx.beginPath();
      ctx.moveTo(x, PAD);
      ctx.lineTo(x, cssH - PAD);
      ctx.stroke();
    }
    for (let y = PAD; y <= cssH - PAD; y += CELL) {
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(cssW - PAD, y);
      ctx.stroke();
    }

    const byCoord = new Map();
    for (const r of Object.values(project.regions)) {
      byCoord.set(`${r.rx},${r.ry}`, r);
    }

    const selected = project.selectedRegionId;

    function cellOrigin(rx, ry) {
      const cx = PAD + (rx - bounds.minX) * CELL;
      const cy = PAD + (ry - bounds.minY) * CELL;
      return { cx, cy };
    }

    // 空格虚线
    for (let ry = bounds.minY; ry <= bounds.maxY; ry++) {
      for (let rx = bounds.minX; rx <= bounds.maxX; rx++) {
        if (byCoord.has(`${rx},${ry}`)) continue;
        const { cx, cy } = cellOrigin(rx, ry);
        ctx.strokeStyle = 'rgba(120,150,140,0.18)';
        ctx.setLineDash([4, 6]);
        ctx.strokeRect(cx + 8, cy + 8, CELL - 16, CELL - 16);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(120,150,140,0.25)';
        ctx.font = '11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${rx},${ry}`, cx + CELL / 2, cy + CELL / 2 + 4);
      }
    }

    // 区域块
    for (const r of Object.values(project.regions)) {
      const { cx, cy } = cellOrigin(r.rx, r.ry);
      const bag = project.assets[r.id] || {};
      const isSel = r.id === selected;
      const x = cx + 6;
      const y = cy + 6;
      const w = CELL - 12;
      const h = CELL - 12;

      ctx.save();
      // 圆角矩形
      const rad = 10;
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
      ctx.clip();

      if (bag.groundUrl) {
        const img = new Image();
        img.src = bag.groundUrl;
        // 同步画：若未解码则用底色，解码后由外部重绘
        if (img.complete && img.naturalWidth) {
          ctx.drawImage(img, x, y, w, h);
        } else {
          ctx.fillStyle = r.fill || project.world.defaults?.fill || '#1a2830';
          ctx.fillRect(x, y, w, h);
          img.onload = () => {
            // 轻量触发：自定义事件
            canvas.dispatchEvent(new CustomEvent('map-need-redraw'));
          };
        }
      } else {
        ctx.fillStyle = '#1a2830';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(200,180,120,0.55)';
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('待上传', x + w / 2, y + h / 2);
      }

      // 遮罩字
      const grad = ctx.createLinearGradient(x, y + h * 0.45, x, y + h);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.72)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);

      ctx.fillStyle = '#f2efe6';
      ctx.font = '600 12px "Segoe UI", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(truncate(r.name || r.id, 8), x + 8, y + h - 22);
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(220,210,180,0.75)';
      ctx.fillText(`(${r.rx},${r.ry})`, x + 8, y + h - 8);

      if (r.id === project.world.originRegionId) {
        ctx.fillStyle = '#c9a227';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('ORIGIN', x + w - 8, y + 14);
      }

      if (r.enabled === false) {
        ctx.fillStyle = 'rgba(40,20,20,0.55)';
        ctx.fillRect(x, y, w, h);
      }

      ctx.restore();

      ctx.strokeStyle = isSel ? '#d4b45a' : 'rgba(160,180,170,0.35)';
      ctx.lineWidth = isSel ? 2.5 : 1;
      roundRect(ctx, x, y, w, h, 10);
      ctx.stroke();
    }

    // 选中区域四向「+」
    const sel = project.regions[selected];
    if (sel) {
      const dirs = [
        { key: 'up', rx: sel.rx, ry: sel.ry - 1 },
        { key: 'down', rx: sel.rx, ry: sel.ry + 1 },
        { key: 'left', rx: sel.rx - 1, ry: sel.ry },
        { key: 'right', rx: sel.rx + 1, ry: sel.ry },
      ];
      for (const d of dirs) {
        if (byCoord.has(`${d.rx},${d.ry}`)) continue;
        const { cx, cy } = cellOrigin(d.rx, d.ry);
        const bx = cx + CELL / 2;
        const by = cy + CELL / 2;
        ctx.beginPath();
        ctx.arc(bx, by, 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(40, 90, 80, 0.85)';
        ctx.fill();
        ctx.strokeStyle = '#7ec8b0';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#e8fff6';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', bx, by + 1);
        ctx.textBaseline = 'alphabetic';
      }
    }

    // hit test
    canvas._hit = { bounds, byCoord, sel, cellOrigin, onSelect, onAddDir, project };
  }

  function truncate(s, n) {
    const t = String(s || '');
    return t.length <= n ? t : t.slice(0, n - 1) + '…';
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function bindClicks(canvas) {
    if (canvas._bound) return;
    canvas._bound = true;
    canvas.addEventListener('click', (ev) => {
      const hit = canvas._hit;
      if (!hit) return;
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const { bounds, byCoord, sel, cellOrigin, onSelect, onAddDir } = hit;

      if (sel) {
        const dirs = [
          { key: 'up', rx: sel.rx, ry: sel.ry - 1 },
          { key: 'down', rx: sel.rx, ry: sel.ry + 1 },
          { key: 'left', rx: sel.rx - 1, ry: sel.ry },
          { key: 'right', rx: sel.rx + 1, ry: sel.ry },
        ];
        for (const d of dirs) {
          if (byCoord.has(`${d.rx},${d.ry}`)) continue;
          const { cx, cy } = cellOrigin(d.rx, d.ry);
          const bx = cx + CELL / 2;
          const by = cy + CELL / 2;
          if (Math.hypot(x - bx, y - by) <= 18) {
            onAddDir?.(d.key);
            return;
          }
        }
      }

      for (const [key, r] of byCoord) {
        const { cx, cy } = cellOrigin(r.rx, r.ry);
        if (x >= cx + 6 && x <= cx + CELL - 6 && y >= cy + 6 && y <= cy + CELL - 6) {
          onSelect?.(r.id);
          return;
        }
      }
    });
  }

  global.MapEditorCanvas = { draw, bindClicks, CELL };
})(window);
