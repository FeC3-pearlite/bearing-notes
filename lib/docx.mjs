// Minimal, dependency-free .docx (WordprocessingML) writer.
//
// A .docx is an OPC package: a ZIP holding [Content_Types].xml, package
// relationships, and word/document.xml. We assemble the ZIP by hand (stored
// entries + a hand-rolled CRC-32) so appending a note needs no npm install.
import { deflateRawSync } from 'node:zlib'

// ---------------------------------------------------------------- CRC-32 ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

// ------------------------------------------------------------------ ZIP -----
const DOS_TIME = 0 // 00:00:00
const DOS_DATE = 0x2821 // 2000-01-01

function zipEntry(name, data) {
  const nameBuf = Buffer.from(name, 'utf8')
  const crc = crc32(data)

  const local = Buffer.alloc(30 + nameBuf.length)
  local.writeUInt32LE(0x04034b50, 0) // local file header
  local.writeUInt16LE(20, 4) // version needed
  local.writeUInt16LE(0x0800, 6) // UTF-8 names
  local.writeUInt16LE(0, 8) // stored (no compression)
  local.writeUInt16LE(DOS_TIME, 10)
  local.writeUInt16LE(DOS_DATE, 12)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(nameBuf.length, 26)
  local.writeUInt16LE(0, 28)
  nameBuf.copy(local, 30)

  const central = Buffer.alloc(46 + nameBuf.length)
  central.writeUInt32LE(0x02014b50, 0) // central directory header
  central.writeUInt16LE(20, 4) // version made by
  central.writeUInt16LE(20, 6) // version needed
  central.writeUInt16LE(0x0800, 8)
  central.writeUInt16LE(0, 10)
  central.writeUInt16LE(DOS_TIME, 12)
  central.writeUInt16LE(DOS_DATE, 14)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(nameBuf.length, 28)
  central.writeUInt16LE(0, 30) // extra len
  central.writeUInt16LE(0, 32) // comment len
  central.writeUInt16LE(0, 34) // disk number
  central.writeUInt16LE(0, 36) // internal attrs
  central.writeUInt32LE(0, 38) // external attrs
  central.writeUInt32LE(0, 42) // local header offset (patched below)
  nameBuf.copy(central, 46)

  return { local, central, data }
}

export function makeZip(files) {
  const parts = []
  const centrals = []
  let offset = 0
  for (const [name, content] of files) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
    const e = zipEntry(name, data)
    e.central.writeUInt32LE(offset, 42)
    parts.push(e.local, e.data)
    centrals.push(e.central)
    offset += e.local.length + e.data.length
  }
  const centralBuf = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0) // end of central directory
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(centrals.length, 8)
  end.writeUInt16LE(centrals.length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...parts, centralBuf, end])
}

