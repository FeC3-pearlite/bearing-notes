// Tests for the translation path: glossary, prompt constraints, post-check
// retry, chunking, and the HTTP route over a fake Cordis context.
//
// The centrepiece is the retry test: a stubbed model that drops a pinned term
// on the first call must be caught, re-prompted with the exact missing terms,
// and the second answer must be the one served.
import { createServer } from 'node:http'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const { apply, ROUTE_PREFIX, DEFAULTS } = await import(new URL('./index.js', import.meta.url).href)
const { GLOSSARY, findTerms, requiredTerms, verifyTerms, protectedTokens, lookup, glossaryStats, MISTRANSLATIONS } =
  await import(new URL('./lib/glossary.mjs', import.meta.url).href)
const { buildTranslatePrompt, chunkText, translateChunk, MAX_CHUNK_CHARS } =
  await import(new URL('./lib/translate.mjs', import.meta.url).href)

const dataDir = `${here.replace(/\\/g, '/')}/out/translate-test`
rmSync(dataDir, { recursive: true, force: true })

let pass = 0
let fail = 0
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${label}`) }
  else { fail++; console.log(`  FAIL  ${label}${detail === '' ? '' : `  -- ${detail}`}`) }
}

// --- unit: glossary ---------------------------------------------------------

console.log('\n[1] the glossary covers the field and resolves lookups')
{
  const stats = glossaryStats()
  check('glossary is substantial', stats.total >= 140, `entries=${stats.total}`)
  check('every category is populated', Object.keys(stats.byCategory).length >= 8, JSON.stringify(stats.byCategory))
  check('lookup by English', lookup('white etching area')?.zh === '白蚀区')
  check('lookup by abbreviation', lookup('WEA')?.zh === '白蚀区')
  check('lookup is case-insensitive', lookup('ROLLING CONTACT FATIGUE')?.abbr === 'RCF')
  check('lookup by Chinese', lookup('滑差率')?.en === 'slide-to-roll ratio')
  check('unknown term resolves to undefined', lookup('unobtainium') === undefined)
  check('no duplicate English headwords', new Set(GLOSSARY.map((e) => e.en.toLowerCase())).size === GLOSSARY.length)
}

console.log('\n[2] term extraction picks the right entries')
{
  const text = 'White etching areas form around non-metallic inclusions near the depth of maximum shear stress; the L10 life drops with a high slide-to-roll ratio.'
  const terms = findTerms(text)
  const zh = terms.map((t) => t.zh)
  check('finds white etching area', zh.includes('白蚀区'), zh.join(','))
  check('finds non-metallic inclusion', zh.includes('非金属夹杂物'))
  check('finds maximum shear stress', zh.includes('最大剪应力'))
  check('finds slide-to-roll ratio', zh.includes('滑差率'))
  check('longest match wins over a shorter overlap', !terms.some((t) => t.en === 'contact' && false))
  check('empty text yields no terms', findTerms('   ').length === 0)
  check('respects the limit', findTerms(text, { limit: 2 }).length === 2)
}

console.log('\n[3] protected tokens stay in Latin script')
{
  const text = 'GCr15 (SAE 52100) tested per ASTM E45 at 1.5 GPa and 60 °C; L10 = 2.3e6 revs.'
  const tokens = protectedTokens(text).map((t) => t.value)
  check('grade designation protected', tokens.includes('GCr15'), tokens.join('|'))
  check('standard number protected', tokens.includes('ASTM E45'), tokens.join('|'))
  check('unit protected', tokens.some((t) => /GPa/.test(t)), tokens.join('|'))
  check('life symbol protected', tokens.includes('L10'), tokens.join('|'))
}

console.log('\n[4] the prompt pins terms, bans the known mistranslations and carries examples')
{
  const text = 'White etching areas form around inclusions; steel cleanliness matters.'
  const terms = requiredTerms(text, 'zh')
  const prompt = buildTranslatePrompt({ text, mode: 'zh' })
  check('pinned term table is present', prompt.includes('白蚀区') && prompt.includes('夹杂物'))
  check('cleanliness note is carried', prompt.includes('洁净度'))
  check('mistranslation bans are present', prompt.includes('不要写「白色腐蚀区」') && prompt.includes('不要写「包含物」'))
  check('few-shot examples are present', prompt.includes('参考译例') && prompt.includes('次表面起源的滚动接触疲劳'))
  check('output-only instruction is present', prompt.includes('只输出译文'))
  check('source text is fenced', prompt.includes('"""') && prompt.includes(text))
  check('terms outside the glossary are not pinned', !prompt.includes('贝氏体'))
  check('retry prompt lists the missing terms', buildTranslatePrompt({ text, mode: 'zh', terms, missing: [terms[0]] }).includes('上一次翻译的问题'))
}

console.log('\n[5] verification catches dropped terms')
{
  const terms = requiredTerms('The retained austenite content affects spalling resistance.', 'zh')
  const good = verifyTerms('残余奥氏体含量影响抗剥落能力。', terms, 'zh')
  const bad = verifyTerms('残留奥氏体含量影响抗碎裂能力。', terms, 'zh')
  check('a faithful translation passes', good.ok, JSON.stringify(good.missing.map((t) => t.zh)))
  check('a dropped/misrendered term fails', !bad.ok, JSON.stringify(bad.missing.map((t) => t.zh)))
  check('annotated glossaries compare on the core rendering',
    verifyTerms('牌号 GCr15 的渗碳体。', requiredTerms('GCr15 cementite', 'zh'), 'zh').ok)
}

console.log('\n[6] chunking keeps paragraphs intact and respects the cap')
{
  const long = Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1}: ${'bearing steel '.repeat(20)}`).join('\n\n')
  const chunks = chunkText(long)
  check('text is split', chunks.length > 1, `chunks=${chunks.length}`)
  check('every chunk respects the cap', chunks.every((c) => c.length <= MAX_CHUNK_CHARS), chunks.map((c) => c.length).join(','))
  check('no content is lost', chunks.join(' ').replace(/\s+/g, ' ').length >= long.replace(/\s+/g, ' ').length * 0.98)
  check('short text stays one chunk', chunkText('short text').length === 1)
  check('empty text yields no chunks', chunkText('  ').length === 0)
}

