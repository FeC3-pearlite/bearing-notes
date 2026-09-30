/**
 * Bearing-notes browser half: the right-sidebar panel.
 *
 * Registers one right-sidebar tab type plus its body and title, and a header
 * button that opens the tab. All data access goes through the Host route
 * under ROUTE_PREFIX.
 */
window.__ModuleLoader__.load({
  id: '@local/bearing-notes',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useRef, useCallback, useMemo } = React

    /** Must match ROUTE_PREFIX in index.js. */
    const ROUTE = '/bearing-notes'
    const OWN_KIND = 'bearing-notes'
    const OWN_ID = '@local/bearing-notes'

    // ---------------------------------------------------------- copy ----
    /** `ctx.locale` namespace this plugin owns; `register(ns, { zh, en })`. */
    const NS = 'bearingNotes'
    /** The dictionaries handed to `ctx.locale.register`; also the offline fallback. */
    const COPY = {
      zh: {
        'type.label': '文献知识库',
        'button.title': '文献知识库（轴承钢滚动接触疲劳）',
        'button.aria': '打开文献知识库',
      },
      en: {
        'type.label': 'Literature notes',
        'button.title': 'Literature notes (bearing-steel RCF)',
        'button.aria': 'Open literature notes',
      },
    }
    /**
     * The bound translator, once the locale service is up. Kept module-level so
     * the tab type's `title()` (called later, at open time) sees the live one.
     */
    let boundT = null
    /** Translate a key, falling back to the shipped zh copy when locale is absent. */
    function t(key, params) {
      const bound = boundT
      if (bound) {
        const value = bound(key, params)
        if (typeof value === 'string' && value !== key) return value
      }
      return COPY.zh[key] ?? key
    }

    // ------------------------------------------------------------- styles ----
    const CSS = `
.bn-root{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:1.55}
.bn-head{flex:none;display:flex;align-items:center;gap:6px;height:38px;padding:0 8px 0 14px;border-bottom:.5px solid var(--dsw-alias-border-l3);box-sizing:border-box}
.bn-head-title{font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bn-body{flex:1;min-height:0;overflow:auto;padding:10px 12px 18px}
.bn-field{margin-bottom:8px}
.bn-label{display:block;font-size:12px;color:var(--dsw-alias-label-secondary);margin-bottom:3px}
.bn-input,.bn-textarea{width:100%;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base,transparent);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,6px);padding:6px 8px;font:inherit;outline:none}
.bn-input:focus,.bn-textarea:focus{border-color:var(--dsw-alias-border-l1)}
.bn-textarea{min-height:110px;resize:vertical;line-height:1.6}
.bn-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.bn-btn{font:inherit;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,6px);padding:5px 10px;cursor:pointer;white-space:nowrap}
.bn-btn:hover{background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover))}
.bn-btn:disabled{opacity:.5;cursor:default}
.bn-btn-primary{background:var(--dsw-alias-brand-primary,#247bbf);border-color:transparent;color:#fff;font-weight:600}
.bn-btn-primary:hover{opacity:.9;background:var(--dsw-alias-brand-primary,#247bbf)}
.bn-btn-icon{padding:4px 7px;line-height:1;display:inline-flex;align-items:center}
.bn-sec{margin-top:14px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l3)}
.bn-sec-title{font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px}
.bn-meta{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-bottom:8px;word-break:break-all}
.bn-note{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md,6px);padding:8px 10px;margin-bottom:8px;cursor:pointer}
.bn-note:hover{background:var(--dsw-alias-interactive-bg-hover)}
.bn-note-head{display:flex;gap:6px;align-items:baseline}
.bn-note-id{font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none}
.bn-note-title{font-weight:600;flex:1;min-width:0}
.bn-note-snip{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bn-tag{display:inline-block;font-size:11px;padding:1px 6px;border-radius:10px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);margin:2px 4px 0 0}
.bn-badge{font-size:11px;padding:1px 6px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);flex:none}
.bn-badge-ok{color:var(--dsw-alias-label-primary)}
.bn-review{margin-top:8px;padding:9px 11px;border-left:2px solid var(--dsw-alias-brand-primary,#247bbf);background:var(--dsw-alias-bg-subtle,var(--dsw-alias-interactive-bg-hover));border-radius:0 var(--dsw-radius-md,6px) var(--dsw-radius-md,6px) 0;white-space:pre-wrap;word-break:break-word}
.bn-review h1,.bn-review h2,.bn-review h3{font-size:13px;margin:10px 0 4px}
.bn-h{font-weight:700;margin:9px 0 3px}
.bn-li{margin:2px 0 2px 4px}
.bn-status{font-size:12px;color:var(--dsw-alias-label-secondary);margin:6px 0}
.bn-err{color:var(--dsw-alias-label-error,#c0392b);font-size:12px;margin:6px 0;white-space:pre-wrap}
.bn-empty{color:var(--dsw-alias-label-tertiary);font-size:12px;padding:10px 2px}
.bn-spin{display:inline-block;width:11px;height:11px;border:1.5px solid var(--dsw-alias-label-tertiary);border-top-color:transparent;border-radius:50%;animation:bn-rot .7s linear infinite;vertical-align:-1px;margin-right:5px}
@keyframes bn-rot{to{transform:rotate(360deg)}}
`

    function Styles() {
      return h('style', { 'data-bearing-notes': '' }, CSS)
    }

    // -------------------------------------------------------------- utils ----
    async function api(action, init) {
      const res = await fetch(ROUTE + (action ? '/' + action : ''), {
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        ...init,
      })
      let payload = null
      try { payload = await res.json() } catch { /* non-JSON error body */ }
      if (!res.ok || (payload && payload.ok === false)) {
        throw new Error((payload && payload.error) || `请求失败 (HTTP ${res.status})`)
      }
      return payload
    }

    /** Render the small Markdown subset the review uses. */
    function Review({ text }) {
      const nodes = useMemo(() => {
        const out = []
        const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
        lines.forEach((raw, i) => {
          const line = raw.trimEnd()
          if (!line.trim()) { out.push(h('div', { key: i, style: { height: 5 } })); return }
          const head = /^(#{1,6})\s+(.*)$/.exec(line)
          if (head) { out.push(h('div', { key: i, className: 'bn-h' }, head[2])); return }
          const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
          if (bullet) { out.push(h('div', { key: i, className: 'bn-li' }, '• ' + bullet[1])); return }
          const num = /^\s*(\d+)[.)]\s+(.*)$/.exec(line)
          if (num) { out.push(h('div', { key: i, className: 'bn-li' }, num[1] + '. ' + num[2])); return }
          out.push(h('div', { key: i }, line))
        })
        return out
      }, [text])
      return h('div', { className: 'bn-review' }, nodes)
    }

    function Spinner({ label }) {
      return h('div', { className: 'bn-status' }, h('span', { className: 'bn-spin' }), label)
    }

    // --------------------------------------------------------------- panel ----
    function Panel(props) {
      const [state, setState] = useState(null)
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [title, setTitle] = useState('')
      const [source, setSource] = useState('')
      const [tags, setTags] = useState('')
      const [bodyText, setBodyText] = useState('')
      const [review, setReview] = useState('')
      const [reviewOf, setReviewOf] = useState(null)
      const [expanded, setExpanded] = useState(null)
      const [query, setQuery] = useState('')
      const bodyRef = useRef(null)

      const load = useCallback(async () => {
        try {
          setError('')
          const data = await api('?q=' + encodeURIComponent(query))
          setState(data)
        } catch (err) {
          setError(err.message)
        }
      }, [query])

      useEffect(() => { load() }, [load])

      const runReview = useCallback(async (target) => {
        setBusy('review')
        setError('')
        setReview('')
        try {
          const payload = target
            ? { id: target.id, body: target.body, title: target.title, source: target.source, tags: target.tags }
            : { title, body: bodyText, source, tags: tags.split(/[,，;；\s]+/).filter(Boolean) }
          const res = await api('review', { method: 'POST', body: JSON.stringify(payload) })
          setReview(res.review || '（模型未返回内容）')
          setReviewOf(target ? target.id : null)
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }, [title, bodyText, source, tags])

      const saveNote = useCallback(async () => {
        if (!bodyText.trim()) { setError('请先输入笔记正文'); return }
        setBusy('save')
        setError('')
        try {
          const res = await api('notes', {
            method: 'POST',
            body: JSON.stringify({
              title,
              body: bodyText,
              source,
              tags: tags.split(/[,，;；\s]+/).filter(Boolean),
              review: reviewOf === null ? review : '',
            }),
          })
          setState({ ...res })
          const newId = res.id
          // If a review is on screen for this draft, persist it with the new note.
          if (review && reviewOf === null && newId) {
            const saved = await api('save-review', { method: 'POST', body: JSON.stringify({ id: newId, review }) })
            setState({ ...saved })
          }
          setTitle(''); setSource(''); setTags(''); setBodyText(''); setReview(''); setReviewOf(null)
          bodyRef.current?.focus()
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }, [title, bodyText, source, tags, review, reviewOf])

      const attachReview = useCallback(async (note) => {
        if (!review) return
        setBusy('attach')
        setError('')
        try {
          const res = await api('save-review', { method: 'POST', body: JSON.stringify({ id: note.id, review }) })
          setState({ ...res })
          setReview('')
          setReviewOf(null)
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy('')
        }
      }, [review])

      const notes = state?.notes ?? []

      return h('div', { className: 'bn-root' }, [
        h(Styles, { key: 'css' }),
        h('div', { className: 'bn-head', key: 'head' }, [
          h('span', { className: 'bn-head-title', key: 't' }, '文献知识库 · 轴承钢 RCF'),
          h('button', {
            key: 'r', className: 'bn-btn bn-btn-icon', title: '重新载入',
            onClick: () => load(), disabled: busy !== '',
          }, '↻'),
        ]),
        h('div', { className: 'bn-body', key: 'body' }, [
          error ? h('div', { className: 'bn-err', key: 'err' }, error) : null,

          state ? h('div', { className: 'bn-meta', key: 'meta' }, [
            `共 ${state.total} 条笔记`,
            state.matched !== state.total ? ` · 匹配 ${state.matched} 条` : '',
            h('br', { key: 'br' }),
            'Word 文档：', state.docxPath,
          ]) : h(Spinner, { key: 'meta', label: '正在连接 Host…' }),

          // ---- composer ----
          h('div', { key: 'composer' }, [
            h('div', { className: 'bn-field', key: 'f1' }, [
              h('label', { className: 'bn-label', key: 'l' }, '标题'),
              h('input', {
                className: 'bn-input', value: title, placeholder: '留空则取正文首行',
                onChange: (e) => setTitle(e.target.value),
              }),
            ]),
            h('div', { className: 'bn-field', key: 'f2' }, [
              h('label', { className: 'bn-label', key: 'l' }, '文献来源'),
              h('input', {
                className: 'bn-input', value: source, placeholder: '作者, 期刊 卷 (年) 页',
                onChange: (e) => setSource(e.target.value),
              }),
            ]),
            h('div', { className: 'bn-field', key: 'f3' }, [
              h('label', { className: 'bn-label', key: 'l' }, '标签（空格或逗号分隔）'),
              h('input', {
                className: 'bn-input', value: tags, placeholder: '如：夹杂物 白蚀区 热处理',
                onChange: (e) => setTags(e.target.value),
              }),
            ]),
            h('div', { className: 'bn-field', key: 'f4' }, [
              h('label', { className: 'bn-label', key: 'l' }, '笔记正文（支持 Markdown）'),
              h('textarea', {
                className: 'bn-textarea', ref: bodyRef, value: bodyText,
                placeholder: '把读到的、对自己有用的知识记在这里…',
                onChange: (e) => setBodyText(e.target.value),
              }),
            ]),
            h('div', { className: 'bn-row', key: 'actions' }, [
              h('button', {
                className: 'bn-btn bn-btn-primary', disabled: busy !== '',
                onClick: () => runReview(null),
              }, busy === 'review' ? '审阅中…' : '审阅并提示'),
              h('button', {
                className: 'bn-btn', disabled: busy !== '',
                onClick: saveNote,
              }, busy === 'save' ? '保存中…' : '保存到 Word'),
            ]),
          ]),

          busy === 'review' ? h(Spinner, { key: 'spin', label: '正在调用模型审阅（可能需要十几秒）…' }) : null,

          review ? h('div', { className: 'bn-sec', key: 'review' }, [
            h('div', { className: 'bn-sec-title', key: 'h' }, [
              '知识审阅与延伸',
              reviewOf ? h('span', { className: 'bn-badge', key: 'b' }, reviewOf) : h('span', { className: 'bn-badge', key: 'b' }, '未保存'),
            ]),
            h(Review, { text: review, key: 'r' }),
            h('div', { className: 'bn-row', key: 'a', style: { marginTop: 8 } }, [
              reviewOf
                ? h('button', { className: 'bn-btn', disabled: busy !== '', onClick: () => attachReview({ id: reviewOf }) }, '写入 Word 并保存')
                : h('span', { className: 'bn-status' }, '保存笔记时会一并写入这条审阅。'),
              reviewOf ? h('button', {
                className: 'bn-btn', disabled: busy !== '',
                onClick: () => { setReview(''); setReviewOf(null) },
              }, '清除') : null,
            ]),
          ]) : null,

          // ---- note list ----
          h('div', { className: 'bn-sec', key: 'list' }, [
            h('div', { className: 'bn-sec-title', key: 'h' }, [
              `已记录 (${state?.matched ?? 0})`,
              h('input', {
                className: 'bn-input', style: { width: 120, marginLeft: 'auto', padding: '3px 6px' },
                value: query, placeholder: '搜索…',
                onChange: (e) => setQuery(e.target.value),
              }),
            ]),
            notes.length === 0
              ? h('div', { className: 'bn-empty', key: 'e' }, '还没有笔记。写下第一条，点「审阅并提示」看看效果。')
              : notes.slice().reverse().map((n) => h('div', {
                className: 'bn-note', key: n.id,
                onClick: () => setExpanded(expanded === n.id ? null : n.id),
              }, [
                h('div', { className: 'bn-note-head', key: 'h' }, [
                  h('span', { className: 'bn-note-id', key: 'i' }, n.id),
                  h('span', { className: 'bn-note-title', key: 't' }, n.title),
                  n.review ? h('span', { className: 'bn-badge bn-badge-ok', key: 'b' }, '已审阅') : null,
                ]),
                (n.tags || []).length
                  ? h('div', { key: 'tags' }, (n.tags || []).map((t) => h('span', { className: 'bn-tag', key: t }, t)))
                  : null,
                expanded !== n.id ? h('div', { className: 'bn-note-snip', key: 's' }, n.body) : null,
                expanded === n.id ? h('div', { key: 'full' }, [
                  n.source ? h('div', { className: 'bn-meta', key: 'src' }, '来源：' + n.source) : null,
                  h('div', { key: 'b', style: { whiteSpace: 'pre-wrap', marginTop: 4 } }, n.body),
                  n.review ? h('div', { key: 'rev' }, [
                    h('div', { className: 'bn-sec-title', key: 'rh', style: { marginTop: 10 } }, '知识审阅与延伸'),
                    h(Review, { text: n.review, key: 'rr' }),
                  ]) : null,
                  h('div', { className: 'bn-row', key: 'acts', style: { marginTop: 8 } }, [
                    h('button', {
                      className: 'bn-btn', disabled: busy !== '',
                      onClick: (e) => { e.stopPropagation(); runReview(n) },
                    }, n.review ? '重新审阅' : '审阅并提示'),
                  ]),
                ]) : null,
              ])),
          ]),
        ]),
      ])
    }

    /**
     * Compact button in the conversation header that opens the notes tab.
     *
     * Contributed to the header's `utilities` list seat — a `list` slot, where
     * several plugins coexist. It renders its own copy of the stylesheet because
     * this button is on screen while the panel body is not mounted.
     */
    function OpenButton(props) {
      const [hover, setHover] = useState(false)
      return h(React.Fragment, null, [
        h(Styles, { key: 'css' }),
        h('button', {
          key: 'btn',
          className: 'bn-btn bn-btn-icon',
          title: t('button.title'),
          'aria-label': t('button.aria'),
          style: { marginRight: 4, background: hover ? 'var(--dsw-alias-interactive-bg-active)' : undefined },
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
          onClick: (event) => { event.stopPropagation(); props.openTab?.() },
        }, '📓'),
      ])
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // Copy. `register(ns, { zh, en })` needs both shipped locales; `bind(ns)`
        // yields the framework translator, which slot bodies also get as `t`.
        ctx.inject(['locale'], (scoped) => {
          scoped.effect(() => {
            const bound = scoped.locale.bind(NS)
            boundT = bound
            return () => { if (boundT === bound) boundT = null }
          }, 'bearing-notes: translator')
          scoped.effect(() => scoped.locale.register(NS, {
            zh: COPY.zh,
            en: COPY.en,
          }), 'bearing-notes: copy')
        })

        // 1) Tab type. Registering the type is what makes the tab renderable;
        //    `id` is also the key its body and title register under.
        ctx.inject(['sidebarRightTabs'], (scoped) => {
          scoped.effect(() => scoped.sidebarRightTabs.register({
            id: OWN_ID,
            kind: OWN_KIND,
            priority: 'extension',
            title: () => t('type.label'),
          }), 'bearing-notes: tab type')
        })

        // 2) Tab body, under the id the tab type declares.
        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: OWN_ID,
        }, Panel)), 'bearing-notes: tab body')

        // 3) Tab title.
        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab.title',
          key: OWN_ID,
        }, () => h('span', null, t('type.label')))), 'bearing-notes: tab title')

        // 4) Entry point: a button in the session header. The header's corner
        //    seat is a `single` slot already held by the shipped sidebar-right
        //    expand button (a second registration there throws), so this uses
        //    the `utilities` list seat, which takes one entry per `id`.
        ctx.inject(['sidebarRight'], (scoped) => {
          scoped.effect(() => scoped.slots.inject('conversation.session.header.utilities', () => scoped.slots.register({
            name: 'conversation.session.header.utilities',
            id: OWN_ID,
            order: 30,
            inject: () => ({
              openTab: () => {
                try { scoped.sidebarRight.openTab(OWN_KIND, {}) } catch { /* no on-screen session yet */ }
              },
            }),
          }, OpenButton)), 'bearing-notes: header button')
        })
      },
    }
  },
})
