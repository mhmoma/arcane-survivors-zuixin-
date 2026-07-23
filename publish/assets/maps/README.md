# 地图资源

运行时优先读取本目录 `live-pack.json`（烘焙自地图编辑器）。

## 接入流程

1. 地图编辑器编辑并「应用到游戏」
2. 打开 `/地图编辑器/bake-to-game.html`（需 bake 服务 `python _bake-server.py`）
3. 写入 `live-pack.json` 后硬刷新 `/publish/?local=1`

读取优先级：`localStorage`（仅当比烘焙包新）→ `live-pack.json` → 游戏默认布局。