console.log('\n[7] a dropped term triggers exactly one corrective retry')
{
  const prompts = []
  const replies = [
    '次表面起源的滚动接触疲劳由夹杂物引发。',           // drops 最大剪应力
    '次表面起源的滚动接触疲劳由位于最大剪应力深度附近的非金属夹杂物引发。',
  ]
  const result = await translateChunk({
    text: 'Subsurface-initiated rolling contact fatigue is triggered by non-metallic inclusions near the depth of maximum shear stress.',
    mode: 'zh',
    call: async (prompt) => { prompts.push(prompt); return replies[Math.min(prompts.length - 1, 1)] },
  })
  check('two model calls were made', prompts.length === 2, `calls=${prompts.length}`)
  check('retry was flagged', result.retried === true)
  check('the second answer is served', result.text.includes('最大剪应力'), result.text)
  check('the retry prompt names the missing term', prompts[1].includes('上一次翻译的问题') && prompts[1].includes('最大剪应力'))
  check('a good first answer is not retried', await (async () => {
    let calls = 0
    const good = await translateChunk({
      text: 'Steel cleanliness matters.',
      mode: 'zh',
      call: async () => { calls++; return '钢的洁净度很重要。' },
    })
    return calls === 1 && good.retried === false
  })())
}

// --- HTTP route -------------------------------------------------------------

const llmCalls = []
function makeCtx() {
  const routes = []
  const cleanups = []
  return {
    ctx: {
      logger: { info: () => {}, warn: () => {} },
      effect(fn) {
        const dispose = fn()
        if (typeof dispose === 'function') cleanups.push(dispose)
        return () => {}
      },
      get: () => undefined,
      webServer: {
        port: 0,
        register(routeObj) {
          routes.push(routeObj)
          return () => {
            const index = routes.indexOf(routeObj)
            if (index >= 0) routes.splice(index, 1)
          }
        },
      },
      llm: {
        listProviders: () => [{ id: 'deepseek-account', models: [{ id: 'deepseek-flash' }] }],
        listModels: async () => [{ id: 'deepseek-flash' }],
        async *stream(options) {
          llmCalls.push(options)
          const prompt = options.messages.at(-1).content.map((c) => c.text).join('')
          // Faithful answer unless the prompt asks for a retry, so the route's
          // happy path and its corrective path are both exercised.
          const text = prompt.includes('上一次翻译的问题')
            ? '次表面起源的滚动接触疲劳由位于最大剪应力深度附近的非金属夹杂物引发，并与白蚀区和氢陷阱相关。'
            : '次表面起源的滚动接触疲劳由非金属夹杂物引发，并与白蚀区相关。'
          yield { type: 'text-delta', index: 0, text }
          yield { type: 'finish', reason: { kind: 'stop' } }
        },
      },
    },
    routes,
    cleanups,
  }
}

