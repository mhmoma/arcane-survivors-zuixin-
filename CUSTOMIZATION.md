# 空白起点定制指南

大多数作品只需要修改 `publish/config.js` 和 `publish/style.css`，不必改动平台适配层。建议先复制模板目录，再按“内容、主题、玩法、平台契约”的顺序逐步修改，每一步都同时检查普通浏览器和 Game Studio Preview。

`publish/content.js` 是 `config.js` 中 `copy` 的只读投影，用于以后替换整套内容包。普通文案仍以 `config.js` 为唯一编辑入口；如果改成独立内容文件，必须继续提供 `actions`、`user`、`ai` 和 `storage` 四个稳定表面，并同步更新配置校验。

## 修改品牌与文案

`config.js` 的 `brand` 控制页面标题、品牌眉题和名称；`copy` 控制首屏、操作卡片、加载状态、成功状态、降级状态、错误提示和页脚。动态文案中的 `{name}` 与 `{count}` 是稳定占位符，修改文字时必须保留。

操作卡片的 `id` 固定为 `user`、`ai` 和 `storage`。显示名称可以修改，稳定 ID 不应随翻译或品牌变化。`sdkLabelParts` 只负责拼出技术标签，不会发起平台调用。

## 修改主题

`theme.colorScheme` 支持 `light` 或 `dark`。`theme.tokens` 会映射到 `style.css` 中的 CSS 变量，可修改页面、卡片、舞台、强调色、状态色、阴影和圆角。

主题值必须是短小的 CSS token，不能包含 `url()`、花括号、分号或 HTML 字符。修改后检查正文对比度、键盘焦点、禁用状态、成功色和警告色，不能只检查强调色。

## 使用功能开关

`features.userProfile`、`features.aiText` 和 `features.kvCounter` 控制三个示例是否显示。`showAvatar` 控制玩家头像，`showSdkLabels` 控制卡片上的 API 标签，`sdkStatus` 控制连接状态。

关闭功能只会移除入口，不会改变模块加载顺序。若彻底删除某项能力，还要同步清理 `copy.actions`、`app.js` 中的处理器和相关文档，并重新运行完整检查。

## 修改 AI 行为

`ai.prompt` 必须保留 `{playerName}`，消息角色由适配器固定为 `user`。`maxTokens` 必须在 200 到 3000 之间；输出最小和最大字符数决定最终校验边界。`cacheVersion` 是创作者控制的稳定版本，修改 AI 语义、校验规则或希望主动废弃旧结果时应递增。

提示签名由 `cacheVersion`、模型、预算、校验边界、替换玩家称呼后的实际提示词和备用文案共同计算。相同签名只会使用一条缓存记录；玩家称呼或上述配置变化会形成新签名和新的单次预算。同源标签页通过 Web Locks 或 `localStorage` 租约串行，并在锁内重新检查缓存、写入确定性预算预留后才允许调用 AI。锁、租约或预留失败时必须直接降级，不能绕过协调继续请求。`fallbacks` 至少保留一条符合输出长度的中文备用文案，选择过程只使用稳定散列，不使用 `Date.now()` 或 `Math.random()`。不要在启动、计时器、渲染函数或输入事件中调用 AI。

## 修改存储

`storage.key` 必须非空且不超过 256 个字符。当前 schema 版本为 2，状态保存 `version`、`updatedAt`、`demos.kvClicks` 和带提示签名的 `ai.records`；`aiCacheLimit` 控制最多保留多少条签名记录。旧 v1 计数会迁移为空 AI 缓存的 v2 状态。

存档不是按整包时间戳二选一：计数取所有有效来源中的最大值，AI 缓存按签名合并，同签名时新本地或内存结果不会被旧远端覆盖。新增字段时仍应提升 schema 并提供明确迁移，不能放宽为接受任意额外字段。

不要持久化头像、玩家 ID、`token`、函数、DOM、Blob、File、data URL 或完整 SDK 响应。写入失败必须继续保留可玩的本地或内存路径。

## 添加本地资源

模板当前不需要 `assets`。如果作品加入图片、字体、音频或 JSON，请放入 `publish/assets/`，使用 ASCII 文件名和相对路径，不要引用 CDN 或远程字体。`publish/` 总大小不得超过 8 MiB，单个栅格图片不得超过 1.5 MiB。

加入首屏资源后，应在启动流程中报告 `resource_loading`，并在首个可见、可交互画面完成后再调用 `loading.ready()`。

## 定制后检查

- 三个开关分别开启和关闭时，操作区都能正确布局。
- 无 SDK 时玩家资料、AI 与 KV 都能结束加载状态。
- AI 快速重复点击和两个同源标签页同时点击都最多产生一个请求；同签名再次点击和刷新后点击复用最终记录或预算预留。
- 旧 v1 计数能迁移，旧远端较小计数或缺少 AI 记录时不会覆盖新本地状态。
- 损坏的 KV 和 `localStorage` 数据不会导致白屏。
- 头像失败会自动隐藏，所有配置文字都通过 `textContent` 渲染。
- 360px 宽视口无溢出，键盘焦点清晰可见。