export function readZip(buf) {
  // Locate the end-of-central-directory record.
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not a ZIP: no end-of-central-directory record')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = new Map()
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory at ' + p)
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOff = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const lNameLen = buf.readUInt16LE(localOff + 26)
    const lExtraLen = buf.readUInt16LE(localOff + 28)
    const dataStart = localOff + 30 + lNameLen + lExtraLen
    const raw = buf.subarray(dataStart, dataStart + compSize)
    files.set(name, { method, raw })
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

// ------------------------------------------------------------ XML helpers ---
export function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // strip characters Word rejects in XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

const FONT = 'Times New Roman'
const FONT_CJK = '宋体'

function run(text, { bold = false, italic = false, size = 21, color = null, mono = false } = {}) {
  const rpr = [
    '<w:rFonts w:ascii="' + FONT + '" w:hAnsi="' + FONT + '" w:eastAsia="' + FONT_CJK + '"/>',
    bold ? '<w:b/>' : '',
    italic ? '<w:i/>' : '',
    color ? '<w:color w:val="' + color + '"/>' : '',
    mono ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : '',
    '<w:sz w:val="' + size + '"/>',
    '<w:szCs w:val="' + size + '"/>',
  ].join('')
  const parts = xmlEscape(text).split('\n')
  const body = parts
    .map((line, i) => (i === 0 ? '' : '<w:br/>') + '<w:t xml:space="preserve">' + line + '</w:t>')
    .join('')
  return '<w:r><w:rPr>' + rpr + '</w:rPr>' + body + '</w:r>'
}

function para(content, { style = null, spacingBefore = 0, spacingAfter = 60, indent = 0, align = null } = {}) {
  const ppr = [
    style ? '<w:pStyle w:val="' + style + '"/>' : '',
    '<w:spacing w:before="' + spacingBefore + '" w:after="' + spacingAfter + '" w:line="276" w:lineRule="auto"/>',
    indent ? '<w:ind w:left="' + indent + '"/>' : '',
    align ? '<w:jc w:val="' + align + '"/>' : '',
  ].join('')
  return '<w:p><w:pPr>' + ppr + '</w:pPr>' + content + '</w:p>'
}

// Convert a light subset of Markdown to WordprocessingML paragraphs.
export function markdownToParagraphs(md) {
  const out = []
  const lines = String(md ?? '').replace(/\r\n?/g, '\n').split('\n')
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) { out.push(para('')); continue }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      out.push(para(run(h[2], { bold: true, size: level <= 2 ? 28 : 24 }),
        { style: 'Heading' + Math.min(level, 3), spacingBefore: 160, spacingAfter: 80 }))
      continue
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(line)
    if (bullet) { out.push(para(run('• ' + bullet[1]), { indent: 360 })); continue }
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(line)
    if (numbered) { out.push(para(run(numbered[1] + '. ' + numbered[2]), { indent: 360 })); continue }
    out.push(para(inlineRuns(line)))
  }
  return out.join('')
}

// Inline **bold**, *italic*, `code`.
function inlineRuns(text) {
  const parts = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(run(text.slice(last, m.index)))
    const tok = m[0]
    if (tok.startsWith('**')) parts.push(run(tok.slice(2, -2), { bold: true }))
    else if (tok.startsWith('`')) parts.push(run(tok.slice(1, -1), { mono: true, size: 19, color: '8B3A00' }))
    else parts.push(run(tok.slice(1, -1), { italic: true }))
    last = m.index + tok.length
  }
  if (last < text.length) parts.push(run(text.slice(last)))
  return parts.join('')
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT_CJK}" w:cs="${FONT}"/>
<w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
<w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
<w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/>
<w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>
<w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
</w:styles>`

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function buildDocx(bodyXml, { title = 'Document', author = 'DSH' } = {}) {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
    bodyXml +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="1440" w:right="1418" w:bottom="1440" w:left="1418" w:header="851" w:footer="992" w:gutter="0"/>` +
    `</w:sectPr></w:body></w:document>`

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xmlEscape(title)}</dc:title><dc:creator>${xmlEscape(author)}</dc:creator>
<cp:lastModifiedBy>${xmlEscape(author)}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`

  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>DeepSeek Harness</Application></Properties>`

  return makeZip([
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', ROOT_RELS],
    ['word/_rels/document.xml.rels', DOC_RELS],
    ['word/document.xml', document],
    ['word/styles.xml', STYLES],
    ['docProps/core.xml', core],
    ['docProps/app.xml', app],
  ])
}

export function readDocxBody(buf) {
  const files = readZip(buf)
  const doc = files.get('word/document.xml')
  if (!doc) throw new Error('no word/document.xml in package')
  const xml = doc.method === 8 ? require('node:zlib').inflateRawSync(doc.raw).toString('utf8') : doc.raw.toString('utf8')
  const m = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)
  if (!m) throw new Error('no <w:body> in document.xml')
  return m[1].replace(/<w:sectPr[\s\S]*?<\/w:sectPr>\s*$/, '')
}

export { run, para, crc32 }
