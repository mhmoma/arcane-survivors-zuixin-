# 空白起点维护指南

本文件面向修改模板的 Agent 和工程维护者。目标是保持模板轻量、配置驱动、离线可用，并保护 Gamefy SDK、AI 请求和存储 schema 的稳定边界。

## 阅读顺序

修改前依次阅读 `README.md`、`CUSTOMIZATION.md`、`publish/config.js`、`publish/content.js`、`publish/app.js`、`publish/sdk-adapter.js`、`publish/storage.js`、`publish/ai-director.js`、`publish/view.js`、`publish/index.html` 和 `publish/style.css`。

内容与主题需求优先只改 `config.js` 和本地 `assets`。启动或交互编排改 `app.js`；平台契约改 `sdk-adapter.js`；存档 schema 改 `storage.js`；AI 预算、校验和备用结果改 `ai-director.js`；DOM 与无障碍渲染改 `view.js`；结构或脚本顺序改 `index.html`。

## 架构与模块所有权

| 文件 | 负责 | 不应负责 |
| --- | --- | --- |
| `config.js` | 品牌、文案、主题、功能开关、AI 参数、存储参数 | DOM、平台调用、持久化 |
| `content.js` | `copy` 的只读内容投影与可替换内容包边界 | DOM、平台调用、持久化 |
| `sdk-adapter.js` | Gamefy 能力检测、启动状态、玩家资料、AI 请求、KV 请求与参数校验 | 页面渲染、业务状态 |
| `storage.js` | v1 到 v2 迁移、计数与 AI 缓存合并、KV/本地/内存回退、写入串行化 | DOM、玩家资料、AI 请求 |
| `ai-director.js` | 稳定提示签名、单次预算、缓存复用、输出校验、确定性 fallback | DOM、底层存储、自动调用 |
| `view.js` | 安全 DOM 渲染、主题、无障碍状态、操作卡片 | 平台调用、持久化 |
| `app.js` | 配置验证、生命周期、事件绑定、模块编排 | 底层平台协议、品牌硬编码 |

模块通过 `window.BlankGame` 的显式属性协作。除 `sdk-adapter.js` 外，任何发布脚本都不得直接访问 `window.dzmm`。除 `storage.js` 外，任何模块都不得访问 `localStorage`。

## 稳定契约

- `template.json` 必须保持 `id: blank-template`、`kind: starter`、`orientation: portrait`。
- `index.html` 的脚本顺序固定为 `config.js`、`content.js`、`sdk-adapter.js`、`storage.js`、`ai-director.js`、`view.js`、`app.js`，`app.js` 必须最后加载。
- 配置 ID 使用稳定 ASCII 值。三个示例 ID 固定为 `user`、`ai`、`storage`。
- 配置文字通过 `textContent` 渲染，不使用 `innerHTML`。
- 页面不能依赖远程脚本、样式、字体、图片或 CDN。
- 新增创作者文档、配置说明和代码注释使用中文；API、标识符、文件名和命令可以保留英文。

## AI 约束

AI 只能由玩家点击触发，页面启动与状态恢复不得自动调用。`ai-director.js` 必须保留页面内 `inFlight` 守卫，并用 Web Locks 或 `localStorage` 租约串行同源标签页；锁内必须重新读取缓存和预算，先持久化合法的确定性预算预留，确认至少进入同源本地存储或 KV 后才允许调用 AI。锁、租约或预留失败必须 fail closed，不能绕过协调继续请求。已连接 Gamefy 时，远端读取失败或远端记录损坏也不能按 miss 发起 AI，不能覆盖未知远端。不得通过定时器、动画帧、输入事件或渲染函数发起调用。

消息 `role` 只能是 `user` 或 `assistant`，不能使用 `system`。最终文本必须严格验证类型、Unicode、控制字符、换行、Markdown 围栏和字符数。任何 SDK 缺失、请求失败或无效输出都返回并缓存确定性 fallback，不自动重试配额、权限或内容安全错误。提示或校验语义变化时递增 `ai.cacheVersion`。

## 玩家资料与存储约束

玩家资料适配器只返回 `name` 和通过协议白名单校验的 `avatarUrl`。不得记录、渲染或保存 `token` 与玩家 ID。

存储对象必须含 `version` 和 ISO 格式 `updatedAt`。当前 v2 必须严格校验计数和 AI 记录，并只迁移结构完整的旧 v1 计数。合并时计数取最大值，AI 记录按提示签名做并集，同签名冲突按内存、本地、远端的顺序保留，禁止用一个旧远端整包替换新本地状态。写入先保留本地副本，再尝试 Gamefy KV；远端读取状态未知时不得盲写覆盖，两边都失败时使用内存状态。

## 启动与错误路径

主脚本尽早报告 `loading.progress({ phase: 'start' })`。完成配置、DOM 和事件绑定后报告 `runtime_initializing`，首个可交互画面进入动画帧后报告 `first_frame` 并调用 `loading.ready()`。不可恢复的启动错误必须同时调用 `loading.error()` 并渲染页面内错误状态。

无 SDK 不是启动错误。首屏必须立即可用，后台等待短时间后进入本地预览；SDK 稍后出现时可以补报 ready。

## 交付检查

从仓库根目录执行：

```sh
for file in templates/blank/publish/*.js; do node --check "$file"; done
git diff --check -- templates/blank
```

不要添加 test/spec 文件，不要修改 `templates/blank/**` 之外的文件，不要提交 commit。静态检查通过后仍要手动覆盖玩家资料成功与降级、AI 成功与无效输出、重复点击、KV 与本地回退、损坏存档、头像失败、移动端布局和启动错误。
