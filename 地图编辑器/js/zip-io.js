(function (global) {
  const S = () => global.MapEditorSchema;

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function exportProjectZip(project) {
    if (!global.JSZip) throw new Error('JSZip 未加载');
    const zip = new JSZip();
    const root = project.world.id;
    const world = JSON.parse(JSON.stringify(project.world));
    world.updatedAt = S().nowIso();
    zip.file(`${root}/world.json`, JSON.stringify(world, null, 2));

    for (const entry of world.regions || []) {
      const reg = project.regions[entry.id];
      if (!reg) continue;
      const folder = zip.folder(`${root}/regions/${reg.id}`);
      const regOut = JSON.parse(JSON.stringify(reg));
      // 导出时去掉 blob URL
      if (regOut.groundUrl && String(regOut.groundUrl).startsWith('blob:')) {
        regOut.groundUrl = null;
        regOut.ground = 'ground.webp';
      }
      folder.file('region.json', JSON.stringify(regOut, null, 2));
      const bag = project.assets[reg.id] || {};
      if (bag.ground) folder.file('ground.webp', bag.ground);
      if (bag.preview) folder.file('preview.webp', bag.preview);
      // 外链地面写一个 manifest 提示
      if (bag.groundUrlExternal) {
        folder.file('ground-ref.json', JSON.stringify({ url: bag.groundUrlExternal }, null, 2));
      }
    }

    zip.file('index.json', JSON.stringify({
      schemaVersion: S().SCHEMA_VERSION,
      worlds: [{ id: world.id, path: world.id, name: world.name, builtin: !!world.builtin, kind: world.kind }],
    }, null, 2));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    downloadBlob(blob, `${world.id}-v${Date.now()}.zip`);
    return blob;
  }

  async function importProjectZip(file) {
    if (!global.JSZip) throw new Error('JSZip 未加载');
    const zip = await JSZip.loadAsync(file);
    const names = Object.keys(zip.files);
    const worldPath = names.find((n) => /(^|\/)world\.json$/i.test(n) && !n.endsWith('/'));
    if (!worldPath) throw new Error('zip 内缺少 world.json');
    const rootPrefix = worldPath.replace(/world\.json$/i, '');
    const world = JSON.parse(await zip.file(worldPath).async('string'));
    const regions = {};
    const assets = {};
    const regionJsonPaths = names.filter((n) => n.startsWith(rootPrefix) && /regions\/[^/]+\/region\.json$/i.test(n));
    for (const rj of regionJsonPaths) {
      const reg = JSON.parse(await zip.file(rj).async('string'));
      reg.entities = reg.entities || [];
      reg.paths = reg.paths || [];
      reg.collisions = reg.collisions || [];
      regions[reg.id] = reg;
      const base = rj.replace(/region\.json$/i, '');
      const groundFile = zip.file(base + 'ground.webp') || zip.file(base + 'ground.png');
      const previewFile = zip.file(base + 'preview.webp') || zip.file(base + 'preview.png');
      const refFile = zip.file(base + 'ground-ref.json');
      assets[reg.id] = {};
      if (groundFile) assets[reg.id].ground = await groundFile.async('blob');
      if (previewFile) assets[reg.id].preview = await previewFile.async('blob');
      if (refFile) {
        const ref = JSON.parse(await refFile.async('string'));
        assets[reg.id].groundUrlExternal = ref.url;
        if (!reg.groundUrl) reg.groundUrl = ref.url;
      }
    }
    if (!world.regions?.length) {
      world.regions = Object.values(regions).map((r) => ({ id: r.id, rx: r.rx, ry: r.ry }));
    }
    for (const entry of world.regions) {
      if (!regions[entry.id]) regions[entry.id] = S().emptyRegion({ id: entry.id, rx: entry.rx, ry: entry.ry });
      if (!assets[entry.id]) assets[entry.id] = {};
    }
    return {
      world,
      regions,
      assets,
      selectedRegionId: world.originRegionId || world.regions[0]?.id,
      selectedEntityId: null,
      viewMode: 'scene',
      dirty: true,
    };
  }

  global.MapEditorZip = { exportProjectZip, importProjectZip, downloadBlob };
})(window);
