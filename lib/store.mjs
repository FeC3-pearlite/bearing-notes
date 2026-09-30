// Durable note store: an append-only JSONL source of truth plus a single
// regenerated Word document for reading.
//
// Layout under the store directory:
//   notes.jsonl      one JSON record per note (append-only, crash-safe)
//   index.json       lightweight cache: id -> {title, tags, createdAt}
//   <name>.docx      the compiled Word knowledge base
import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { buildDocx, markdownToParagraphs, run, para } from './docx.mjs'

const SEP = '─'.repeat(38)

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export class NoteStore {
  /**
   * @param {object} opts
   * @param {string} opts.dir      directory holding notes.jsonl and the .docx
   * @param {string} [opts.file]   docx file name
   * @param {string} [opts.title]  document title
   */
  constructor({ dir, file = '轴承钢滚动接触疲劳-文献知识库.docx', title = '轴承钢滚动接触疲劳 · 文献知识库' } = {}) {
    if (!dir) throw new Error('NoteStore requires a directory')
    this.dir = dir
    this.docxPath = join(dir, file)
    this.jsonlPath = join(dir, 'notes.jsonl')
    this.indexPath = join(dir, 'index.json')
    this.title = title
    mkdirSync(dir, { recursive: true })
    this.notes = this.#load()
  }

  #load() {
    if (!existsSync(this.jsonlPath)) return []
    const out = []
    for (const line of readFileSync(this.jsonlPath, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t) continue
      try { out.push(JSON.parse(t)) } catch { /* skip a torn final line */ }
    }
    return out
  }

  nextId() {
    let max = 0
    for (const n of this.notes) {
      const m = /^N-(\d+)$/.exec(n.id ?? '')
      if (m) max = Math.max(max, Number(m[1]))
    }
    return 'N-' + String(max + 1).padStart(4, '0')
  }

  /**
   * Append a note and recompile the Word document.
   * @returns {{note: object, docx: string, total: number}}
   */
  add({ title, body, tags = [], source = '', review = '', id = null, createdAt = null }) {
    if (!body || !String(body).trim()) throw new Error('note body must not be empty')
    const note = {
      id: id || this.nextId(),
      title: (title && String(title).trim()) || firstLine(body),
      body: String(body).trim(),
      tags: normalizeTags(tags),
      source: String(source || '').trim(),
      review: String(review || '').trim(),
      createdAt: createdAt || nowIso(),
    }
    appendFileSync(this.jsonlPath, JSON.stringify(note) + '\n', 'utf8')
    this.notes.push(note)
    this.#writeIndex()
    const docx = this.compile()
    return { note, docx, total: this.notes.length }
  }

  /** Attach or replace the review text of an existing note. */
  setReview(id, review) {
    const note = this.notes.find((n) => n.id === id)
    if (!note) throw new Error('no such note: ' + id)
    note.review = String(review || '').trim()
    note.reviewedAt = nowIso()
    this.#rewriteAll()
    const docx = this.compile()
    return { note, docx, total: this.notes.length }
  }

  get(id) { return this.notes.find((n) => n.id === id) ?? null }

  /** Notes whose body/title/source matches a case-insensitive substring. */
  search(query) {
    const q = String(query || '').toLowerCase()
    if (!q) return this.notes
    return this.notes.filter((n) =>
      [n.title, n.body, n.source, (n.tags || []).join(' '), n.review].join('\n').toLowerCase().includes(q))
  }

  tags() {
    const counts = new Map()
    for (const n of this.notes) for (const t of n.tags || []) counts.set(t, (counts.get(t) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }))
  }

  #rewriteAll() {
    const tmp = this.jsonlPath + '.tmp'
    writeFileSync(tmp, this.notes.map((n) => JSON.stringify(n)).join('\n') + '\n', 'utf8')
    renameSync(tmp, this.jsonlPath)
    this.#writeIndex()
  }

  #writeIndex() {
    const index = this.notes.map((n) => ({ id: n.id, title: n.title, tags: n.tags, createdAt: n.createdAt }))
    writeFileSync(this.indexPath, JSON.stringify({ title: this.title, updatedAt: nowIso(), count: index.length, notes: index }, null, 2), 'utf8')
  }

  /** Rebuild the whole Word document from the note list. */
  compile() {
    const body = []
    body.push(para(run(this.title, { bold: true, size: 36 }), { style: 'Title' }))
    body.push(para(run(`共 ${this.notes.length} 条笔记　·　更新于 ${nowIso()}`, { size: 18, color: '666666' }),
      { align: 'center', spacingAfter: 240 }))

    if (this.notes.length) {
      body.push(para(run('目录', { bold: true, size: 26 }), { style: 'Heading1', spacingBefore: 200 }))
      for (const n of this.notes) {
        body.push(para(run(`${n.id}　${n.title}`, { size: 21 }), { indent: 360, spacingAfter: 20 }))
      }
    }

    for (const n of this.notes) {
      body.push(para(run(`${n.id}　${n.title}`, { bold: true, size: 28 }), { style: 'Heading1', spacingBefore: 360 }))
      const meta = []
      if (n.source) meta.push(`来源：${n.source}`)
      if (n.tags?.length) meta.push(`标签：${n.tags.join(' / ')}`)
      meta.push(`记录时间：${n.createdAt}`)
      body.push(para(run(meta.join('　|　'), { size: 18, color: '595959' }), { spacingAfter: 140 }))

      body.push(para(run('笔记正文', { bold: true, size: 24 }), { style: 'Heading2', spacingBefore: 120 }))
      body.push(markdownToParagraphs(n.body))

      if (n.review) {
        body.push(para(run('知识审阅与延伸', { bold: true, size: 24 }), { style: 'Heading2', spacingBefore: 160 }))
        body.push(markdownToParagraphs(n.review))
      }
      body.push(para(run(SEP, { size: 16, color: 'BFBFBF' }), { align: 'center', spacingBefore: 200, spacingAfter: 220 }))
    }

    const buf = buildDocx(body.join(''), { title: this.title })
    writeFileSync(this.docxPath, buf)
    return this.docxPath
  }
}

function firstLine(s) {
  const line = String(s).split('\n').find((l) => l.trim()) ?? '未命名笔记'
  return line.replace(/[#*`>]/g, '').trim().slice(0, 80) || '未命名笔记'
}

function normalizeTags(tags) {
  const list = Array.isArray(tags) ? tags : String(tags || '').split(/[,，;；\s]+/)
  const seen = new Set()
  const out = []
  for (const raw of list) {
    const t = String(raw).trim()
    if (t && !seen.has(t)) { seen.add(t); out.push(t) }
  }
  return out
}
