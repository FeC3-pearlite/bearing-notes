// Contract test for the bearing-notes browser half.
//
// The stubs below encode the REAL shipped client API, verified against the
// packaged app:
//   * slot registry semantics   -> @deepseek-ai/dsh-client-ui-slots/lib/index.js
//                                  (SlotCore.register: undeclared slot throws,
//                                  `single` throws on a second occupant, `keyed`
//                                  needs `key`, `list` needs `id`)
//   * tab types + navigation    -> @deepseek-ai/dsh-client-ui-sidebar-right
//                                  (README "Extension seats" / "ctx.sidebarRight",
//                                  lib/client.js `sidebarRightTabs.register`)
//   * the conversation header   -> @deepseek-ai/dsh-client-ui-conversation/lib/client.js
//                                  (`conversation.session.header.corner` is a
//                                  `single` seat; `.utilities`/`.actions` are `list`)
//   * real header-seat users    -> @deepseek-ai/dsh-client-ui-schedule (utilities),
//                                  @deepseek-ai/dsh-client-ui-jobs (actions)
//   * copy                      -> @deepseek-ai/dsh-client-locale README
//                                  (`ctx.locale.register(ns, { zh, en })`, `bind(ns)`)
//
// It asserts the wiring contract:
//   - the bundle registers exactly one factory whose id is the package name
//   - the tab type is registered with the id the body registers under
//   - the body/title land in the declared keyed seats, the button in a list seat
//   - the header button actually opens the tab through ctx.sidebarRight.openTab
//   - the copy the plugin registers is the copy its titles render
//   - every contribution is disposed on teardown
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, 'lib/client.js'), 'utf8')

let pass = 0, fail = 0
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log('  PASS  ' + label) }
  else { fail++; console.log('  FAIL  ' + label + (detail ? '  -- ' + detail : '')) }
}

// --- React shim -------------------------------------------------------------
const Fragment = Symbol('react.fragment')
function createElement(type, props, ...children) {
  return {
    $$typeof: 'element',
    type,
    props: props ?? {},
    children: children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false),
  }
}
const ReactShim = {
  Fragment,
  createElement,
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
}

// --- the seat table the client is allowed to touch --------------------------
// Specs as declared by the owning packages (see the header comment).
const SLOT_SPECS = {
  // declared by the rightbar seat in ui-sidebar-right (lib/client.js:9154-9163)
  'sidebar.right.pane.tab': { kind: 'keyed', scope: 'session' },
  'sidebar.right.pane.tab.title': { kind: 'keyed', scope: 'session' },
  // declared by the conversation header (ui-conversation lib/client.js)
  'conversation.session.header.lineage': { kind: 'single', scope: 'session' },
  'conversation.session.header.actions': { kind: 'list', scope: 'session' },
  'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
  'conversation.session.header.corner': { kind: 'single', scope: 'session' },
}
/** Bands ui-sidebar-right ranks tab types by (`RANKS`), extension is the default. */
const BANDS = ['extension', 'builtin', 'fallback']

const state = {
  hasSession: true,
  openTabCalls: [],
  tabTypes: [],
  slotEntries: [],
  slotInjects: [],
  pendingWaits: [],
  effects: [],
  injects: [],
  locale: { active: 'zh', namespaces: new Map(), registers: [], binds: [] },
}

const asDisposer = (value) => {
  if (typeof value === 'function') return value
  if (value && typeof value[Symbol.iterator] === 'function') {
    const list = [...value]
    return () => { for (const fn of list) fn() }
  }
  return () => {}
}
const idempotent = (fn) => { let done = false; return () => { if (done) return; done = true; fn() } }

/** Mirrors SlotCore.register's validation (ui-slots/lib/index.js:163-243). */
function registerEntry(options, component) {
  const spec = SLOT_SPECS[options?.name]
  if (!spec) throw new Error(`slot "${options?.name}" is not declared (a parent entry's children table must declare it)`)
  const occupant = state.slotEntries.find((e) => e.options.name === options.name && !e.disposed)
  if (spec.kind === 'single' && occupant) {
    throw new Error(`single slot "${options.name}" already has a registration (registered by ${occupant.registrant})`)
  }
  if (spec.kind === 'keyed' && options.key === undefined) {
    throw new Error(`keyed slot "${options.name}" requires options.key`)
  }
  if (spec.kind === 'keyed' && state.slotEntries.some((e) => !e.disposed && e.options.name === options.name && e.options.key === options.key)) {
    throw new Error(`keyed slot "${options.name}" already has an entry for key "${options.key}"`)
  }
  if (spec.kind === 'list' && options.id === undefined) {
    throw new Error(`list slot "${options.name}" requires options.id`)
  }
  if (spec.kind === 'list' && state.slotEntries.some((e) => !e.disposed && e.options.name === options.name && e.options.id === options.id)) {
    throw new Error(`list slot "${options.name}" already has an entry with id "${options.id}"`)
  }
  if (typeof component !== 'function') throw new Error(`slot "${options.name}" was registered without a component`)
  const entry = { options, component, spec, registrant: 'plugin under test', disposed: false }
  state.slotEntries.push(entry)
  return () => { entry.disposed = true }
}

