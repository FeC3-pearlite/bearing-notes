// Seed one example note (with a real model review) into the plugin's data
// directory and compile the Word knowledge base, so the installed plugin has
// immediate content to show.
import { NoteStore } from './lib/store.mjs'

const REVIEW = `### 1. 准确性审阅

- **“GCr15 的碳化物以 M7C3 为主”——不准确。** GCr15（≈100Cr6 ≈ SAE 52100）的碳化物主体是 **M3C（渗碳体）型**，M7C3 仅在偏析区、高温奥氏体化或特定冶炼/热处理条件下少量出现，不能称“为主”。正确表述：*GCr15 的碳化物以 M3C 为主，可能含少量 M7C3；真正影响寿命的是其尺寸、分布（网状、带状）而非“以 M7C3 为主”。*
- **“硬度越高接触疲劳寿命越长”——不准确（且属该领域高频错误）。** 硬度只是多变量之一，寿命还受残余奥氏体含量、碳化物形态与尺寸、夹杂物、残余应力、Λ 值与污染度支配；硬度提升常伴随韧性下降与尺寸稳定性变差，因此不存在单调关系。正确表述：*在给定材料与工艺窗口内，硬度提高通常有利于抗滚动接触疲劳，但需与残余奥氏体、碳化物均匀性和韧性协同，不能作为单一结论。*
- **其余表述未发现明显问题。**

### 2. 遗漏与风险

- **缺少标准与版本限定**：提及 GCr15 成分/牌号时未标注标准号与版本（GB/T 18254、ISO 683-17、SAE 52100），也未说明成分是范围而非单值。
- **缺少“接触疲劳”的限定前提**：未说明寿命指标是 L10 还是 L50、是否含滑差率（SRR）、Λ 值与润滑状态；纯滚动与有滑差的失效机制不同。
- **缺少硬度–寿命结论的对照与量级**：没有给出硬度区间、残余奥氏体含量、剥落深度或 Weibull 斜率等对照信息。
- **示例文本本身是风险源**：作为流程演示，读者易把示例中的错误结论当成知识留存。

### 3. 相关知识延伸

- **碳化物类型判定的实际意义**：M3C/M7C3 的区分关系到奥氏体化温度与回火工艺选择，而网状碳化物、带状偏析和液析碳化物的危害机制各不相同。
- **硬度之外的主导变量**：残余奥氏体 5–15% 影响尺寸稳定性与应力重分布，夹杂物（刚性氧化物 > 塑性硫化物）决定次表面起源剥落。
- **寿命指标的统计本质**：L10 是 10% 失效概率对应的寿命，与平均寿命、最小寿命不同，必须与 Weibull 斜率一起报告。
- **寿命修正的框架**：ISO 281 的 a_iso 综合润滑、污染与疲劳载荷极限，不能用来支撑单一硬度结论。
- **加速试验的外推边界**：实验室小样本结果不能直接外推到实际工况，失效模式可能从表面起源切换到次表面起源。

### 4. 建议追读

- **ISO 15243**《Rolling bearings — Damage and failures — Terms, characteristics and causes》：给出表面起源与次表面起源剥落的官方分类与术语。
- **GB/T 18254**（请核对现行版本号）与 **ISO 4967 / GB/T 10561**：前者规定 GCr15 成分范围与碳化物/偏析评级要求，后者给出 A/B/C/D/DS 夹杂物评级方法。
- **建议检索关键词**：“M3C vs M7C3 carbide in 100Cr6 / GCr15”、“carbide network banding bearing steel fatigue”、“hardness versus rolling contact fatigue life non-monotonic”；建议期刊 *Wear*、*International Journal of Fatigue*、*Tribology International*、*Acta Materialia*。`

const BODY = `这条是插件的示例笔记，用来演示「记录 → 审阅 → 汇总到 Word」的完整流程。确认插件工作正常后可以直接删掉这条。

**工作流程**

1. 点会话标题栏的 📓 按钮打开「文献知识库」标签页（也可以用右侧栏的 ＋ 新建标签菜单，选「文献知识库」）。
2. 填「文献来源」和「标签」，把读到的内容写进「笔记正文」（支持 Markdown）。
3. 点 **审阅并提示** —— 模型会按四节给出反馈：准确性审阅、遗漏与风险、相关知识延伸、建议追读。
4. 点 **保存到 Word** —— 笔记连同屏幕上的审阅一起追加进统一的 Word 文档。
5. 已保存的笔记在下方列表里点开，可以 **重新审阅** 并 **写入 Word 并保存**。

**正文里故意留了两个错误**，用来验证审阅是否真的有效：

- GCr15 的碳化物以 M7C3 为主。
- 硬度越高接触疲劳寿命越长。

下面「知识审阅与延伸」一节就是模型对这两条的实际反馈 —— 两条都被判为「不准确」并给出了正确表述。`

const dir = process.argv[2]
const store = new NoteStore({ dir })
if (store.notes.length > 0) {
  console.log('store already has ' + store.notes.length + ' note(s); not seeding')
  console.log('docx=' + store.docxPath)
  process.exit(0)
}

const added = store.add({
  title: '工作流程说明（示例笔记，可删除）',
  body: BODY,
  source: '',
  tags: ['使用说明', '示例'],
})
store.setReview(added.note.id, REVIEW)
const final = store.compile()
console.log('seeded note ' + added.note.id)
console.log('total=' + store.notes.length)
console.log('docx=' + final)
