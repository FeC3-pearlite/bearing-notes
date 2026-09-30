import { writeFileSync } from 'node:fs'
import { buildDocx, markdownToParagraphs, readDocxBody, markdownToParagraphs as md2p, run, para } from './lib/docx.mjs'

// A realistic note set in the target domain, exercising headings, bullets,
// bold/italic/code, Chinese text, and multi-paragraph reviews.
const notes = [
  {
    id: 'N-0001',
    title: 'GCr15 与 100Cr6 的成分对应关系',
    tags: ['材料', '成分'],
    source: 'Bhadeshia, Prog. Mater. Sci. 57 (2012) 268',
    createdAt: '2026-02-11T09:12:00Z',
    body: [
      '**GCr15**（GB/T 18254）与 **100Cr6 / SAE 52100** 基本对应，属高碳铬轴承钢。',
      '典型成分：C 0.95–1.10 wt%，Cr 1.30–1.65 wt%，Si 0.15–0.35 wt%，Mn 0.20–0.40 wt%。',
      '`C` 含量上限受限于 **共晶碳化物** 的析出，过高会形成粗大网状碳化物。',
    ].join('\n\n'),
    review: [
      '## 审阅结论',
      '整体判断正确。需要补充两点：',
      '- **Cr 的下限** 通常写作 1.40 wt%（而非 1.30），1.30 多见于旧版标准；引用时请注明标准版本号。',
      '- 应当说明 **碳化物类型**：GCr15 中主要是 M3C（渗碳体）型，并含少量 M7C3；Cr 提高会促进 M7C3 形成。',
      '## 相关知识',
      '- **共晶碳化物** 与 **液析碳化物** 的区别：前者由凝固偏析形成，后者由液相直接析出，前者可通过高温扩散退火改善。',
      '- 相关标准：ISO 683-17、ASTM A295、GB/T 18254。',
    ].join('\n'),
  },
  {
    id: 'N-0002',
    title: '滚动接触疲劳的失效模式分类',
    tags: ['RCF', '失效分析'],
    source: 'Sadeghi et al., Wear 255 (2003) 1241',
    createdAt: '2026-02-11T09:40:00Z',
    body: '轴承钢的滚动接触疲劳（RCF）失效可分为 **表面起源** 与 **次表面起源** 两类。次表面起源由最大剪应力处的 **夹杂物** 触发。',
    review: [
      '## 审阅结论',
      '方向正确，但表述过于简化，建议补充：',
      '- 如果钢中 **氧化物夹杂**（尤其 Al2O3、钙铝酸盐）尺寸较小且分布弥散，**氢** 的作用可能成为主导。',
      '## 相关知识',
      '- **白蚀区（WEA）／白蚀带（WEB）** 与氢脆的关联。',
      '- **ISO 281** 寿命修正中的 a_iso 系数。',
    ].join('\n'),
  },
]

const sections = []
sections.push(para(run('轴承钢滚动接触疲劳 · 文献知识库', { bold: true, size: 36 }), { style: 'Title' }))
sections.push(para(run(`共 ${notes.length} 条笔记 · 生成于 ${new Date().toISOString()}`, { size: 18, color: '666666' }), { align: 'center', spacingAfter: 240 }))
sections.push(para(run('目录', { bold: true, size: 26 }), { style: 'Heading1', spacingBefore: 200 }))
for (const n of notes) {
  sections.push(para(run(`${n.id}　${n.title}`, { size: 21 }), { indent: 360, spacingAfter: 20 }))
}
for (const n of notes) {
  sections.push(para(run(`${n.id}　${n.title}`, { bold: true, size: 28 }), { style: 'Heading1', spacingBefore: 320 }))
  sections.push(para(run(`来源：${n.source}`, { size: 19, color: '555555' }), { spacingAfter: 20 }))
  sections.push(para(run(`标签：${n.tags.join(' / ')}　记录时间：${n.createdAt}`, { size: 19, color: '555555' }), { spacingAfter: 120 }))
  sections.push(para(run('笔记正文', { bold: true, size: 24 }), { style: 'Heading2', spacingBefore: 120 }))
  sections.push(markdownToParagraphs(n.body))
  sections.push(para(run('知识审阅与延伸', { bold: true, size: 24 }), { style: 'Heading2', spacingBefore: 160 }))
  sections.push(markdownToParagraphs(n.review))
  sections.push(para(run('—' .repeat(30), { size: 16, color: 'AAAAAA' }), { align: 'center', spacingBefore: 200, spacingAfter: 200 }))
}

const buf = buildDocx(sections.join(''), { title: '轴承钢滚动接触疲劳 · 文献知识库' })
writeFileSync(process.argv[2] || 'notes-test.docx', buf)

// Round-trip: read the body back out of the package we just wrote.
const body = readDocxBody(buf)
console.log('docxBytes=' + buf.length)
console.log('bodyLength=' + body.length)
console.log('hasTitle=' + body.includes('轴承钢滚动接触疲劳'))
console.log('hasNote1=' + body.includes('N-0001'))
console.log('hasCjk=' + body.includes('共晶碳化物'))
console.log('paragraphCount=' + (body.match(/<w:p>/g) || []).length)