/** Mirrors the sidebarRightTabs registry (ui-sidebar-right/lib/client.js). */
function registerTabType(definition) {
  const { id, kind } = definition ?? {}
  if (typeof id !== 'string' || id === '') throw new Error('sidebarRight: tab type needs an id')
  if (typeof kind !== 'string' || kind === '') throw new Error('sidebarRight: tab type needs a kind')
  const band = definition.priority ?? 'extension'
  if (!BANDS.includes(band)) throw new Error(`sidebarRight: unknown priority band "${band}"`)
  if (typeof definition.title !== 'function') throw new Error(`sidebarRight: tab type "${id}" needs title(address)`)
  if (state.tabTypes.some((t) => !t.disposed && t.id === id)) throw new Error(`sidebarRight: tab type id "${id}" is already registered`)
  const held = state.tabTypes.find((t) => !t.disposed && t.kind === kind)
  const coexists = held && band !== 'fallback' && held.band !== 'fallback' && held.band !== band
  if (held && !coexists) throw new Error(`sidebarRight: tab kind "${kind}" is already registered (${held.band})`)
  const record = { id, kind, band, definition, disposed: false }
  state.tabTypes.push(record)
  return () => { record.disposed = true }
}

/** Mirrors ctx.sidebarRight (openTab requires a session and a registered kind). */
const sidebarRight = {
  openTab(kind, options = {}) {
    const def = state.tabTypes.find((t) => !t.disposed && t.kind === kind)
    if (!def) throw new Error(`sidebarRight: no registered tab type claims kind "${kind}"`)
    if (!state.hasSession) throw new Error('sidebarRight: no session on screen (commands throw rather than write into a surface nobody draws)')
    state.openTabCalls.push({ kind, options })
  },
}

/** Mirrors ctx.locale (dsh-client-locale README, "Registering a dictionary"). */
const locale = {
  register(ns, dict) {
    if (!dict || typeof dict !== 'object') throw new Error(`locale.register("${ns}") needs a dictionary object`)
    for (const lang of ['zh', 'en']) {
      if (!dict[lang] || typeof dict[lang] !== 'object') {
        throw new Error(`locale.register("${ns}") requires both shipped locales; "${lang}" is missing`)
      }
    }
    const keys = (table) => Object.keys(table).sort().join(',')
    if (keys(dict.zh) !== keys(dict.en)) {
      throw new Error(`locale.register("${ns}") dictionaries disagree: zh=[${keys(dict.zh)}] en=[${keys(dict.en)}]`)
    }
    state.locale.namespaces.set(ns, dict)
    state.locale.registers.push({ ns, dict })
    return () => { state.locale.namespaces.delete(ns) }
  },
  bind(ns) {
    state.locale.binds.push(ns)
    // Valid before the namespace registers (ui-sidebar-files binds first, registers after).
    return (key) => {
      const dict = state.locale.namespaces.get(ns)
      const table = dict?.[state.locale.active] ?? dict?.en
      return table?.[key] ?? key
    }
  },
}

const slots = {
  inject(key, callback) {
    state.slotInjects.push(key)
    if (!SLOT_SPECS[key]) { state.pendingWaits.push(key); return () => {} }
    const dispose = asDisposer(callback())
    return idempotent(dispose)
  },
  register: registerEntry,
}

function makeCtx() {
  const ctx = {
    effect(fn, label) {
      const dispose = asDisposer(fn())
      state.effects.push({ label, dispose })
      return idempotent(dispose)
    },
    inject(services, cb) {
      state.injects.push([...services])
      for (const service of services) {
        const known = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight', 'shortcuts', 'remote']
        if (!known.includes(service)) throw new Error(`ctx.inject asked for unknown service "${service}"`)
      }
      cb(ctx)
      return () => {}
    },
    slots,
    locale,
    sidebarRight,
    sidebarRightTabs: { register: registerTabType },
  }
  return ctx
}

