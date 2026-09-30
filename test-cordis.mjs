// Activation test for the bearing-notes Host half against the REAL Cordis
// runtime dsh ships (extracted from the installed app's app.asar), not a
// hand-written stub.
//
// Two contracts are covered that the HTTP-level test cannot see:
//   1. the exported `inject` declaration must be the array form Cordis
//      understands, so the fiber actually activates and registers its route;
//   2. the model call must use the real StreamChunk protocol.
//
// Usage: node test-cordis.mjs   (set DSH_ASAR to override the app.asar path)
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
/** Installed-app locations to try when DSH_ASAR is unset. */
const ASAR_CANDIDATES = [
  process.env.DSH_ASAR,
  process.env.LOCALAPPDATA === undefined ? undefined : join(process.env.LOCALAPPDATA, 'Programs/DeepSeek Harness/resources/app.asar'),
  process.env.APPDATA === undefined ? undefined : join(process.env.APPDATA, 'DeepSeek Harness/resources/app.asar'),
  // Running under the harness's own bundled node:
  // <app>/resources/runtime/primary-runtime/dependencies/node/bin/node.exe
  // -> five levels up from `bin` is <app>/resources.
  join(dirname(process.execPath), '../../../../..', 'app.asar'),
  '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar',
].filter((candidate) => candidate !== undefined)
const asarPath = ASAR_CANDIDATES.find((candidate) => existsSync(candidate))
const runtimeDir = join(here, 'out', 'cordis-runtime')

let pass = 0, fail = 0
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log('  PASS  ' + label) }
  else { fail++; console.log('  FAIL  ' + label + (detail ? '  -- ' + detail : '')) }
}

// --- extract the shipped Cordis runtime ------------------------------------
function extractAsar(asarFile, pattern, target) {
  const fd = readFileSync(asarFile)
  const headerSize = fd.readUInt32LE(4)
  const baseOffset = 8 + headerSize
  // The header JSON is followed by padding, so find the top-level value's end.
  let depth = 0, inStr = false, esc = false, end = -1
  for (let i = 16; i < fd.length; i++) {
    const c = fd[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === 0x5c) esc = true
      else if (c === 0x22) inStr = false
      continue
    }
    if (c === 0x22) { inStr = true; continue }
    if (c === 0x7b || c === 0x5b) depth++
    else if (c === 0x7d || c === 0x5d) { depth--; if (depth === 0) { end = i + 1; break } }
  }
  const header = JSON.parse(fd.subarray(16, end).toString('utf8'))
  const collected = []
  const walk = (node, prefix, depthLeft) => {
    for (const [name, value] of Object.entries(node.files ?? {})) {
      const p = prefix === '' ? name : `${prefix}/${name}`
      if (value.files !== undefined) { if (depthLeft < 40) walk(value, p, depthLeft + 1) }
      else collected.push({ path: p, size: value.size, offset: Number(value.offset) })
    }
  }
  walk(header, '', 0)
  const re = new RegExp(pattern)
  let n = 0
  for (const file of collected) {
    if (!re.test(file.path)) continue
    const out = join(target, file.path)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, fd.subarray(baseOffset + file.offset, baseOffset + file.offset + file.size))
    n++
  }
  return n
}

console.log('[setup] extracting the shipped Cordis runtime')
check('the installed app.asar was found', asarPath !== undefined,
  asarPath ?? `tried: ${ASAR_CANDIDATES.join(', ')} — set DSH_ASAR to the app.asar path`)
if (asarPath === undefined) {
  console.log(`\nRESULT  pass=${pass} fail=${fail}`)
  process.exit(1)
}
rmSync(runtimeDir, { recursive: true, force: true })
const extracted = extractAsar(asarPath, '^dsh/node_modules/@deepseek-ai/(cordis|cosmokit)/', runtimeDir)
check('cordis + cosmokit extracted', extracted > 5, 'files=' + extracted)

const { Context, Service } = await import(
  pathToFileURL(join(runtimeDir, 'dsh/node_modules/@deepseek-ai/cordis/lib/index.js')).href
)
const plugin = await import(pathToFileURL(join(here, 'index.js')).href)

