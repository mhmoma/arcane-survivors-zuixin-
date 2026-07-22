# Gamefy 空白起点

这是一个竖屏优先、无框架、无远程依赖的最小 Gamefy 创作起点。它保留了三个可以直接点击的示例：读取玩家资料、由玩家明确触发一次 AI 文本生成、通过 KV 保存点击次数。普通浏览器中没有 Gamefy SDK 时，页面仍会进入可交互的本地预览。

## 模板特点

- 品牌、界面文案、主题 token 和功能开关集中在 `publish/config.js`。
- 所有平台调用只经过 `publish/sdk-adapter.js`，其他模块不直接访问 `window.dzmm`。
- AI 请求只由玩家点击触发；当前页面用 `inFlight` 合并重复点击，同源标签页优先用 Web Locks、缺失时用 `localStorage` 租约串行，同一提示签名最多只有一个标签页进入调用流程。
- AI 返回文本必须通过类型、字符、换行和长度校验；AI 不可用、请求失败或输出无效时，会按稳定签名选择确定性备用文案并缓存该结果。
- 存档 schema v2 包含 `version`、`updatedAt`、单调计数和 AI 缓存记录；读取时严格校验并兼容迁移旧 v1 计数。
- 合并存档时计数取最大值，AI 记录按提示签名做并集；同签名冲突时内存和本地记录优先于旧远端，避免远端整包回写抹掉新本地进度。
- 玩家资料只向页面返回昵称和安全头像地址，`token` 与玩家 ID 不会显示、记录或持久化。

## 目录结构

```text
blank/
├── template.json
├── README.md
├── CUSTOMIZATION.md
├── AGENTS.md
└── publish/
    ├── index.html
    ├── config.js
    ├── content.js
    ├── sdk-adapter.js
    ├── storage.js
    ├── ai-director.js
    ├── view.js
    ├── app.js
    └── style.css
```

`content.js` 把 `config.js` 中的内容文案投影成可替换的只读内容包，不复制平台逻辑。`index.html` 按上面的模块顺序加载脚本，`app.js` 始终最后加载并只负责启动、事件绑定和模块编排。

## 预览方式

直接打开 `publish/index.html` 可以检查本地预览、主题、功能开关、确定性 AI 备用文案和本地计数。要验证真实能力，请在 Game Studio Preview 中分别点击玩家资料、AI 文本和 KV 示例。

AI 示例不会在页面启动时自动调用，也不会自动重试付费请求。首次显式点击会在跨标签页锁内重新读取缓存和预算；未命中时先写入合法的确定性预算预留，确认预留已进入同源本地存储或 Gamefy KV 后才调用 AI。通过校验的 AI 文本会覆盖预留，调用失败时预留本身就是可复用的确定性结果，因此本次运行、其他同源标签页和刷新后的重复点击都不会再次计费。KV 写入使用 `{ flush: true }`，但只发生在玩家明确触发 AI 或计数里程碑时。

已连接 Gamefy 时，如果远端缓存读取失败或已有远端记录损坏，模板会 fail closed 并直接显示内存中的确定性备用文案，不把未知状态当作 miss，也不会覆盖该远端记录或继续调用 AI。普通离线预览不涉及远端付费状态，仍会把备用文案保存在本地。

同源标签页由 Web Locks 或带到期时间的 `localStorage` 租约协调；锁不可用、租约无法写入或等待超时时直接显示确定性备用文案，不调用 AI。Gamefy KV 尚无跨设备原子“读取后占位”事务，因此不同设备同时首次点击仍可能各写入一条预留；这是当前无法在浏览器模板内消除的边界。若预算预留既不能写入本地存储也不能写入 KV，当前点击同样 fail closed，不发出付费请求。

## 发布前检查

从仓库根目录运行：

```sh
for file in templates/blank/publish/*.js; do node --check "$file"; done
git diff --check -- templates/blank
```

还应手动检查 360px 宽移动视口、桌面视口、无 SDK、本地存储不可用、AI 无效输出、连续快速点击和头像加载失败等路径。