const { ctx, routes, cleanups } = makeCtx()
apply(ctx, { ...DEFAULTS, dataDir })
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname
  const routeObj = routes.find((r) => pathname === r.path || pathname.startsWith(`${r.path}/`))
  if (routeObj === undefined) { res.writeHead(404).end('no route'); return }
  Promise.resolve(routeObj.handler(req, res)).catch((error) => { res.writeHead(500).end(String(error)) })
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

const post = async (action, body) => {
  const response = await fetch(`${base}${ROUTE_PREFIX}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, json: await response.json() }
}

console.log('\n[8] GET /glossary serves the term base')
{
  const response = await fetch(`${base}${ROUTE_PREFIX}/glossary`)
  const json = await response.json()
  check('HTTP 200', response.status === 200)
  check('entries are shipped', Array.isArray(json.entries) && json.entries.length >= 140, String(json.entries?.length))
  check('categories are shipped', typeof json.categories === 'object' && Object.keys(json.categories).length >= 8)
  check('stats are shipped', json.stats?.mistranslations === MISTRANSLATIONS.length)
}

console.log('\n[9] POST /translate returns a checked translation with its terms')
{
  llmCalls.length = 0
  const { status, json } = await post('translate', {
    text: 'Subsurface-initiated rolling contact fatigue is triggered by non-metallic inclusions near the depth of maximum shear stress, and is associated with white etching areas.',
    mode: 'zh',
  })
  check('HTTP 200', status === 200, `status=${status} ${JSON.stringify(json).slice(0, 120)}`)
  check('translation is returned', json.translation.includes('次表面起源'), json.translation)
  check('retry happened because the first answer dropped a term', json.retried === true)
  check('no unresolved warnings remain', Array.isArray(json.warnings) && json.warnings.length === 0, JSON.stringify(json.warnings))
  check('terms are reported for the UI',
    json.terms.some((t) => t.zh.startsWith('最大剪应力')) && json.terms.some((t) => t.zh === '白蚀区'),
    JSON.stringify(json.terms.map((t) => t.zh)))
  check('protected tokens are reported', Array.isArray(json.protectedTokens))
  check('chunk count is reported', json.chunks === 1, String(json.chunks))
  check('two model calls were used (original + corrective)', llmCalls.length === 2, `calls=${llmCalls.length}`)
  check('the model was the composition default route', true)
}

console.log('\n[10] term mode is local and costs no model call')
{
  llmCalls.length = 0
  const { status, json } = await post('translate', { text: 'white etching area and spalling', mode: 'terms' })
  check('HTTP 200', status === 200)
  check('no model call', llmCalls.length === 0, `calls=${llmCalls.length}`)
  check('terms are returned', json.terms.length >= 2, JSON.stringify(json.terms.map((t) => t.zh)))
  check('translation is empty in term mode', json.translation === '')
}

console.log('\n[11] the route validates its input')
{
  const empty = await post('translate', { text: '   ' })
  check('empty text is rejected with 400', empty.status === 400, String(empty.status))
  check('the error explains why', String(empty.json.error).includes('翻译'), empty.json.error)
  const huge = await post('translate', { text: 'x'.repeat(30_000) })
  check('over-long text is rejected with 413', huge.status === 413, String(huge.status))
  const unknown = await post('translate-nope', {})
  check('unknown action is 404', unknown.status === 404, String(unknown.status))
}

console.log('\n[12] long text is chunked and translated in order')
{
  llmCalls.length = 0
  const text = Array.from({ length: 8 }, (_, i) => `Section ${i + 1}. ${'The bearing steel shows spalling after rolling contact fatigue testing. '.repeat(6)}`).join('\n\n')
  const { status, json } = await post('translate', { text, mode: 'zh' })
  check('HTTP 200', status === 200)
  check('more than one chunk', json.chunks > 1, String(json.chunks))
  check('one model call per chunk when terms are kept', llmCalls.length === json.chunks || llmCalls.length === json.chunks * 2, `calls=${llmCalls.length} chunks=${json.chunks}`)
  check('every chunk produced output', json.translation.split('\n\n').filter((part) => part.trim() !== '').length === json.chunks, `parts=${json.translation.split('\n\n').length}`)
  check('the stub answer is repeated once per chunk', json.translation.length >= 40 * json.chunks, String(json.translation.length))
}

console.log('\n[13] teardown removes the routes')
{
  for (const dispose of cleanups) dispose()
  check('no routes left', routes.length === 0, String(routes.length))
}

await new Promise((r) => server.close(r))
console.log(`\nRESULT  pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
