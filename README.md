# 仙道飘渺 · xianxiarpg

2D 仙侠幸存者：选道途 → 入仙门道场 → 踏入洞天 → 炼功进化 → 镇压妖潮。

本仓库为可部署静态包（以 `publish/` 为主），含城镇、地图烘焙、Spine / Pixi 特效与配套地图编辑器。

---

## 道途一览 ⚔️

| 道途 | 定位 |
|------|------|
| 金刚体修 | 近身罡域，气血厚重 |
| 符箓道君 | 五行雷火，远程爆发与控场 |
| 青冥剑修 | 御剑穿阵，身法清场 |
| 红尘灵修 | 秘传道途，飞花问心与莲台心域 |
| 幽冥魂修 | 魂刃血河，收割与锁魂 |
| 玄墨笔修 | 泼墨点杀，折返游墨 |

---

## 玩法要点 🏯

- **仙门道场**：可走动城镇；右侧快捷栏（秘境 / 装备 / 技能 / 其他道途）站立显示、移动隐藏；点击自动寻路
- **道途互换**：点哪位道友，你就变成对方，原位留下你原来的形象
- **洞天历练**：太虚荒原 · 上古剑冢 · 北冥雪境（烘焙地图 + 地形碰撞）
- **功法进化**：主辅功法合成高阶演化（九龙天火、幽月轮回、万墨连锋阵等）
- **灵器 / 神器 / 时装**：局外养成与局内构筑
- **脚步音效**：全职业走跑共用软底踏地声

---

## 视听与特效 ✨

- **Spine 骨骼**：角色 idle / run / 施法，城镇与战斗统一
- **Pixi 渲染**：城镇场景、战斗弹道与粒子特效
- **技能特效**：符剑、真火、雷链、月斩、泼墨、魂刃、飞花等分职业 FX 图集
- **地形特效**：裂隙、祭坛、冰原、符阵等可摆放装饰与固体碰撞
- **BGM / SFX**：山门柔雾曲 + 洞天战斗曲；技能打击分职业音色；走跑步伐音

---

## 仓库结构 📁

```
publish/          # 线上可部署前端（入口 index.html）
地图编辑器/        # 城镇 / 洞天场景摆放、碰撞、应用到游戏
_bake-server.py   # live 包写入 publish/assets/maps/live-pack.json
functions/        # 云端函数（若启用）
scripts/          # 发布与缓存刷新
PUBLISH.md        # 正式发布检查流程
```

---

## 本地预览 🖥️

必须从**仓库根目录**起服务（地图编辑器要读 `/publish/assets`）：

```bash
npx --yes serve -p 5188 .
```

- 游戏：http://localhost:5188/publish/?local=1  
- 地图编辑器：http://localhost:5188/地图编辑器/

仅预览游戏：

```bash
cd publish && npx serve .
```

---

## 地图与热更 🗺️

1. 编辑器与游戏请用**同一端口**（同源才能共享 `localStorage`）
2. 编辑器点「应用到游戏」→ 写入 `xiandao-map-live-v1`
3. 正式包：`publish/assets/maps/live-pack.json`（进城镇 / 开战前会加载）

烘焙：先跑 `_bake-server.py`，再在编辑器侧合并写入。

---

## 发布 🚀

正式上线前按 [`PUBLISH.md`](PUBLISH.md) 做缓存刷新与静态资源检查。  
部署目录一般为整个 `publish/`。

---

## 相关仓库 🔗

| 仓库 | 说明 |
|------|------|
| [arcane-survivors-app](https://github.com/mhmoma/arcane-survivors-app) | 较早完整源码线 |
| [arcane-survivors-legacy](https://github.com/mhmoma/arcane-survivors-legacy) | 静态快照 |

---

仓库：**[xianxiarpg](https://github.com/mhmoma/xianxiarpg)** · 主题：**仙道飘渺**
