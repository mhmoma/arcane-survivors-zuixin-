# 仙道 · 地图编辑器（v2）

场景级地图工具：导入现有**城镇**与**太虚 / 剑冢 / 雪境**，自由拖拽摆放素材，设置互动，并用**点对点连线**绘制多边形碰撞。

## 打开

必须从仓库根目录起静态服务（才能读到 `/publish/assets`）：

```bat
cd /d "D:\dzmm版本修仙"
npx --yes serve -p 5188 .
```

打开：[http://localhost:5188/地图编辑器/](http://localhost:5188/地图编辑器/)

若物体仍是灰块占位：服务目录不对。点「重置内置图」后 Ctrl+F5 强刷。

## 功能

| 能力 | 说明 |
|---|---|
| 内置地图 | 城镇（含传送门/箱子/蒲团/木桶/职业 NPC/路径）+ 三张战斗图（地面 + 种子生成的可编辑地形） |
| 拖拽摆放 | 选择工具拖动物体；素材库点选后「放置」 |
| 互动 | 类型（选图/装备/时装/打坐/换职业/自定义）+ 半径 + payload JSON |
| 碰撞 | 圆形半径，或「碰撞连线」点顶点 → 双击/Enter 闭合多边形 |
| 独立碰撞区 | 不绑定物体的世界多边形 |
| 导出 | zip 含 `world.json` / `region.json`（entities、paths、collisions） |

## 应用到游戏（实时）

1. **必须同源**：编辑器与游戏同一端口（推荐从仓库根起服务）  
   - 编辑器：`http://localhost:5188/地图编辑器/`  
   - 游戏：`http://localhost:5188/publish/?local=1`  
2. 在编辑器改完后点 **「应用到游戏」**  
3. 数据写入 `localStorage`（`xiandao-map-live-v1`），并通过 `BroadcastChannel` 通知已打开的游戏页热更新  
4. 城镇摆放/道路/碰撞会立刻生效；战斗地形在下一局或当前局会刷新 `S.terrain`

> 若游戏开在 `5173`、编辑器在 `5188`，两端 localStorage 不通，应用无效。

## 数据字段（region）

- `entities[]`：`kind,x,y,w,h,interaction,collision,meta`  
- `collision.mode`：`none | circle | polygon`  
- `collision.points`：相对物体脚底的本地坐标（独立区则为世界坐标）  
- `paths[]`：城镇道路折线  
- `collisions[]`：独立碰撞多边形  

## 与游戏对接

导出包放到 `publish/assets/maps/worlds/`。运行时加载器仍待接入；本工具已可独立编辑与备份。
