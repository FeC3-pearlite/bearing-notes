# bearing-notes · 文献知识库插件

给 DeepSeek Harness（dsh）写的文献笔记插件：
读文献时随手记下对自己有用的知识，
所有笔记统一汇总到**一个 Word 文档**里随时调阅；右侧栏会调用模型**审阅笔记写得对不对**，
并**提示相关知识**。

为「轴承钢滚动接触疲劳」这个方向做的，但领域知识包（概念地图、高频错误清单、审阅提示词）
就是 `lib/domain.mjs` 一个文件，换成别的方向只改它。

- 插件包名：`@local/bearing-notes`
- Host 半注册路由：`/bearing-notes`
- 数据落地：`notes.jsonl`（追加式真相）+ `index.json` + 编译出的 `.docx`

## 功能

1. **随手记**：标题 / 文献来源 / 标签 / 正文（Markdown），正文为空不允许保存。
2. **审阅并提示**：把草稿交给模型，按四节返回反馈——准确性审阅（逐条判断
   正确 / 不准确 / 存疑并给出正确表述）、遗漏与风险、相关知识延伸、建议追读。
   提示词里内置了该领域的概念地图和常见错误清单（比如 GCr15 的碳化物类型、
   把 L10 寿命当整体寿命之类），所以审阅不是泛泛而谈。
3. **汇总到 Word**：笔记连同屏幕上的审阅追加进同一个 Word 文档；已保存的笔记可以
   点开重新审阅，再写回 Word。
4. **入口**：会话标题栏的一个按钮，或右侧栏 `+` 新建标签菜单里的「文献知识库」。

数据落地方式是「JSONL 是唯一真相」：逐条追加，崩溃也不会丢；Word 每次改动后
由 JSONL 重新编译，所以 Word 永远可以从源头重建。

## 组成

| 文件 | 作用 |
|---|---|
| `index.js` | Host 半：注册 `/bearing-notes` 路由、读写笔记、编译 Word、调用模型审阅 |
| `lib/client.js` | 浏览器半：右侧栏标签页（`sidebar.right.pane.tab`）+ 会话标题栏入口按钮 |
| `lib/docx.mjs` | 零依赖 .docx（WordprocessingML）生成与读取 |
| `lib/store.mjs` | 笔记存储：`notes.jsonl` 追加式真相 + `index.json` + 编译 Word |
| `lib/domain.mjs` | 领域知识包：概念地图、高频错误清单、审阅提示词 |
| `cordis.patch.yml` | 把插件行插入 profile 的 loader 补丁 |

Host 半和浏览器半都是手写 JS，没有构建步骤：客户端 bundle 直接由 dsh 从
`lib/client.js` 读取并以 `/plugins/??<包名>/client.js&rev=<rev>` 提供给浏览器。

## 安装到 dsh

插件是标准的 dsh bundle：`package.json` 声明 `dsh.bundle.patch` 和 `dsh.client`，
补丁往 profile 的 loader 树里插一行。**推荐**用官方工具装（需要完全权限会话）：

```
plugin_manager { action: "install_bundle", target: "<本仓库绝对路径>" }
```

装完 dsh 会把它作为 bundle 层登记进 profile 的 `package.json`，并把包按 `files`
白名单复制到 `<profile>/node_modules/@local/bearing-notes`。

手工等价安装（工具不可用时）：在 profile 的 `package.json` 里加
`"@local/bearing-notes": "file:<本仓库绝对路径>"` 依赖与同名 bundle 层，然后
`pnpm install`。无论哪种方式，**运行时读的都是 profile 里那份副本，不是这个工作目录**。

改完代码同步副本：

```bash
node sync-install.mjs <profileDir>      # 也可以只跑 node sync-install.mjs，读 $DSH_PROFILE_DIR
```

**重要：改 Host 半（`index.js` / `lib/*.mjs`）之后必须重启 dsh。**
客户端 bundle 会热更新，Host 模块不会——ESM 按 URL 缓存，同一路径不会重新导入。

## 配置

在 loader 行的 `config` 里覆盖（`sync-install.mjs` 与 `cordis.patch.yml` 里都能改）：
```yaml
- id: bearing-notes
  name: '@local/bearing-notes'
  config:
    dataDir: '<数据目录>'                                  # 默认按作者机器设置，换机器请改
    docxFile: '轴承钢滚动接触疲劳-文献知识库.docx'
    docxTitle: '轴承钢滚动接触疲劳 · 文献知识库'
    provider: ''          # 留空 = 先用本组合的默认模型路由
    model: ''             # 留空 = 跟随该路由的 model
    maxOutputTokens: 4096 # 调用时作为 maxTokens
```

审阅调用的 provider/model 按这个顺序解析：`config` 里显式的 provider+model →
本组合的默认模型路由（`agentDefaultModel.currentSelection()`，也就是你日常会话在用的那个）→
第一个已注册 provider 的第一个模型。用 `ctx.get()` 读默认路由，所以组合里没有这个服务也能加载。

## 翻译（术语约束）

