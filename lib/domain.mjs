// Domain pack: bearing steel & rolling contact fatigue (RCF).
//
// This is the "expert knowledge" the review sidecar grounds on: a concept map,
// the errors that most often appear in literature notes, standard designations,
// and the prompt that turns a raw note into structured feedback.
//
// Sources behind the checklist (for provenance, not automated retrieval):
//   GB/T 18254, ISO 683-17, ASTM A295, ISO 281, ISO 15243
//   Bhadeshia, Prog. Mater. Sci. 57 (2012) 268 — steels for bearings
//   Sadeghi et al., Wear 255 (2003) 1241 — RCF review
//   Bhadeshia, Prog. Mater. Sci. 57 (2012) 268; Gegner, Int. Mater. Rev. 56 (2011) 273 (WEA)

export const DOMAIN = {
  name: '轴承钢滚动接触疲劳',
  english: 'Bearing steel rolling contact fatigue (RCF)',
  keyJournals: ['Wear', 'Tribology International', 'International Journal of Fatigue', 'Acta Materialia', 'Tribology Letters', 'International Materials Reviews', 'Materials Science and Engineering: A', 'ISIJ International'],
  keyStandards: [
    { id: 'GB/T 18254', about: '高碳铬轴承钢（GCr15 等）的分类与技术要求' },
    { id: 'GB/T 34891', about: '滚动轴承 高碳铬轴承钢 零件 热处理技术条件' },
    { id: 'ISO 683-17', about: 'Heat-treatable steels, alloy steels and free-cutting steels — 轴承钢' },
    { id: 'ASTM A295', about: 'High-carbon anti-friction bearing steel' },
    { id: 'ISO 281', about: '滚动轴承 额定动载荷与额定寿命（L10、a_iso 修正）' },
    { id: 'ISO 15243', about: '滚动轴承 损伤与失效 术语与特征' },
    { id: 'ISO 4967 / GB/T 10561', about: '钢中非金属夹杂物含量的测定（A/B/C/D/DS 评级）' },
  ],
}

// Concept map: term -> what a correct note should connect it to.
export const CONCEPTS = [
  { term: '接触应力场', points: ['Hertz 接触', '最大剪应力位于次表面（约 0.5–0.8 倍接触半宽）', '正交剪应力 τyz 与棘轮效应', '残余应力与安定（shakedown）'] },
  { term: '失效模式', points: ['表面起源（点蚀、微点蚀）与次表面起源（剥落）', 'ISO 15243 分类', '早期失效 vs 疲劳失效', '剥落坑深度与最大剪应力深度的对应'] },
  { term: '次表面起源', points: ['夹杂物 / 碳化物 / 孔洞处的应力集中', '“蝴蝶”组织（butterfly）围绕夹杂物', '夹杂物尺寸、类型、距表面深度的影响', '夹杂物与基体弹性模量差引起的局部应力集中'] },
  { term: '夹杂物', points: ['类型：A 硫化物、B 氧化铝、C 硅酸盐、D 球状氧化物、DS 单颗粒', '危害排序：刚性氧化物（Al2O3、钙铝酸盐、TiN）> 塑性硫化物', '评级方法 ISO 4967 / GB/T 10561', '冶炼路线：电渣重熔（ESR）、真空脱气（VD/VIM）'] },
  { term: '白蚀区 WEA/WEB', points: ['White Etching Area / White Etching Band', '纳米晶 + 碳过饱和的淬火马氏体，硬度高于基体', '常与氢、滑差、瞬态高载荷相关', '暗蚀区（DEA）为回火软化区', '与氢脆、失效加速的因果关系仍有争议'] },
  { term: '氢', points: ['氢致 RCF 寿命下降，尤其在高滑差/润滑不足时', '氢陷阱：夹杂物界面、位错、碳化物', '氢含量通常以 ppm 计（1–3 ppm 即可显著影响）'] },
  { term: '材料与热处理', points: ['GCr15 ≈ 100Cr6 ≈ SAE 52100', '马氏体淬火+低温回火 / 贝氏体等温淬火', '残余奥氏体含量（通常 5–15%）与尺寸稳定性', '渗碳钢（如 20CrMnTi、M50NiL）用于高韧性场合', '高温轴承钢 M50、M50NiL、CSS-42L'] },
  { term: '碳化物', points: ['GCr15 主要为 M3C（渗碳体）型，含少量 M7C3', '网状碳化物、带状碳化物偏析的危害', '共晶碳化物与液析碳化物的区别', '固溶温度与碳化物溶解的平衡'] },
  { term: '润滑与表面', points: ['弹流润滑（EHL）膜厚比 Λ', '润滑不足 → 表面起源失效', '边界润滑添加剂（AW/EP）与摩擦化学膜', '表面粗糙度、研磨/抛光、喷丸强化'] },
  { term: '寿命与评定', points: ['L10 / L50 寿命、Weibull 斜率', 'ISO 281 修正寿命 a_iso（润滑、污染、疲劳载荷极限）', '加速试验：三球/四球、推力片、双辊试验机', '统计必要性与样本量（Weibull 需要足够失效数）'] },
  { term: '试验方法', points: ['双辊（two-roll）试验机可控滑差率', '推力轴承式试验机（如 NTN/NSK 型）', '三点/四点弯曲疲劳与 RCF 的区别', '滑差率（slide-to-roll ratio, SRR）的定义与量级'] },
  { term: '表征手段', points: ['SEM/EDS、EBSD 观察组织与取向', 'XRD 测残余应力与残余奥氏体', 'TEM 观察 WEA 纳米晶', '超声/磁粉检测剥落与裂纹'] },
]

