// Translation for bearing-steel literature.
//
// A generic translator produces fluent Chinese that quietly changes the
// metallurgy: "white etching area" becomes "白色腐蚀区", cleanliness becomes
// "清洁度", spalling becomes "碎裂". The fixes here are mechanical, not
// stylistic:
//
//   1. the glossary pins every domain term found in the source text,
//   2. tokens that must stay in Latin script (grades, symbols, standards,
//      units) are listed explicitly,
//   3. the output is checked against the pins afterwards, and one retry is
//      issued with the exact list of terms that went missing.
//
// Step 3 is what makes the accuracy claim testable: a translation that drops a
// pinned term is detected, reported and retried instead of silently shipped.

import {
  findTerms, requiredTerms, verifyTerms, protectedTokens, MISTRANSLATIONS, CATEGORIES,
} from './glossary.mjs'

/** Translation directions. `terms` never calls a model. */
export const TRANSLATE_MODES = { zh: '英译中', en: '中译英', terms: '术语速查' }
/** Register: readable prose vs. structure-preserving literal. */
export const TRANSLATE_STYLES = { readable: '通顺', literal: '直译对照' }

export const MAX_CHUNK_CHARS = 2600
export const MAX_TEXT_CHARS = 24_000
export const MAX_CHUNKS = 12
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096

/** Split long text on paragraph, then sentence, then hard boundaries. */
export function chunkText(text, maxChars = MAX_CHUNK_CHARS) {
  const source = String(text ?? '').replace(/\r\n/g, '\n').trim()
  if (source === '') return []
  if (source.length <= maxChars) return [source]

  const chunks = []
  let current = ''
  const push = () => {
    const value = current.trim()
    if (value !== '') chunks.push(value)
    current = ''
  }
  for (const paragraph of source.split(/\n{2,}/)) {
    if (paragraph.length > maxChars) {
      push()
      // Long paragraph: cut on sentence enders, then on any whitespace.
      let buffer = ''
      for (const sentence of paragraph.split(/(?<=[.!?。！？；;])\s+/)) {
        if ((buffer + sentence).length > maxChars && buffer !== '') {
          chunks.push(buffer.trim())
          buffer = ''
        }
        if (sentence.length > maxChars) {
          for (const piece of sentence.match(new RegExp(`[\\s\\S]{1,${maxChars}}`, 'g')) ?? []) chunks.push(piece.trim())
          continue
        }
        buffer += (buffer === '' ? '' : ' ') + sentence
      }
      if (buffer.trim() !== '') chunks.push(buffer.trim())
      continue
    }
    if ((current + '\n\n' + paragraph).length > maxChars) push()
    current += (current === '' ? '' : '\n\n') + paragraph
  }
  push()
  return chunks.filter((chunk) => chunk !== '')
}

/** The glossary lines shown to the model: one per pinned term. */
export function termTable(terms) {
  if (terms.length === 0) return '（本文未命中术语表条目，按该领域通用译法处理）'
  return terms
    .map((term) => {
      const abbr = term.abbr === undefined ? '' : `（${term.abbr}）`
      const note = term.note === undefined ? '' : `　※ ${term.note}`
      return `- ${term.en} = ${term.zh}${abbr}${note}`
    })
    .join('\n')
}

/** The "do not do this" block: the mistranslations this field keeps producing. */
export function mistakeTable(limit = 12) {
  return MISTRANSLATIONS.slice(0, limit)
    .map((item) => `- ${item.term}：写「${item.right}」，不要写「${item.wrong}」`)
    .join('\n')
}

/** Few-shot pairs: short, idiomatic, and loaded with pinned terms. */
const FEW_SHOT_TO_ZH = [
  {
    source: 'Subsurface-initiated rolling contact fatigue is triggered by non-metallic inclusions located near the depth of maximum shear stress.',
    target: '次表面起源的滚动接触疲劳，由位于最大剪应力深度附近的非金属夹杂物引发。',
  },
  {
    source: 'White etching areas form around inclusions and are associated with hydrogen trapping and high slide-to-roll ratios.',
    target: '白蚀区在夹杂物周围形成，与氢陷阱和高滑差率相关。',
  },
  {
    source: 'Electroslag remelting lowers the total oxygen content and improves steel cleanliness.',
    target: '电渣重熔降低总氧含量，提高钢的洁净度。',
  },
]

const FEW_SHOT_TO_EN = [
  {
    source: '残余奥氏体含量影响回火后的尺寸稳定性。',
    target: 'The retained austenite content affects dimensional stability after tempering.',
  },
  {
    source: '在双盘试验机上以 2.1 的威布尔斜率评定了 L10 寿命。',
    target: 'The L10 life was evaluated on a twin-disc rig with a Weibull slope of 2.1.',
  },
]

const RULES_COMMON = [
  '只输出译文本身：不要前言、不要解释、不要小标题、不要代码块围栏。',
  '不增不减信息：原文的限定条件（量级、条件、对比、不确定性）必须原样保留。',
  '术语必须使用「术语对照表」里的译法；表中没有的术语，采用本领域通用译法，全文保持一致。',
  '钢种牌号、标准号、公式符号、单位、公司名、期刊名一律保留原文写法（见「必须保留原文」清单）。',
  '句子读起来要像中文科技文献，不要逐词硬译；但不得为了通顺改变技术含义。',
].join('\n')