`lib/glossary.mjs` 是本项目对「专有名词译准」这件事的全部机械化手段：

- **术语库锁定**：文中命中的术语逐条写进提示词（`rolling contact fatigue = 滚动接触疲劳（RCF）`），
  长词优先、允许嵌套（`depth of maximum shear stress` 与 `maximum shear stress` 会同时钉住）。
- **高频误译禁令**：`white etching area` 写「白蚀区」不要写「白色腐蚀区」、`cleanliness` 写「洁净度」
  不要写「清洁度」、`spalling` 写「剥落」不要写「碎裂」、`shakedown` 写「安定」不要写「抖松」等 19 条。
- **禁译清单**：牌号 / 标准号 / 符号 / 单位保留原文（正则匹配后写进提示词，也在响应里返回）。
- **译后核对 + 一次重译**：`verifyTerms()` 检查钉住的术语是否真的出现在译文里；
  漏了就带着缺失清单重译一次，两次都不达标时选漏得少的那版并把警告返回给调用方。

路由：

```
GET  /bearing-notes/glossary    # 术语库（214 条 + 类别 + 统计），不需要模型
POST /bearing-notes/translate   # { text, mode: 'zh'|'en'|'terms', style, bilingual, extra }
                                # → { translation, terms, protectedTokens, chunks, retried, warnings }
```

`mode: 'terms'` 是纯本地术语速查（不调用模型，断网可用）。长文按段落/句末自动分段，逐段翻译后拼接。

## 写 dsh 插件踩过的两个坑

这两个坑的共同点是：**插件看起来装好了（客户端 bundle 能取到、测试全绿），
但 Host 半从未激活，路由一直 404。**

1. **`inject` 只能是数组或「服务名 → 配置」映射。** 写成
   `export const inject = { optional: ['webServer', 'llm'] }` 等于声明依赖一个名叫
   `optional` 的服务——它永远不出现，插件就永远躺着不动。正确写法是
   `export const inject = ['webServer', 'llm']`；想可选就在 `apply` 里用
   `ctx.inject([...], cb)` 自己等。
2. **`Config` 必须是 Standard Schema 校验器。** Loader 会调用
   `Config['~standard'].validate(config)`，把一个普通默认值对象导出成 `Config`
   会直接 `TypeError`，插件同样不激活。本插件手写了一个最小的
   `~standard`（填默认值 + 校验字段类型），不需要任何依赖。

顺带两条容易写错的 dsh API：模型流事件是 `{ type: 'text-delta', text }` …
`{ type: 'finish', reason: { kind } }`（不是 `kind`/`finish`），输出上限字段是
`maxTokens`（不是 `maxOutputTokens`），且 `ctx.llm.stream()` 必须给**确切 model**；
客户端往 `single` 座位（如 `conversation.session.header.corner`，已被自带按钮占用）
注册第二个组件会抛错，入口按钮要用 `conversation.session.header.utilities` 这类 `list` 座位。

第 4 个坑不那么显眼：**「第一个已注册的 provider」不等于「你会话在用的 provider」**。
本机同时注册了 `deepseek-official`（没配 API key）和 `deepseek-account`（账号登录在用），
按注册顺序取第一个，审阅会直接失败在 `MISSING_CREDENTIAL`。跟随组合默认路由
（`ctx.get('agentDefaultModel').currentSelection()`）才是对的——`ctx.get()` 不需要
`inject`，所以组合里没有这个服务时插件照样能加载。

## 测试

```bash
node test-docx.mjs       # Word 生成 + 回读
node test-store.mjs      # 笔记存储 + 持久化
node test-host.mjs       # Host 半：真实 HTTP 52 项断言
node test-client.mjs     # 浏览器半：注册契约 57 项断言
node test-cordis.mjs     # 用 dsh 自带的 Cordis 真实挂载：激活 + 注入 + 流协议（24 项）
node test-translate.mjs  # 术语库 + 提示词约束 + 译后重译 + 翻译路由（67 项）
```

`test-cordis.mjs` 会从已安装 dsh 的 `app.asar` 里取出它实际使用的 Cordis 运行时
（`DSH_ASAR` 环境变量可覆盖路径），用真实运行时挂载本插件，覆盖 `test-host.mjs`
看不到的声明形状问题，并把上面两个坑都留成回归断言。

`test-translate.mjs` 里最关键的一条是**重译**：桩模型第一次故意漏掉被钉住的术语，
断言插件确实发现缺失、第二次提示词里带上缺失清单、并把第二次结果返回给调用方。

## 已知限制

- Word 只用了 WordprocessingML 的最小集（标题 / 正文 / 项目符号 / 加粗 / 斜体 / 等宽），
  没有表格、图片、目录域（目录是手写的段落列表，不含页码）。
- 术语库是人工整理的 214 条，覆盖常用术语；没进库的新词按模型通用译法处理。
- 译后核对只验证「钉住的术语有没有出现」，不判断译文整体忠实度。
- 审阅质量取决于所配模型。
- 侧栏渲染效果没有做浏览器内的自动化视觉验证。

## License

MIT