// High-frequency mistakes seen in literature notes.
export const PITFALLS = [
  '把“接触疲劳”与“弯曲/扭转疲劳”的寿命概念混用（S-N 曲线不能直接搬用）。',
  '把 L10 寿命当作“平均寿命”或“最小寿命”。',
  '忽略滑差率（SRR）：纯滚动与有滑差的失效机制不同，结论不可互推。',
  '把夹杂物尺寸的影响写成线性关系（实际与尺寸、类型、深度、基体硬度耦合）。',
  '把 WEA 的出现直接等同于“氢致失效”，忽略滑差与瞬态载荷的贡献（因果关系仍有争议）。',
  '混淆最大剪应力深度与剥落坑深度（二者相关但不相等，且受残余应力影响）。',
  '混淆共晶碳化物与液析碳化物，或把网状碳化物当成一次碳化物。',
  '把 GCr15 的成分范围写成单一数值，或漏标标准版本号。',
  '用“硬度越高寿命越长”作结论，忽略韧性、残余奥氏体与尺寸稳定性。',
  '把实验室小样本加速试验的寿命直接外推到工况（缺 a_iso 修正与污染度考量）。',
  '把贝氏体淬火与马氏体淬火的优劣写成绝对结论（取决于工况与尺寸）。',
  '把 ISO 281 的 a_iso 系数说成“材料系数”（它综合润滑、污染、载荷极限）。',
]

export function conceptDigest(limit = CONCEPTS.length) {
  return CONCEPTS.slice(0, limit).map((c) => `- ${c.term}：${c.points.join('；')}`).join('\n')
}

/**
 * Build the review prompt for one note.
 * @param {{title?:string, body:string, source?:string, tags?:string[]}} note
 * @param {{existing?: Array<{id:string,title:string}>, extraFocus?: string}} [ctx]
 */
export function buildReviewPrompt(note, ctx = {}) {
  const existing = (ctx.existing ?? []).slice(-40)
  const existingList = existing.length
    ? existing.map((n) => `- ${n.id}　${n.title}`).join('\n')
    : '（知识库目前为空）'

  return `你是轴承钢滚动接触疲劳（bearing steel rolling contact fatigue, RCF）方向的资深研究者，正在帮一位研究者审阅他读文献时记下的笔记。

## 这位研究者的领域背景
${DOMAIN.name}（${DOMAIN.english}）
主要标准：${DOMAIN.keyStandards.map((s) => s.id).join('、')}
主要期刊：${DOMAIN.keyJournals.join('、')}

## 该领域的概念地图（用于判断笔记是否自洽与完整）
${conceptDigest()}

## 该领域笔记中高频出现的错误（请重点核对）
${PITFALLS.map((p, i) => `${i + 1}. ${p}`).join('\n')}

## 他已有的笔记标题（避免重复推荐，并指出可关联之处）
${existingList}
${ctx.extraFocus ? `\n## 本次额外关注点\n${ctx.extraFocus}\n` : ''}
## 待审阅的笔记
标题：${note.title || '（未命名）'}
${note.source ? `来源：${note.source}` : '来源：（未填写）'}
${note.tags?.length ? `标签：${note.tags.join(' / ')}` : ''}
正文：
"""
${note.body}
"""

## 输出要求
严格按下面四节输出，用 Markdown，全部用中文。不要复述笔记原文。

### 1. 准确性审阅
逐条判断笔记中的事实性陈述：**正确**、**不准确** 或 **存疑**。对每一条给出：结论、理由、以及正确的表述（如果写错了）。没有问题的条目不必展开，但要明确写出“其余表述未发现明显问题”。不要为了凑数而制造问题；如果笔记本身正确，就直接说正确。

### 2. 遗漏与风险
指出这条笔记缺少哪些关键限定条件、前提、量级或对照，会让读者产生误解的地方。

### 3. 相关知识延伸
给出 3–6 条与这条笔记直接相关的知识点，每条一句话说明“关联在哪里”，优先给出他笔记里还没有的概念（参考上面的已有笔记标题）。

### 4. 建议追读
给出 1–3 篇/部最值得追的文献或标准（作者+期刊+年份，或标准号），并说明为什么与这条笔记相关。只推荐你确有把握的文献；如果不确定具体文献，就给出“应检索的关键词 + 建议期刊”，不要编造文献信息。`
}

/** The prompt used when the panel is asked for a focused second opinion. */
export function buildFollowUpPrompt(note, question) {
  return `你在协助一位研究轴承钢滚动接触疲劳（RCF）的研究者。下面是他的笔记：

标题：${note.title || '（未命名）'}
${note.source ? `来源：${note.source}` : ''}
正文：
"""
${note.body}
"""

他追问：${question}

请直接回答这个追问，用中文，Markdown 格式。回答要具体、可核查：给出机制、量级或标准依据。如果这个问题在文献中存在争议，明确说明争议点。不要编造文献信息，不确定时说明不确定。`
}

/** Compact domain context appended for the agent when it reviews a note. */
export function domainBrief() {
  return `${DOMAIN.name}：关键标准 ${DOMAIN.keyStandards.map((s) => s.id).join('、')}；核心概念 ${CONCEPTS.map((c) => c.term).join('、')}。`
}
