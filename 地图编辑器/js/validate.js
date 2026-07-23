(function (global) {
  const S = () => global.MapEditorSchema;

  function isValidId(id) {
    return S().ID_RE.test(id || '');
  }

  async function readImageSize(blob) {
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('图片无法解码'));
        i.src = url;
      });
      return { w: img.naturalWidth, h: img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function validateProject(project) {
    const errors = [];
    const warnings = [];
    const { world, regions, assets } = project;
    const schema = S();

    if (!isValidId(world.id)) {
      errors.push({ code: 'world.id', msg: `世界 id 非法：须匹配 ${schema.ID_RE}` });
    }
    if (!world.name?.trim()) errors.push({ code: 'world.name', msg: '世界名称不能为空' });
    if (!world.originRegionId || !regions[world.originRegionId]) {
      errors.push({ code: 'world.origin', msg: '缺少有效的 origin 区域' });
    }

    const coordMap = new Map();
    for (const entry of world.regions || []) {
      const reg = regions[entry.id];
      if (!reg) {
        errors.push({ code: `region.${entry.id}.missing`, msg: `清单有 ${entry.id} 但缺少数据` });
        continue;
      }
      const key = `${reg.rx},${reg.ry}`;
      if (coordMap.has(key)) {
        errors.push({ code: `region.${reg.id}.coord`, msg: `坐标 (${reg.rx},${reg.ry}) 冲突` });
      } else coordMap.set(key, reg.id);

      const bag = assets[reg.id] || {};
      const hasGround = !!(bag.ground || bag.groundUrlExternal || reg.groundUrl || world.scene?.groundUrl);
      if (!hasGround) {
        errors.push({ code: `region.${reg.id}.ground`, msg: `「${reg.name}」缺少地面` });
      } else if (bag.ground) {
        if (bag.ground.size > schema.MAX_GROUND_BYTES) {
          warnings.push({ code: `region.${reg.id}.size`, msg: `「${reg.name}」地面偏大` });
        }
        try {
          const dim = await readImageSize(bag.ground);
          if (dim && dim.w !== dim.h) {
            warnings.push({ code: `region.${reg.id}.dim`, msg: `「${reg.name}」地面非方图 ${dim.w}×${dim.h}（平铺仍可用）` });
          }
        } catch (e) {
          errors.push({ code: `region.${reg.id}.decode`, msg: String(e.message || e) });
        }
      }

      for (const ent of reg.entities || []) {
        if (!ent.id) errors.push({ code: 'ent.id', msg: '存在无 id 的摆放物' });
        const col = ent.collision;
        if (col?.mode === 'polygon') {
          if (!col.points || col.points.length < 4) {
            errors.push({ code: `ent.${ent.id}.poly`, msg: `「${ent.interaction?.label || ent.id}」多边形碰撞至少 4 点` });
          }
        }
        if (col?.mode === 'circle' && !(col.radius > 0)) {
          warnings.push({ code: `ent.${ent.id}.circle`, msg: `「${ent.id}」圆形碰撞半径为 0` });
        }
      }

      for (const zone of reg.collisions || []) {
        if (zone.mode === 'polygon' && (!zone.points || zone.points.length < 4)) {
          errors.push({ code: `zone.${zone.id}`, msg: `碰撞区「${zone.name || zone.id}」顶点不足` });
        }
      }
    }

    return { ok: errors.length === 0, errors, warnings, canPlay: errors.length === 0 };
  }

  global.MapEditorValidate = { isValidId, readImageSize, validateProject };
})(window);