// --- module loader stub -----------------------------------------------------
const registry = new Map()
let loadedId = null
globalThis.window = {
  __ModuleLoader__: {
    load(entry) {
      if (loadedId !== null) throw new Error('loader.load called twice')
      loadedId = entry.id
      registry.set(entry.id, entry.factory)
    },
  },
}
const requiredModules = []
const requireShim = (name) => {
  requiredModules.push(name)
  if (name === 'react') return ReactShim
  throw new Error('unexpected module request: ' + name)
}

// The shipped sidebar-right plugin already holds the header's corner seat:
// `conversation.session.header.corner` is declared `single`, so any second
// registration at the same priority throws.
state.slotEntries.push({
  options: { name: 'conversation.session.header.corner' },
  component: () => null,
  spec: SLOT_SPECS['conversation.session.header.corner'],
  registrant: 'ui-sidebar-right expand button',
  disposed: false,
})

// Execute the real bundle as a classic script.
console.log('[1] bundle registers a factory')
{
  // eslint-disable-next-line no-new-func
  new Function('window', source)(globalThis.window)
  check('exactly one load() call', loadedId === '@local/bearing-notes', String(loadedId))
  check('factory is a function', typeof registry.get(loadedId) === 'function')
}

const exportsObj = registry.get('@local/bearing-notes')(requireShim)
console.log('\n[2] plugin shape')
check('exports an object', !!exportsObj && typeof exportsObj === 'object')
check('inject is an array of service names', Array.isArray(exportsObj.inject))
check("inject includes 'slots'", exportsObj.inject.includes('slots'), JSON.stringify(exportsObj.inject))
check('apply is a function', typeof exportsObj.apply === 'function')

console.log('\n[3] apply() contributes without throwing')
let applyError = null
try { exportsObj.apply(makeCtx()) } catch (err) { applyError = err }
check('apply() completed', applyError === null, applyError ? applyError.message : '')

console.log('\n[4] tab type (ctx.sidebarRightTabs.register)')
const registered = state.tabTypes[0] ?? {}
const def = registered.definition ?? {}
{
  check('exactly one tab type registered', state.tabTypes.length === 1, 'count=' + state.tabTypes.length)
  check('id is the package name', def.id === '@local/bearing-notes', String(def.id))
  check('kind is a non-empty string', typeof def.kind === 'string' && def.kind.length > 0, String(def.kind))
  check('priority is a real band', BANDS.includes(registered.band), String(registered.band))
  check('title(address) returns a non-empty string', typeof def.title === 'function' && String(def.title('sidebar://' + def.kind)).length > 0, String(def.title?.()))
}

console.log('\n[5] slot contributions land in the declared seats')
{
  const body = state.slotEntries.find((e) => e.options.name === 'sidebar.right.pane.tab')
  const title = state.slotEntries.find((e) => e.options.name === 'sidebar.right.pane.tab.title')
  const button = state.slotEntries.find((e) => e.options.name === 'conversation.session.header.utilities')
  check('body registered in the keyed sidebar.right.pane.tab seat', !!body)
  check('title registered in the keyed sidebar.right.pane.tab.title seat', !!title)
  check('header button registered in the list conversation.session.header.utilities seat', !!button)
  check('header button did NOT take the single corner seat',
    !state.slotEntries.some((e) => e.registrant === 'plugin under test' && e.options.name === 'conversation.session.header.corner'))
  check('header button declares a list id', typeof button?.options?.id === 'string' && button.options.id.length > 0, String(button?.options?.id))
  check('body key equals the tab type id', body?.options?.key === def.id, `${body?.options?.key} vs ${def.id}`)
  check('title key equals the tab type id', title?.options?.key === def.id, `${title?.options?.key} vs ${def.id}`)
  check('body component is a function', typeof body?.component === 'function')
  check('title component is a function', typeof title?.component === 'function')
  check('button component is a function', typeof button?.component === 'function')
  check('every injected slot key is declared', state.pendingWaits.length === 0, JSON.stringify(state.pendingWaits))
  check('slot inject waits on the keyed seats',
    state.slotInjects.includes('sidebar.right.pane.tab') && state.slotInjects.includes('sidebar.right.pane.tab.title'))
}

