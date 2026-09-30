import { rmSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NoteStore } from './lib/store.mjs'
import { buildReviewPrompt } from './lib/domain.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dir = process.argv[2] || join(here, 'out', 'store')
rmSync(dir, { recursive: true, force: true })

const store = new NoteStore({ dir })
console.log('empty store notes=' + store.notes.length + ' nextId=' + store.nextId())

const a = store.add({
  title: 'GCr15 与 100Cr6 的对应关系',
  body: '**GCr15**（GB/T 18254）与 **100Cr6 / SAE 52100** 基本对应。\n\n典型成分：C 0.95–1.10 wt%，Cr 1.30–1.65 wt%。',
  tags: ['材料', '成分'],
  source: 'Bhadeshia, Prog. Mater. Sci. 57 (2012) 268',
})
console.log('added=' + a.note.id + ' total=' + a.total + ' docx=' + existsSync(a.docx))

const b = store.add({
  body: '次表面起源的 RCF 由最大剪应力处的夹杂物触发。',
  tags: 'RCF 失效分析',
  source: 'Sadeghi et al., Wear 255 (2003) 1241',
})
console.log('added=' + b.note.id + ' autoTitle=' + JSON.stringify(b.note.title) + ' tags=' + JSON.stringify(b.note.tags))

const c = store.add({ title: '白蚀区与氢', body: 'WEA 常与氢相关。', tags: ['WEA', '氢'] })
console.log('added=' + c.note.id + ' total=' + c.total)

store.setReview(b.note.id, '## 审阅结论\n方向正确，但需补充氢的作用。\n\n## 相关知识\n- 白蚀区（WEA）')
console.log('setReview=' + (store.get(b.note.id).review.includes('WEA')))

console.log('tags=' + JSON.stringify(store.tags()))
console.log('search(夹杂物)=' + store.search('夹杂物').map((n) => n.id).join(','))
console.log('search(不存在的词)=' + store.search('zzz').length)

// Reload from disk to prove durability.
const store2 = new NoteStore({ dir })
console.log('reloaded notes=' + store2.notes.length + ' nextId=' + store2.nextId())
console.log('reviewPersisted=' + store2.get(b.note.id).review.includes('WEA'))

// Prompt sanity.
const prompt = buildReviewPrompt(store2.get(a.note.id), { existing: store2.notes.map((n) => ({ id: n.id, title: n.title })) })
console.log('promptLength=' + prompt.length)
for (const marker of ['### 1. 准确性审阅', '### 2. 遗漏与风险', '### 3. 相关知识延伸', '### 4. 建议追读', 'GCr15', '白蚀区', 'N-0001']) {
  console.log((prompt.includes(marker) ? 'PROMPT-HAS  ' : 'PROMPT-LACK ') + marker)
}
console.log('docxPath=' + store2.docxPath)
