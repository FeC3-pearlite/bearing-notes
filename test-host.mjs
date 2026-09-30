// Integration test for the bearing-notes Host half.
//
// Boots the plugin against a minimal fake Cordis context (real http.Server,
// stubbed llm), then drives the HTTP API exactly as the browser panel does.
import { createServer } from 'node:http'
import { rmSync, existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const { apply, ROUTE_PREFIX, DEFAULTS, Config, inject } = await import(new URL('./index.js', import.meta.url).href)

const dataDir = here.replace(/\\/g, '/') + '/out/host-test'
rmSync(dataDir, { recursive: true, force: true })

let pass = 0, fail = 0
function check(label, ok, detail = '') {
  if (ok) { pass++; console.log('  PASS  ' + label) }
  else { fail++; console.log('  FAIL  ' + label + (detail ? '  -- ' + detail : '')) }
}

// --- dependency declaration ------------------------------------------------
// Cordis `inject` is an array of service names (or a name → config map); a
// `{ optional: [...] }` object declares a service literally called "optional"
// and leaves the plugin permanently inactive, registering no route at all.
console.log('\n[0] the Host half declares the services and config schema Cordis resolves')
{
  check('inject is an array', Array.isArray(inject), JSON.stringify(inject))
  check('inject requires webServer', Array.isArray(inject) && inject.includes('webServer'), JSON.stringify(inject))
  check('inject requires llm', Array.isArray(inject) && inject.includes('llm'), JSON.stringify(inject))
  check('inject declares no "optional" service', !(inject && !Array.isArray(inject) && 'optional' in inject), JSON.stringify(inject))
  // The Loader resolves config through Standard Schema; a plain object throws.
  check('Config exposes a Standard Schema validator', typeof Config?.['~standard']?.validate === 'function', JSON.stringify(Object.keys(Config ?? {})))
  const filled = Config?.['~standard']?.validate({ dataDir: 'X:/tmp' })
  check('validator fills defaults', filled?.value?.docxFile === DEFAULTS.docxFile && filled?.value?.dataDir === 'X:/tmp', JSON.stringify(filled?.value))
  const rejected = Config?.['~standard']?.validate({ maxOutputTokens: -1 })
  check('validator reports a bad field', Array.isArray(rejected?.issues) && rejected.issues.length === 1, JSON.stringify(rejected))
}

// --- fake Cordis context ----------------------------------------------------
const routes = []
const cleanups = []
let llmCalls = 0

const ctx = {
  logger: { info: () => {}, warn: (...a) => console.log('  [host warn]', ...a) },
  effect(fn, label) {
    const dispose = fn()
    if (typeof dispose === 'function') cleanups.push(dispose)
    return () => {}
  },
  // Read without an inject dependency, exactly like Cordis `ctx.get(name)`.
  get(name) {
    if (name !== 'agentDefaultModel') return undefined
    return { currentSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }) }
  },
  webServer: {
    port: 0,
    register(route) {
      if (routes.some((r) => r.kind === route.kind && r.path === route.path)) {
        throw new Error('duplicate route ' + route.path)
      }
      routes.push(route)
      return () => {
        const i = routes.indexOf(route)
        if (i >= 0) routes.splice(i, 1)
      }
    },
  },
  llm: {
    // Real LlmRuntime shape: listProviders() returns provider metadata objects.
    // `deepseek-official` is registered first but carries no credential; the
    // call must follow the composition's default route instead of the registry
    // order.
    listProviders: () => [
      { id: 'deepseek-official', name: 'DeepSeek API', models: [{ id: 'deepseek-chat' }] },
      { id: 'deepseek-account', name: 'DeepSeek', models: [{ id: 'deepseek-flash' }] },
    ],
    listModels: async () => [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }],
    // Emits the real StreamChunk protocol: typed chunks, terminal `finish`.
    async *stream(options) {
      llmCalls++
      lastCall = options
      const userText = options.messages.at(-1).content.map((c) => c.text).join('')
      lastPrompt = userText
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: '### 1. 准确性审阅\n**不准确**：GCr15 的碳化物以 M3C 为主。\n' }
      yield { type: 'text-delta', index: 0, text: '### 3. 相关知识延伸\n- 白蚀区（WEA）与氢陷阱。\n' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: '' } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  },
}
let lastPrompt = ''
let lastCall = null