console.log('\n[6] header button opens the tab through ctx.sidebarRight')
{
  const button = state.slotEntries.find((e) => e.options.name === 'conversation.session.header.utilities')
  const props = { ...button.options.inject() }
  check('inject() face exposes openTab', typeof props.openTab === 'function')
  // The renderer spreads that face into the component's props.
  const tree = button.component(props)
  const rendered = tree.type === Fragment ? tree.children : [tree]
  const node = rendered.find((c) => c.type === 'button')
  check('button renders a <button>', !!node)
  let clickError = null
  try { node.props.onClick({ stopPropagation() {} }) } catch (err) { clickError = err }
  check('clicking the button does not throw', clickError === null, clickError ? clickError.message : '')
  check('openTab called once', state.openTabCalls.length === 1, 'calls=' + JSON.stringify(state.openTabCalls))
  check('openTab called with the registered kind', state.openTabCalls[0]?.kind === def.kind, JSON.stringify(state.openTabCalls[0]))
  check('openTab passed an options object', !!state.openTabCalls[0]?.options && typeof state.openTabCalls[0].options === 'object')

  state.hasSession = false
  let noSessionError = null
  try { props.openTab() } catch (err) { noSessionError = err }
  state.hasSession = true
  check('openTab with no session on screen is swallowed', noSessionError === null, noSessionError ? noSessionError.message : '')
}

console.log('\n[7] the registered copy is what the titles render')
{
  const title = state.slotEntries.find((e) => e.options.name === 'sidebar.right.pane.tab.title')
  const zhOut = title.component({})
  check('chip title renders a span', zhOut?.type === 'span', String(zhOut?.type))
  check('chip title uses the zh dictionary', JSON.stringify(zhOut).includes('文献知识库'), JSON.stringify(zhOut).slice(0, 80))
  check('tab type title uses the zh dictionary', def.title('sidebar://' + def.kind) === '文献知识库', String(def.title('sidebar://' + def.kind)))
  state.locale.active = 'en'
  check('tab type title follows the active locale', def.title('sidebar://' + def.kind) === 'Literature notes', String(def.title('sidebar://' + def.kind)))
  check('chip title follows the active locale', JSON.stringify(title.component({})).includes('Literature notes'), JSON.stringify(title.component({})).slice(0, 80))
  state.locale.active = 'zh'
}

console.log('\n[8] locale registration')
{
  check('locale requested via ctx.inject', state.injects.some((s) => s.includes('locale')), JSON.stringify(state.injects))
  check('one dictionary registered', state.locale.registers.length === 1, 'count=' + state.locale.registers.length)
  check('namespace is bearingNotes', state.locale.registers[0]?.ns === 'bearingNotes', String(state.locale.registers[0]?.ns))
  check('dictionary carries both shipped locales', !!state.locale.registers[0]?.dict?.zh && !!state.locale.registers[0]?.dict?.en)
  check('translator bound to that namespace', state.locale.binds.includes('bearingNotes'), JSON.stringify(state.locale.binds))
}

console.log('\n[9] optional services are guarded')
{
  check('sidebarRightTabs requested via ctx.inject', state.injects.some((s) => s.includes('sidebarRightTabs')), JSON.stringify(state.injects))
  check('sidebarRight requested via ctx.inject', state.injects.some((s) => s.includes('sidebarRight')))
}

console.log('\n[10] the body renders (smoke) and every contribution is an effect')
{
  const body = state.slotEntries.find((e) => e.options.name === 'sidebar.right.pane.tab')
  let renderError = null
  try { body.component({}) } catch (err) { renderError = err }
  check('body renders without throwing', renderError === null, renderError ? renderError.message : '')

  const labels = state.effects.map((e) => e.label)
  check('effects recorded', state.effects.length >= 5, 'count=' + state.effects.length)
  check('tab type registration is an effect', labels.some((l) => String(l).includes('tab type')), labels.join(' | '))
  check('body registration is an effect', labels.some((l) => String(l).includes('tab body')))
  check('title registration is an effect', labels.some((l) => String(l).includes('tab title')))
  check('header button is an effect', labels.some((l) => String(l).includes('header button')))
  let disposeErrors = 0
  for (const e of state.effects) {
    try { e.dispose() } catch { disposeErrors++ }
  }
  check('disposers run cleanly', disposeErrors === 0, 'errors=' + disposeErrors)
  check('teardown empties the seats', state.slotEntries.filter((e) => !e.disposed && e.registrant === 'plugin under test').length === 0)
  check('teardown releases the tab type id', !state.tabTypes.some((t) => !t.disposed), JSON.stringify(state.tabTypes.map((t) => t.disposed)))
}

console.log('\n[11] source hygiene')
{
  const requires = [...source.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((m) => m[2])
  check('only react is required from the module table', requires.length > 0 && requires.every((n) => n === 'react'), requires.join(','))
  check('no React import of a Harness client package', !/require\(['"]@deepseek-ai\//.test(source))
  check('uses theme tokens, no hard-coded surfaces in layout rules', !/\.bn-root\{[^}]*background:\s*#/.test(source))
  check('route prefix matches the host half', source.includes("const ROUTE = '/bearing-notes'"))
  check('no document.body writes', !/document\.body/.test(source))
}

console.log(`\nRESULT  pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
