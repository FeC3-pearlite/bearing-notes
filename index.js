/**
 * Bearing-notes Host half.
 *
 * Serves the notes API the right-sidebar panel talks to, keeps notes in an
 * append-only JSONL file, compiles them into one Word document, and runs the
 * domain review through the LLM service.
 */
import { resolve, join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { NoteStore } from './lib/store.mjs'
import { buildReviewPrompt, buildFollowUpPrompt, DOMAIN, CONCEPTS, PITFALLS } from './lib/domain.mjs'

export const name = 'bearing-notes'

/**
 * Services the Host half needs before it can activate. Cordis `inject` is an
 * array of service names (or a name → config map); there is no
 * `{ optional: [...] }` form — that shape declares a service literally named
 * "optional" and leaves the plugin inactive forever.
 */
export const inject = ['webServer', 'llm']

/** Route prefix shared with the browser half; keep both sides in step. */
export const ROUTE_PREFIX = '/bearing-notes'

/** Effective defaults; the Loader row's `config` overrides these field by field. */
export const DEFAULTS = {
  /** Where notes.jsonl and the compiled .docx live. */
  dataDir: resolve('E:/Dcode/轴承钢-文献笔记'),
  /** Word knowledge-base file name. */
  docxFile: '轴承钢滚动接触疲劳-文献知识库.docx',
  /** Word document title. */
  docxTitle: '轴承钢滚动接触疲劳 · 文献知识库',
  /** Provider route for the review call; empty means "first registered". */
  provider: '',
  /** Model id for the review call; empty means "the provider's first model". */
  model: '',
  /** Cap on review output tokens. */
  maxOutputTokens: 4096,
}

const STRING_FIELDS = ['dataDir', 'docxFile', 'docxTitle', 'provider', 'model']

/**
 * Loader config schema. dsh resolves a plugin's exported `Config` through the
 * Standard Schema interface (`Config['~standard'].validate`), so it must be a
 * validator: a plain object of defaults throws at activation. Validation fills
 * every default and reports mistyped fields as issues.
 */
export const Config = {
  '~standard': {
    version: 1,
    vendor: 'bearing-notes',
    validate(value) {
      const raw = value ?? {}
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return { issues: [{ message: 'bearing-notes: config must be an object' }] }
      }
      const issues = []
      for (const field of STRING_FIELDS) {
        if (raw[field] !== undefined && typeof raw[field] !== 'string') {
          issues.push({ message: `bearing-notes: config.${field} must be a string`, path: [field] })
        }
      }
      if (raw.maxOutputTokens !== undefined && (!Number.isSafeInteger(raw.maxOutputTokens) || raw.maxOutputTokens <= 0)) {
        issues.push({ message: 'bearing-notes: config.maxOutputTokens must be a positive integer', path: ['maxOutputTokens'] })
      }
      if (issues.length > 0) return { issues }
      return { value: { ...DEFAULTS, ...raw } }
    },
  },
}