apply(ctx, { ...DEFAULTS, dataDir })

// --- serve the registered routes the way the webserver does -----------------
function match(pathname) {
  const exact = routes.find((r) => r.kind === 'exact' && r.path === pathname)
  if (exact) return exact
  let best
  for (const r of routes) {
    if (r.kind !== 'prefix') continue
    if (pathname === r.path || pathname.startsWith(r.path + '/')) {
      if (!best || r.path.length > best.path.length) best = r
    }
  }
  return best
}

const server = createServer((req, res) => {
  const route = match(new URL(req.url, 'http://x').pathname)
  if (!route) {
    console.log('  [route miss] ' + req.method + ' ' + req.url + '  routes=' + JSON.stringify(routes.map((r) => r.kind + ':' + r.path)))
    res.writeHead(404).end('no route')
    return
  }
  Promise.resolve(route.handler(req, res)).catch((err) => {
    console.log('  [handler threw] ' + err?.stack)
    res.writeHead(500).end(String(err))
  })
})

await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`
console.log('server at ' + base + ', routes=' + routes.map((r) => r.kind + ':' + r.path).join(', '))

async function call(method, action, body) {
  const path = action === undefined || action === '' ? ROUTE_PREFIX
    : ROUTE_PREFIX + (action.startsWith('?') ? action : '/' + action.replace(/^\/+/, ''))
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let json = null
  try { json = await res.json() } catch { /* ignore */ }
  return { status: res.status, json }
}

console.log('\n[1] GET state on an empty store')
{
  const { status, json } = await call('GET')
  check('HTTP 200', status === 200, 'got ' + status)
  check('ok=true', json?.ok === true)
  check('total=0', json?.total === 0, 'got ' + json?.total)
  check('docxPath under dataDir', String(json?.docxPath).startsWith(dataDir.replace(/\//g, '\\')) || String(json?.docxPath).includes('host-test'), json?.docxPath)
  check('domain name reported', json?.domain?.name === '轴承钢滚动接触疲劳', json?.domain?.name)
  check('concepts present', Array.isArray(json?.domain?.concepts) && json.domain.concepts.length >= 10, String(json?.domain?.concepts?.length))
}

console.log('\n[2] POST a note; the Word document must appear')
let firstId
{
  const { status, json } = await call('POST', 'notes', {
    title: 'GCr15 的碳化物与滚动接触疲劳',
    body: 'GCr15 中的碳化物主要是 M7C3 型，尺寸越大越容易成为裂纹源。',
    source: 'Bhadeshia, Prog. Mater. Sci. 57 (2012) 268',
    tags: ['材料', '碳化物'],
  })
  check('HTTP 200', status === 200, 'got ' + status)
  check('id assigned', json?.id === 'N-0001', json?.id)
  firstId = json?.id
  check('total=1', json?.total === 1, 'got ' + json?.total)
  check('docx exists on disk', existsSync(json?.docxPath), json?.docxPath)
  const buf = readFileSync(json.docxPath)
  check('docx is a ZIP (PK)', buf[0] === 0x50 && buf[1] === 0x4b)
  check('docx contains the body text', buf.includes(Buffer.from('M7C3', 'utf8')))
}

console.log('\n[3] POST an empty note is rejected')
{
  const { status, json } = await call('POST', 'notes', { body: '   ' })
  check('HTTP 400', status === 400, 'got ' + status)
  check('error explains why', String(json?.error).includes('正文'), json?.error)
}

console.log('\n[4] POST review (draft, no id) -> stubbed model output assembled')
{
  const { status, json } = await call('POST', 'review', {
    title: '草稿', body: '轴承钢的接触疲劳寿命由硬度决定。', tags: ['RCF'],
  })
  check('HTTP 200', status === 200, 'got ' + status)
  check('review assembled from deltas', String(json?.review).includes('M3C'), json?.review?.slice(0, 40))
  check('review has section headers', String(json?.review).includes('### 3. 相关知识延伸'))
  check('llm was called once', llmCalls === 1, 'calls=' + llmCalls)
  check('call follows the composition default, not registry order',
    lastCall?.provider === 'deepseek-account' && lastCall?.model === 'deepseek-flash',
    JSON.stringify({ provider: lastCall?.provider, model: lastCall?.model }))
  check('call caps output with maxTokens', lastCall?.maxTokens === DEFAULTS.maxOutputTokens, String(lastCall?.maxTokens))
  check('call sends one request-only user message', Array.isArray(lastCall?.messages) && lastCall.messages.length === 1 && lastCall.messages[0].role === 'user',
    JSON.stringify(lastCall?.messages?.map((m) => m.role)))
  check('prompt carries the domain concept map', lastPrompt.includes('白蚀区') && lastPrompt.includes('概念地图'))
  check('prompt carries the pitfall checklist', lastPrompt.includes('把 L10 寿命当作'))
  check('prompt carries the note body', lastPrompt.includes('由硬度决定'))
}

console.log('\n[5] POST review with id -> note lookup + existing-note list in prompt')
{
  const { status, json } = await call('POST', 'review', { id: firstId })
  check('HTTP 200', status === 200, 'got ' + status)
  check('review returned', typeof json?.review === 'string' && json.review.length > 0)
  check('prompt lists existing notes', lastPrompt.includes('N-0001'))
  check('prompt includes the stored body', lastPrompt.includes('M7C3'))
}

console.log('\n[6] POST review for a missing id -> 404')
{
  const { status, json } = await call('POST', 'review', { id: 'N-9999' })
  check('HTTP 404', status === 404, 'got ' + status)
  check('error names the id', String(json?.error).includes('N-9999'), json?.error)
}

console.log('\n[7] POST save-review -> persisted into the docx')
{
  const { status, json } = await call('POST', 'save-review', { id: firstId, review: '### 1. 准确性审阅\n碳化物应为 M3C 为主。' })
  check('HTTP 200', status === 200, 'got ' + status)
  const buf = readFileSync(json.docxPath)
  check('docx now carries the review heading', buf.includes(Buffer.from('知识审阅与延伸', 'utf8')))
  check('docx carries review text', buf.includes(Buffer.from('M3C', 'utf8')))
  const note = json.notes.find((n) => n.id === firstId)
  check('note marked reviewed', note?.reviewedAt !== null && note?.reviewedAt !== undefined)
  check('review stored on the note', String(note?.review).includes('M3C'))
}

console.log('\n[8] GET with ?q= filters')
{
  const { json } = await call('GET', '?q=' + encodeURIComponent('碳化物'))
  check('matched the note', json?.matched === 1, 'matched=' + json?.matched)
  const none = await call('GET', '?q=zzzznomatch')
  check('no match -> 0', none.json?.matched === 0)
}

console.log('\n[9] POST compile rebuilds the document')
{
  const { status, json } = await call('POST', 'compile')
  check('HTTP 200', status === 200, 'got ' + status)
  check('docx still exists', existsSync(json.docxPath))
}

console.log('\n[10] unknown action -> 404')
{
  const { status } = await call('GET', 'nope')
  check('HTTP 404', status === 404, 'got ' + status)
}

console.log('\n[11] durability: a fresh store reads the same notes back')
{
  const buf = readFileSync(dataDir + '/notes.jsonl', 'utf8').trim().split('\n')
  check('one JSONL record per note', buf.length === 1, 'lines=' + buf.length)
  const rec = JSON.parse(buf[0])
  check('record has id/title/body', rec.id === 'N-0001' && !!rec.title && !!rec.body)
  check('record carries the review', String(rec.review).includes('M3C'))
  check('index.json written', existsSync(dataDir + '/index.json'))
}

console.log('\n[12] teardown removes the routes')
{
  for (const dispose of cleanups) dispose()
  check('no routes left', routes.length === 0, 'left=' + routes.length)
}

await new Promise((r) => server.close(r))
console.log(`\nRESULT  pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
