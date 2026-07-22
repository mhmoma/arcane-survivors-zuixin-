# 奥术幸存者（Arcane Survivors）

2D WebGL 动作幸存者小游戏：**选择职业 → 探索神器 → 强化构筑 → 对抗怪物潮**。

本仓库为较新的私有发布版（静态 `publish/` 产物为主）。

## 结构

```
publish/     # 可部署前端
functions/   # 云端函数（若启用）
scripts/     # 发布/缓存刷新脚本
PUBLISH.md   # 发布与强制刷新缓存流程
```

## 本地预览

```bash
cd publish
npx serve .
```

## 相关仓库

| 仓库 | 说明 |
|------|------|
| [arcane-survivors-app](https://github.com/mhmoma/arcane-survivors-app) | React + Express + Firebase 完整源码 |
| [arcane-survivors-legacy](https://github.com/mhmoma/arcane-survivors-legacy) | 较早公开静态快照 |

## 发布

正式发布前请按 [`PUBLISH.md`](PUBLISH.md) 做缓存刷新与静态资源检查。