function readJson(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = []
    let bytes = 0
    req.on('data', (c) => {
      bytes += c.length
      if (bytes > 4 * 1024 * 1024) { reject(new Error('request body too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) { resolvePromise({}); return }
      try { resolvePromise(JSON.parse(raw)) } catch (err) { reject(new Error('invalid JSON body: ' + err.message)) }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value ?? null)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(text)
}

/** Assemble the plain text of one model stream, tolerating partial chunks. */
function textOf(chunk) {
  return typeof chunk?.text === 'string' ? chunk.text : ''
}

export function apply(ctx, config = {}) {
  const options = { ...DEFAULTS, ...config }
  const dataDir = resolve(options.dataDir)
  mkdirSync(dataDir, { recursive: true })
  const store = new NoteStore({
    dir: dataDir,
    file: options.docxFile,
    title: options.docxTitle,
  })

  ctx.logger?.info?.('bearing-notes: data directory %s', dataDir)

  // ---------------------------------------------------------------- model ----
  /**
   * The route this composition's own sessions use. Read through `ctx.get()`,
   * which needs no inject dependency, so a composition without the service
   * still loads this plugin.
   */
  function compositionRoute() {
    try {
      const selection = ctx.get('agentDefaultModel')?.currentSelection?.()
      return selection?.provider && selection?.model ? selection : null
    } catch { return null }
  }

  /**
   * Pick the provider/model route: an explicit `provider`/`model` pair from the
   * config, then the composition's default route (the model the user's sessions
   * actually run on), then the first registered provider with the first model
   * it advertises. The LLM runtime rejects a call without an exact model, so
   * this always resolves a concrete model id. Picking "the first registered
   * provider" alone is wrong in compositions where that route has no
   * credential while the session default does.
   */
  async function resolveRoute() {
    if (options.provider && options.model) return { provider: options.provider, model: options.model }
    const preferred = compositionRoute()
    if (preferred && !options.provider) return { provider: preferred.provider, model: options.model || preferred.model }
    let providers = []
    try { providers = ctx.llm.listProviders() ?? [] } catch { providers = [] }
    const first = providers[0]
    const firstId = typeof first === 'string' ? first : first?.id ?? first?.provider ?? first?.name
    const provider = options.provider || firstId
    if (!provider) return null
    if (options.model) return { provider, model: options.model }
    // The first provider's advertised models are only usable for that provider.
    if (provider === firstId && typeof first === 'object' && first !== null) {
      const advertised = first.models?.[0]
      const id = typeof advertised === 'string' ? advertised : advertised?.id ?? advertised?.model
      if (id) return { provider, model: id }
    }
    try {
      const models = await ctx.llm.listModels(provider)
      const candidate = models?.[0]
      const model = typeof candidate === 'string' ? candidate : candidate?.id ?? candidate?.model
      if (model) return { provider, model }
    } catch { /* reported below as an unresolvable route */ }
    // A configured provider that advertises nothing still needs some model id.
    if (preferred?.model) return { provider, model: preferred.model }
    return null
  }

  async function streamText(prompt) {
    const route = await resolveRoute()
    if (!route) throw new Error('没有可用的模型路由：请在插件配置里指定 provider 与 model（或先连上一个模型账号）。')
    // GenerateOptions: `system` is the system prompt channel, `maxTokens` the
    // output cap; a bare user message is a valid request-only input.
    const call = {
      provider: route.provider,
      model: route.model,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      maxTokens: options.maxOutputTokens,
    }
    // StreamChunk protocol: text arrives as { type: 'text-delta', text } and the
    // stream ends with one { type: 'finish', reason } chunk.
    let out = ''
    let failure = null
    for await (const chunk of ctx.llm.stream(call)) {
      if (!chunk || typeof chunk !== 'object') continue
      if (chunk.type === 'text-delta') { out += textOf(chunk); continue }
      if (chunk.type === 'finish') {
        const reason = chunk.reason ?? {}
        if (reason.kind === 'error' || reason.kind === 'aborted') {
          failure = reason.failure ?? { message: String(reason.kind) }
        } else if (reason.kind !== undefined && reason.kind !== 'stop') {
          failure = { message: `模型以 ${reason.kind} 结束` }
        }
      }
    }
    if (!out.trim()) {
      if (failure) {
        const detail = failure.message || failure.code || 'model call failed'
        throw new Error(`模型调用失败：${detail}${failure.code && failure.code !== detail ? ' (' + failure.code + ')' : ''}`)
      }
      throw new Error('模型没有返回任何内容，请稍后重试或在插件配置里换一个模型。')
    }
    return out
  }

  // --------------------------------------------------------------- routes ----
  const routes = []
  function route(path, handler) {
    routes.push(ctx.webServer.register({ path, kind: 'prefix', handler }))
  }

  function snapshot(query = {}) {
    const q = String(query.q ?? '').trim()
    const notes = q ? store.search(q) : store.notes
    return {
      dataDir,
      docxPath: store.docxPath,
      docxExists: existsSync(store.docxPath),
      date: new Date().toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
      domain: { name: DOMAIN.name, english: DOMAIN.english, concepts: CONCEPTS.map((c) => c.term) },
      tags: store.tags(),
      total: store.notes.length,
      matched: notes.length,
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        tags: n.tags ?? [],
        source: n.source ?? '',
        review: n.review ?? '',
        createdAt: n.createdAt,
        reviewedAt: n.reviewedAt ?? null,
      })),
    }
  }

  route(ROUTE_PREFIX, async (req, res) => {
    const url = new URL(req.url ?? ROUTE_PREFIX, 'http://127.0.0.1')
    const action = url.pathname.slice(ROUTE_PREFIX.length).replace(/^\/+/, '')
    const method = (req.method ?? 'GET').toUpperCase()

    try {
      if (method === 'GET' && (action === '' || action === 'notes')) {
        sendJson(res, 200, { ok: true, ...snapshot(Object.fromEntries(url.searchParams)) })
        return
      }

      if (method === 'POST' && action === 'notes') {
        const body = await readJson(req)
        if (!body.body || !String(body.body).trim()) { sendJson(res, 400, { ok: false, error: '笔记正文不能为空' }); return }
        const added = store.add({
          title: body.title,
          body: body.body,
          tags: body.tags,
          source: body.source,
        })
        sendJson(res, 200, { ok: true, id: added.note.id, total: added.total, docxPath: added.docx, ...snapshot() })
        return
      }

      if (method === 'POST' && action === 'review') {
        const body = await readJson(req)
        const existing = store.notes.map((n) => ({ id: n.id, title: n.title }))
        let prompt
        let noteRef = null
        if (body.id) {
          noteRef = store.get(body.id)
          if (!noteRef) { sendJson(res, 404, { ok: false, error: '找不到笔记 ' + body.id }); return }
          prompt = body.question
            ? buildFollowUpPrompt(noteRef, String(body.question))
            : buildReviewPrompt(noteRef, { existing, extraFocus: body.focus })
        } else {
          const draft = { title: body.title, body: body.body, source: body.source, tags: body.tags }
          if (!draft.body || !String(draft.body).trim()) { sendJson(res, 400, { ok: false, error: '请先输入笔记正文' }); return }
          prompt = buildReviewPrompt(draft, { existing, extraFocus: body.focus })
        }
        const review = await streamText(prompt)
        sendJson(res, 200, { ok: true, id: body.id ?? null, review })
        return
      }

      if (method === 'POST' && action === 'save-review') {
        const body = await readJson(req)
        if (!body.id) { sendJson(res, 400, { ok: false, error: '缺少笔记 id' }); return }
        const saved = store.setReview(String(body.id), body.review)
        sendJson(res, 200, { ok: true, id: saved.note.id, docxPath: saved.docx, ...snapshot() })
        return
      }

      if (method === 'POST' && action === 'compile') {
        const docx = store.compile()
        sendJson(res, 200, { ok: true, docxPath: docx, ...snapshot() })
        return
      }

      if (method === 'GET' && action === 'context') {
        sendJson(res, 200, { ok: true, domain: DOMAIN, concepts: CONCEPTS, pitfalls: PITFALLS })
        return
      }

      sendJson(res, 404, { ok: false, error: `unknown action "${action}"` })
    } catch (err) {
      ctx.logger?.warn?.('bearing-notes: %s %s failed: %s', method, action, err?.message ?? err)
      sendJson(res, 500, { ok: false, error: err?.message ?? String(err) })
    }
  })

  ctx.effect(() => () => { for (const dispose of routes) { try { dispose() } catch { /* already gone */ } } })
}

export { buildReviewPrompt, buildFollowUpPrompt, NoteStore }