// --- fake services the composition provides --------------------------------
const dataDir = join(here, 'out', 'cordis-test')
rmSync(dataDir, { recursive: true, force: true })

class FakeWebServer extends Service {
  constructor(ctx) {
    super(ctx, 'webServer')
    this.routes = []
  }
  register(route) {
    if (this.routes.some((r) => r.kind === route.kind && r.path === route.path)) {
      throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`)
    }
    this.routes.push(route)
    return () => {
      const i = this.routes.indexOf(route)
      if (i >= 0) this.routes.splice(i, 1)
    }
  }
  match(pathname) {
    const exact = this.routes.find((r) => r.kind === 'exact' && r.path === pathname)
    if (exact) return exact
    let best
    for (const r of this.routes) {
      if (r.kind !== 'prefix') continue
      if (pathname !== r.path && !pathname.startsWith(r.path + '/')) continue
      if (best === undefined || r.path.length > best.path.length) best = r
    }
    return best
  }
}

/** The composition's default model selection (what the user's sessions use). */
class FakeDefaultModel extends Service {
  constructor(ctx) {
    super(ctx, 'agentDefaultModel')
  }
  currentSelection() { return { provider: 'deepseek-account', model: 'deepseek-flash' } }
}

class FakeLlm extends Service {
  constructor(ctx) {
    super(ctx, 'llm')
    this.calls = []
  }
  // Registered first but credential-less: the plugin must not simply take this
  // route, which is what broke the live review call.
  listProviders() {
    return [
      { id: 'deepseek-official', name: 'DeepSeek API', models: [{ id: 'deepseek-chat' }] },
      { id: 'deepseek-account', name: 'DeepSeek', models: [{ id: 'deepseek-flash' }] },
    ]
  }
  async listModels() { return [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }] }
  async *stream(options) {
    this.calls.push(options)
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text: '### 1. 准确性审阅\n碳化物以 M3C 为主。\n' }
    yield { type: 'text-delta', index: 0, text: '### 4. 建议追读\nBhadeshia (2012)。\n' }
    yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 10 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

const settledWithin = (promise, ms) => Promise.race([
  promise.then(() => 'settled', () => 'settled'),
  new Promise((r) => setTimeout(() => r('timeout'), ms)),
])

async function mount(pluginObject, label, config = { dataDir }) {
  const root = new Context()
  await root.plugin(FakeWebServer)
  await root.plugin(FakeLlm)
  await root.plugin(FakeDefaultModel)
  const webServer = root.get('webServer')
  let applied = false
  const base = pluginObject ?? plugin
  const fiber = root.plugin({
    ...base,
    name: 'bearing-notes',
    apply: (ctx, rowConfig) => {
      applied = true
      plugin.apply(ctx, rowConfig ?? { ...plugin.DEFAULTS, dataDir })
    },
  }, config)
  const outcome = await settledWithin(fiber, 500)
  const failure = await fiber.then(() => null, (error) => error?.message ?? String(error))
  return { root, webServer, applied, outcome, failure, label }
}

console.log('\n[1] the exported declarations are the shapes Cordis resolves')
{
  check('inject is an array', Array.isArray(plugin.inject), JSON.stringify(plugin.inject))
  check('inject lists webServer and llm',
    Array.isArray(plugin.inject) && plugin.inject.includes('webServer') && plugin.inject.includes('llm'),
    JSON.stringify(plugin.inject))
  // The Loader validates the row config through Standard Schema.
  check('Config exposes a Standard Schema validator', typeof plugin.Config?.['~standard']?.validate === 'function',
    JSON.stringify(Object.keys(plugin.Config ?? {})))
  const filled = plugin.Config?.['~standard']?.validate({ dataDir })
  check('validator fills the remaining defaults', filled?.value?.dataDir === dataDir && filled?.value?.docxFile === plugin.DEFAULTS.docxFile,
    JSON.stringify(filled?.value))
  check('validator rejects a mistyped field', Array.isArray(plugin.Config?.['~standard']?.validate({ maxOutputTokens: 'many' })?.issues))
}

console.log('\n[2] the shipped declarations activate against the real runtime')
let mounted
{
  mounted = await mount(plugin, 'shipped')
  check('apply ran', mounted.applied, 'outcome=' + mounted.outcome + ' failure=' + mounted.failure)
  check('route registered', mounted.webServer.routes.some((r) => r.path === '/bearing-notes'), JSON.stringify(mounted.webServer.routes.map((r) => r.kind + ':' + r.path)))
  check('route is a prefix route', mounted.webServer.routes.some((r) => r.kind === 'prefix' && r.path === '/bearing-notes'))
}

console.log('\n[3] the broken inject declaration stays inactive (regression guard)')
{
  const wrong = await mount({ inject: { optional: ['webServer', 'llm'] }, Config: plugin.Config }, 'optional-object')
  check('an { optional: [...] } declaration never activates', wrong.applied === false, 'applied=' + wrong.applied)
  check('and therefore registers no route', wrong.webServer.routes.length === 0, JSON.stringify(wrong.webServer.routes.map((r) => r.path)))
  await wrong.root.fiber.dispose()
}

console.log('\n[4] a required service that never appears also stays inactive')
{
  const missing = await mount({ inject: ['webServer', 'no-such-service'], Config: plugin.Config }, 'missing-service')
  check('no route without the declared service', missing.applied === false && missing.webServer.routes.length === 0, 'applied=' + missing.applied)
  await missing.root.fiber.dispose()
}

console.log('\n[5] a plain-object Config export breaks activation (regression guard)')
{
  const plain = await mount({ inject: plugin.inject, Config: { ...plugin.DEFAULTS } }, 'plain-config')
  check('a non-schema Config never activates', plain.applied === false, 'applied=' + plain.applied)
  check('the failure names the missing validator', String(plain.failure).includes('validate'), String(plain.failure))
  await plain.root.fiber.dispose()
}

console.log('\n[6] the review route runs through the real chunk protocol')
{
  const server = createServer((req, res) => {
    const matched = mounted.webServer.match(new URL(req.url, 'http://x').pathname)
    if (matched === undefined) { res.writeHead(404).end('no route'); return }
    Promise.resolve(matched.handler(req, res)).catch((err) => { res.writeHead(500).end(String(err)) })
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}`
  const unreachable = await fetch(base + '/bearing-notes/nope').then((r) => r.status)
  check('an unknown action is a 404, not a missing route', unreachable === 404, 'got ' + unreachable)
  const res = await fetch(base + '/bearing-notes/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: '草稿', body: '轴承钢的接触疲劳寿命由硬度决定。' }),
  })
  const json = await res.json()
  check('HTTP 200', res.status === 200, 'got ' + res.status)
  check('text-delta chunks assembled into the review', String(json.review).includes('M3C'), JSON.stringify(json.review)?.slice(0, 80))
  check('both deltas survive the assembly', String(json.review).includes('建议追读'))
  const llm = mounted.root.get('llm')
  check('exactly one model call', llm.calls.length === 1, 'calls=' + llm.calls.length)
  check('call follows the composition default route, not registry order',
    llm.calls[0]?.provider === 'deepseek-account' && llm.calls[0]?.model === 'deepseek-flash',
    JSON.stringify({ provider: llm.calls[0]?.provider, model: llm.calls[0]?.model }))
  check('call caps output with maxTokens', llm.calls[0]?.maxTokens === plugin.DEFAULTS.maxOutputTokens, String(llm.calls[0]?.maxTokens))
  await new Promise((r) => server.close(r))
}

console.log('\n[7] disposing the fiber releases the route')
{
  await mounted.root.fiber.dispose()
  check('no routes left', mounted.webServer.routes.length === 0, 'left=' + mounted.webServer.routes.length)
  check('the data directory is not removed by teardown', existsSync(dataDir))
}

console.log(`\nRESULT  pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