/**
 * Build one translation prompt.
 *
 * @param {object} options
 * @param {string} options.text source text (one chunk).
 * @param {'zh'|'en'} [options.mode] target language.
 * @param {'readable'|'literal'} [options.style]
 * @param {boolean} [options.bilingual] emit source + translation pairs.
 * @param {Array} [options.terms] pinned glossary entries (defaults to hits in `text`).
 * @param {Array} [options.missing] terms a previous attempt dropped (retry).
 * @param {string} [options.extra] extra instruction appended verbatim.
 */
export function buildTranslatePrompt(options = {}) {
  const { text, mode = 'zh', style = 'readable', bilingual = false } = options
  const terms = options.terms ?? requiredTerms(text, mode)
  const missing = Array.isArray(options.missing) ? options.missing : []
  const protectedHits = protectedTokens(text)
  const target = mode === 'en' ? '英文' : '中文'
  const sourceLabel = mode === 'en' ? '中文' : '英文'
  const fewShot = mode === 'en' ? FEW_SHOT_TO_EN : FEW_SHOT_TO_ZH
  const directionName = mode === 'en' ? '中译英' : '英译中'

  const sections = []
  sections.push(`你是轴承钢滚动接触疲劳（bearing steel rolling contact fatigue, RCF）方向的专业译者，长期为研究者翻译该领域的${sourceLabel}文献。现在做${directionName}，译文用于文献笔记，读者是该方向的研究者。`)

  sections.push(`## 翻译要求
${RULES_COMMON}
- 语体：${style === 'literal' ? '直译对照——尽量保留原文的句子结构、从句顺序和术语的全称，便于逐句核对' : '通顺——符合中文科技文献的表达习惯，允许调整句子结构'}${bilingual ? '\n- 输出格式：每段先照抄原文一行（以 “> ” 开头），紧接着给出译文；段与段之间空一行。' : ''}`)

  sections.push(`## 术语对照表（必须使用）
${termTable(terms)}`)

  sections.push(`## 高频误译（写右边，不要写左边）
${mistakeTable()}`)

  sections.push(`## 必须保留原文的写法
${protectedHits.length === 0 ? '（本文未检测到牌号/标准号/符号，但规则仍然适用）' : protectedHits.map((hit) => `- ${hit.value}　（${hit.reason}）`).join('\n')}`)

  const examples = fewShot.map((pair) => `${sourceLabel}：${pair.source}\n${target}：${pair.target}`).join('\n\n')
  sections.push(`## 参考译例\n${examples}`)

  if (missing.length > 0) {
    sections.push(`## 上一次翻译的问题（必须修正）
下面这些术语在上一版译文中没有按对照表出现，请重新翻译并确保每一个都用到：
${missing.map((term) => `- ${term.en} = ${term.zh}`).join('\n')}`)
  }

  if (typeof options.extra === 'string' && options.extra.trim() !== '') {
    sections.push(`## 额外要求\n${options.extra.trim()}`)
  }

  sections.push(`## 待翻译的${sourceLabel}
"""
${text}
"""

现在只输出${target}译文。`)

  return sections.join('\n\n')
}

/**
 * Translate one chunk with post-verification and a single corrective retry.
 *
 * @param {object} options
 * @param {string} options.text one chunk
 * @param {'zh'|'en'} options.mode
 * @param {(prompt:string) => Promise<string>} options.call model caller
 * @param {object} [rest] forwarded to buildTranslatePrompt.
 * @returns {Promise<{text:string, terms:Array, retried:boolean, missing:Array, attempts:number}>}
 */
export async function translateChunk({ text, mode, call, ...rest }) {
  const terms = rest.terms ?? requiredTerms(text, mode)
  const first = await call(buildTranslatePrompt({ ...rest, text, mode, terms }))
  let verified = verifyTerms(first, terms, mode)
  let output = first
  let attempts = 1
  let retried = false
  if (!verified.ok) {
    retried = true
    attempts = 2
    const second = await call(buildTranslatePrompt({ ...rest, text, mode, terms, missing: verified.missing }))
    const secondVerified = verifyTerms(second, terms, mode)
    // Keep whichever attempt satisfies more pins (an empty answer never wins).
    if (second.trim() !== '' && secondVerified.missing.length <= verified.missing.length) {
      output = second
      verified = secondVerified
    }
  }
  return { text: output, terms, retried, missing: verified.missing, attempts }
}

/** Compact term list for the HTTP response and the UI chips. */
export function summarizeTerms(terms) {
  return terms.map((term) => ({
    en: term.en,
    zh: term.zh,
    ...(term.abbr === undefined ? {} : { abbr: term.abbr }),
    category: term.category,
    ...(term.note === undefined ? {} : { note: term.note }),
  }))
}

/** Local, offline term lookup (`mode: 'terms'`). */
export function describeTerms(text, { limit = 60 } = {}) {
  return {
    terms: summarizeTerms(findTerms(text, { limit })),
    protectedTokens: protectedTokens(text),
    categories: CATEGORIES,
  }
}
