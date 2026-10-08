// Bilingual glossary for bearing steel & rolling contact fatigue literature.
//
// Why a hand-written glossary instead of "let the model figure it out": the
// same English term has several plausible Chinese renderings, and the wrong one
// is usually still readable — which is exactly how translation errors survive
// review. So the translation prompt is *constrained* by this file: terms found
// in the source text are pinned to one rendering, and the output is checked
// against those pins afterwards.
//
// Entries are `[en, zh, category, abbr?, note?]`. Notes hold the traps: what
// the term is often mistranslated as, or which sense applies in this field.
//
// Provenance: the usage in Bhadeshia (Prog. Mater. Sci. 57 (2012) 268),
// Sadeghi et al. (Wear 255 (2003) 1241), Gegner (Int. Mater. Rev. 56 (2011) 273),
// ISO 15243, ISO 281, GB/T 18254, GB/T 34891, ASTM A295 / E45.

/** Human labels for the entry categories. */
export const CATEGORIES = {
  material: '材料与组织',
  grade: '钢种与牌号',
  process: '冶炼与热处理',
  bearing: '轴承零件与几何',
  contact: '接触力学与润滑',
  failure: '失效模式',
  life: '寿命与统计',
  test: '试验与表征',
  standard: '标准与规范',
}

/** @type {Array<[string,string,string,string?,string?]>} */
const RAW = [
  // ---------------------------------------------------------- material ------
  ['bearing steel', '轴承钢', 'material', undefined, '不是“熊钢”；泛指轴承用钢，具体钢种见 grade 类'],
  ['high-carbon chromium bearing steel', '高碳铬轴承钢', 'material'],
  ['through-hardening bearing steel', '全淬透轴承钢', 'material', undefined, 'through-hardening 是“整体淬透”，不是“通过硬化”'],
  ['carburizing bearing steel', '渗碳轴承钢', 'material'],
  ['case-hardening steel', '表面硬化钢', 'material'],
  ['stainless bearing steel', '不锈轴承钢', 'material'],
  ['austenite', '奥氏体', 'material'],
  ['retained austenite', '残余奥氏体', 'material', undefined, 'retained 译“残余”，不是“保留”'],
  ['prior austenite grain size', '原始奥氏体晶粒度', 'material'],
  ['martensite', '马氏体', 'material'],
  ['tempered martensite', '回火马氏体', 'material'],
  ['bainite', '贝氏体', 'material'],
  ['lower bainite', '下贝氏体', 'material'],
  ['upper bainite', '上贝氏体', 'material'],
  ['pearlite', '珠光体', 'material'],
  ['cementite', '渗碳体', 'material'],
  ['carbide', '碳化物', 'material'],
  ['primary carbide', '一次碳化物', 'material', undefined, '文献中也作“液析碳化物”；与共晶碳化物区分'],
  ['eutectic carbide', '共晶碳化物', 'material'],
  ['network carbide', '网状碳化物', 'material'],
  ['banded carbide', '带状碳化物', 'material'],
  ['spheroidized carbide', '球状碳化物', 'material'],
  ['grain boundary', '晶界', 'material'],
  ['segregation', '偏析', 'material'],
  ['banding', '带状偏析', 'material'],
  ['decarburization', '脱碳', 'material'],
  ['non-metallic inclusion', '非金属夹杂物', 'material', undefined, 'inclusion 是“夹杂物”，不是“包含物”'],
  ['cleanliness', '洁净度', 'material', undefined, '冶金语境是“钢的洁净度”，不是“清洁度”'],
  ['total oxygen content', '总氧含量', 'material'],
  ['hydrogen content', '氢含量', 'material'],
  ['residual stress', '残余应力', 'material'],
  ['compressive residual stress', '残余压应力', 'material'],
  ['tensile residual stress', '残余拉应力', 'material'],
  ['hardness', '硬度', 'material'],
  ['hardness profile', '硬度分布', 'material'],
  ['case depth', '硬化层深度', 'material', undefined, 'case 在热处理语境是“硬化层/表层”，不是“案例”'],
  ['core', '心部', 'material', undefined, 'case 的对立面：心部基体，不是“核心”'],
  ['dimensional stability', '尺寸稳定性', 'material'],
  ['toughness', '韧性', 'material'],
  ['tempering resistance', '抗回火软化性', 'material', undefined, '常与 softening resistance 同义，指高温下抵抗硬度下降'],
  ['microstructure', '显微组织', 'material'],
  ['texture', '织构', 'material'],
  ['dislocation density', '位错密度', 'material'],
  ['nano-crystalline', '纳米晶', 'material'],
  ['grain refinement', '晶粒细化', 'material'],

  // ------------------------------------------------------------- grades -----
  ['GCr15', 'GCr15（≈100Cr6 / SAE 52100 / SUJ2）', 'grade', undefined, '牌号保留原文，只在首次出现时加注对应关系'],
  ['100Cr6', '100Cr6（≈ GCr15）', 'grade'],
  ['SAE 52100', 'SAE 52100（≈ GCr15）', 'grade'],
  ['AISI 52100', 'AISI 52100（≈ GCr15）', 'grade'],
  ['SUJ2', 'SUJ2（日本牌号 ≈ GCr15）', 'grade'],
  ['M50', 'M50（≈ Cr4Mo4V）', 'grade', undefined, '高温轴承钢；不要译成“M50 钢号”以外的意译'],
  ['M50NiL', 'M50NiL（≈ Cr4Mo4Ni4V）', 'grade'],
  ['CSS-42L', 'CSS-42L', 'grade'],
  ['440C', '440C（不锈轴承钢）', 'grade'],
  ['9Cr18', '9Cr18（不锈轴承钢）', 'grade'],
  ['GCr15SiMn', 'GCr15SiMn', 'grade'],
  ['GCr18Mo', 'GCr18Mo', 'grade'],
  ['20CrMnTi', '20CrMnTi（渗碳钢）', 'grade'],
  ['G20CrNi2MoA', 'G20CrNi2MoA（渗碳轴承钢）', 'grade'],
  ['high-speed steel', '高速钢', 'grade'],
  ['tool steel', '工具钢', 'grade'],

  // ------------------------------------------------------------ process -----
  ['electric arc furnace', '电弧炉', 'process', 'EAF'],
  ['electroslag remelting', '电渣重熔', 'process', 'ESR'],
  ['vacuum induction melting', '真空感应熔炼', 'process', 'VIM'],
  ['vacuum arc remelting', '真空自耗重熔', 'process', 'VAR'],
  ['vacuum degassing', '真空脱气', 'process', 'VD'],
  ['vacuum oxygen decarburization', '真空氧脱碳', 'process', 'VOD'],
  ['continuous casting', '连铸', 'process'],
  ['ingot casting', '模铸', 'process'],
  ['hot rolling', '热轧', 'process'],
  ['forging', '锻造', 'process'],
  ['spheroidizing annealing', '球化退火', 'process'],
  ['normalizing', '正火', 'process'],
  ['quenching', '淬火', 'process'],
  ['austenitizing', '奥氏体化', 'process'],
  ['tempering', '回火', 'process'],
  ['low-temperature tempering', '低温回火', 'process'],
  ['temper embrittlement', '回火脆性', 'process'],
  ['austempering', '等温淬火', 'process'],
  ['isothermal transformation', '等温转变', 'process'],
  ['carburizing', '渗碳', 'process'],
  ['carbonitriding', '碳氮共渗', 'process'],
  ['nitriding', '渗氮', 'process'],
  ['induction hardening', '感应淬火', 'process'],
  ['cryogenic treatment', '深冷处理', 'process'],
  ['shot peening', '喷丸强化', 'process'],
  ['surface integrity', '表面完整性', 'process'],
  ['grinding burn', '磨削烧伤', 'process'],
  ['superfinishing', '超精加工', 'process'],
  ['honing', '珩磨', 'process'],
  ['stress relief', '去应力（处理）', 'process', undefined, 'relief 是“消除/降低”，不是“缓解”'],

  // ------------------------------------------------------------ bearing -----
  ['rolling bearing', '滚动轴承', 'bearing'],
  ['rolling element', '滚动体', 'bearing'],
  ['ball bearing', '球轴承', 'bearing'],
  ['roller bearing', '滚子轴承', 'bearing'],
  ['tapered roller', '圆锥滚子', 'bearing'],
  ['cylindrical roller', '圆柱滚子', 'bearing'],
  ['inner ring', '内圈', 'bearing'],
  ['outer ring', '外圈', 'bearing'],
  ['raceway', '滚道', 'bearing'],
  ['cage', '保持架', 'bearing'],
  ['retainer', '保持架', 'bearing'],
  ['contact ellipse', '接触椭圆', 'bearing'],
  ['contact patch', '接触斑', 'bearing'],
  ['contact half-width', '接触半宽', 'bearing'],
  ['misalignment', '偏斜', 'bearing', undefined, '轴承语境是“偏斜/不对中”，不是“失准”'],
  ['preload', '预紧', 'bearing'],
  ['radial load', '径向载荷', 'bearing'],
  ['axial load', '轴向载荷', 'bearing'],
  ['dynamic load rating', '额定动载荷', 'bearing'],
  ['basic rating life', '基本额定寿命', 'bearing'],

  // ------------------------------------------------------------ contact -----
  ['rolling contact', '滚动接触', 'contact'],
  ['Hertzian contact', '赫兹接触', 'contact'],
  ['contact pressure', '接触压力', 'contact'],
  ['contact stress', '接触应力', 'contact'],
  ['maximum shear stress', '最大剪应力', 'contact', undefined, '剪应力比“切应力”更常见于中文轴承文献，二者同义'],
  ['orthogonal shear stress', '正交剪应力', 'contact'],
  ['equivalent stress', '等效应力', 'contact'],
  ['subsurface', '次表面', 'contact', undefined, '不要译成“地下/表面下”；次表面是行业惯用词'],
  ['depth of maximum shear stress', '最大剪应力深度', 'contact'],
  ['slide-to-roll ratio', '滑差率', 'contact', 'SRR', '不要与 slip ratio 混用；SRR 定义为滑差速度与平均速度之比'],
  ['sliding', '滑移', 'contact'],
  ['spin', '自旋', 'contact', undefined, '轴承运动学中的 spin，不是“旋转”'],
  ['ratcheting', '棘轮效应', 'contact', undefined, '指循环载荷下的塑性应变累积，不是机械棘轮'],
  ['shakedown', '安定', 'contact', undefined, '力学中的 shakedown（安定状态/安定极限），不要译“抖松”'],
  ['stress concentration', '应力集中', 'contact'],
  ['elastohydrodynamic lubrication', '弹性流体动压润滑', 'contact', 'EHL'],
  ['film thickness', '膜厚', 'contact'],
  ['lambda ratio', '膜厚比', 'contact', 'Λ'],
  ['boundary lubrication', '边界润滑', 'contact'],
  ['mixed lubrication', '混合润滑', 'contact'],
  ['starved lubrication', '乏油润滑', 'contact', undefined, '不是“饥饿润滑”'],
  ['tribofilm', '摩擦膜', 'contact', undefined, '摩擦化学反应的产物膜，不是“摩擦薄膜”'],
  ['anti-wear additive', '抗磨添加剂', 'contact', 'AW'],
  ['extreme pressure additive', '极压添加剂', 'contact', 'EP'],
  ['friction coefficient', '摩擦系数', 'contact'],
  ['traction', '牵引力', 'contact', undefined, '接触区的切向力，不是“牵引（车）”'],
  ['surface roughness', '表面粗糙度', 'contact'],
  ['asperity', '微凸体', 'contact'],
  ['debris', '磨屑', 'contact', undefined, '污染物颗粒/磨屑，不是“碎片”'],
  ['contamination', '污染', 'contact'],
  ['dent', '压痕', 'contact', undefined, '外来颗粒造成的压痕'],

  // ------------------------------------------------------------ failure -----
  ['rolling contact fatigue', '滚动接触疲劳', 'failure', 'RCF'],
  ['spalling', '剥落', 'failure', undefined, '不是“碎裂”；fatigue spalling 即疲劳剥落'],
  ['flaking', '剥落', 'failure', undefined, '与 spalling 近义，指片状剥落'],
  ['pitting', '点蚀', 'failure', undefined, '不是“凹坑”'],
  ['micropitting', '微点蚀', 'failure'],
  ['surface-initiated', '表面起源', 'failure'],
  ['subsurface-initiated', '次表面起源', 'failure'],
  ['crack initiation', '裂纹萌生', 'failure'],
  ['crack propagation', '裂纹扩展', 'failure'],
  ['butterfly', '蝴蝶组织', 'failure', undefined, 'RCF 语境指夹杂物周围的蝴蝶状白蚀组织，不是昆虫'],
  ['white etching area', '白蚀区', 'failure', 'WEA', '曾有文献误译“白色腐蚀区”；etching 是金相侵蚀'],
  ['white etching band', '白蚀带', 'failure', 'WEB'],
  ['white etching crack', '白蚀裂纹', 'failure', 'WEC'],
  ['dark etching area', '暗蚀区', 'failure', 'DEA'],
  ['dark etching region', '暗蚀区', 'failure', 'DER'],
  ['hydrogen embrittlement', '氢脆', 'failure'],
  ['hydrogen trapping', '氢陷阱', 'failure'],
  ['fatigue limit', '疲劳极限', 'failure'],
  ['premature failure', '早期失效', 'failure'],
  ['adhesive wear', '粘着磨损', 'failure'],
  ['abrasive wear', '磨粒磨损', 'failure'],
  ['scuffing', '胶合', 'failure'],
  ['smearing', '涂抹', 'failure', undefined, '表面材料转移形成的涂抹层'],
  ['false brinelling', '伪压痕', 'failure', undefined, '微动磨损造成的假性布氏压痕，不是“假布氏硬度”'],
  ['fretting', '微动磨损', 'failure'],
  ['electrical erosion', '电蚀', 'failure'],
  ['case crushing', '硬化层压碎', 'failure'],
  ['indentation', '压痕', 'failure'],

  // --------------------------------------------------------------- life -----
  ['rating life', '额定寿命', 'life'],
  ['L10 life', 'L10 寿命', 'life', 'L10', '90% 可靠度寿命，不是“平均寿命”或“最小寿命”'],
  ['L50 life', 'L50 寿命', 'life', 'L50', '中位寿命，不要与 L10 混用'],
  ['median life', '中位寿命', 'life'],
  ['Weibull distribution', '威布尔分布', 'life'],
  ['Weibull slope', '威布尔斜率', 'life'],
  ['characteristic life', '特征寿命', 'life'],
  ['reliability', '可靠度', 'life'],
  ['survival probability', '存活概率', 'life'],
  ['accelerated life test', '加速寿命试验', 'life'],
  ['scatter', '离散性', 'life', undefined, '寿命数据的分散性，不是“散射”'],
  ['dispersion', '离散性', 'life', undefined, '统计语境，不是“色散”'],
  ['confidence level', '置信度', 'life'],
  ['load spectrum', '载荷谱', 'life'],
  ['fatigue load limit', '疲劳载荷极限', 'life'],
  ['life modification factor', '寿命修正系数', 'life', 'a_iso', 'ISO 281 的 a_iso 综合润滑、污染与载荷极限，不是“材料系数”'],

  // --------------------------------------------------------------- test -----
  ['test rig', '试验台', 'test'],
  ['twin-disc', '双盘（试验机）', 'test'],
  ['two-roll', '双辊', 'test'],
  ['thrust bearing test rig', '推力轴承试验机', 'test'],
  ['four-ball test', '四球试验', 'test'],
  ['ball-on-rod', '球-棒试验', 'test'],
  ['scanning electron microscopy', '扫描电镜', 'test', 'SEM'],
  ['energy dispersive spectroscopy', '能谱分析', 'test', 'EDS'],
  ['electron backscatter diffraction', '电子背散射衍射', 'test', 'EBSD'],
  ['transmission electron microscopy', '透射电镜', 'test', 'TEM'],
  ['X-ray diffraction', 'X 射线衍射', 'test', 'XRD'],
  ['metallography', '金相分析', 'test'],
  ['microhardness', '显微硬度', 'test'],
  ['Vickers hardness', '维氏硬度', 'test', 'HV'],
  ['Rockwell hardness', '洛氏硬度', 'test', 'HRC'],
  ['fractography', '断口分析', 'test'],
  ['acoustic emission', '声发射', 'test', 'AE'],
  ['non-destructive testing', '无损检测', 'test', 'NDT'],
  ['inclusion rating', '夹杂物评级', 'test'],
  ['hardness traverse', '硬度梯度测量', 'test'],

  // ----------------------------------------------------------- standard -----
  ['ISO 281', 'ISO 281（额定寿命与修正寿命）', 'standard'],
  ['ISO 15243', 'ISO 15243（轴承损伤与失效术语）', 'standard'],
  ['ISO 4967', 'ISO 4967（夹杂物评级）', 'standard'],
  ['ASTM E45', 'ASTM E45（夹杂物评级）', 'standard'],
  ['ASTM A295', 'ASTM A295（高碳抗摩擦轴承钢）', 'standard'],
  ['GB/T 18254', 'GB/T 18254（高碳铬轴承钢）', 'standard'],
  ['GB/T 10561', 'GB/T 10561（夹杂物评级）', 'standard'],
  ['GB/T 34891', 'GB/T 34891（轴承零件热处理技术条件）', 'standard'],
]

/** Normalized glossary entries. */
export const GLOSSARY = RAW.map(([en, zh, category, abbr, note]) => ({
  en, zh, category, ...(abbr === undefined ? {} : { abbr }), ...(note === undefined ? {} : { note }),
}))

/**
 * Tokens that must survive translation untouched: grade designations, symbols,
 * standards and units. Leaving them in Latin script is correct Chinese
 * technical writing, and translating them is a hard error.
 */
export const DO_NOT_TRANSLATE = [
  { pattern: '\\b(?:GCr\\d+[A-Za-z]*|\\d+Cr\\d+Mo\\d*V?\\d*[A-Za-z]*|SAE\\s?\\d{5}|AISI\\s?\\d{3,5}|SUJ\\d|100Cr\\d|440C|9Cr18|CSS-42L|M50(?:NiL)?|SKF|NSK|NTN|Timken|Schaeffler|FAG|ZYS)\\b', reason: '钢种牌号与厂商名保留原文' },
  { pattern: '\\bL(?:10|50)\\b|\\ba_?iso\\b|\\bΛ\\b|\\bτ(?:yz|max)\\b|\\bR_a\\b|\\bHV\\d*\\b|\\bHRC\\b', reason: '寿命/力学符号保留原文' },
  { pattern: '\\b(?:ISO|ASTM|GB/T|DIN|JIS|SEP|AISI|SAE)\\s?[A-Z]?\\s?\\d+(?:[-–]\\d+)*', reason: '标准号保留原文' },
  { pattern: '\\b\\d+(?:\\.\\d+)?\\s?(?:wt\\.?%|at\\.?%|ppm|µm|μm|mm|MPa|GPa|HV|HRC|rpm|N\\b|°C)', reason: '量与单位保留原文' },
]

/**
 * Renderings that look plausible and are wrong. They are fed to the model as
 * explicit "do not do this" examples, because a fluent mistranslation is the
 * failure mode this whole file exists to prevent.
 */
export const MISTRANSLATIONS = [
  { wrong: '白色腐蚀区', right: '白蚀区', term: 'white etching area' },
  { wrong: '包含物', right: '夹杂物', term: 'inclusion' },
  { wrong: '清洁度', right: '洁净度', term: 'cleanliness (of steel)' },
  { wrong: '碎裂', right: '剥落', term: 'spalling' },
  { wrong: '凹坑', right: '点蚀', term: 'pitting' },
  { wrong: '通过硬化', right: '全淬透', term: 'through-hardening' },
  { wrong: '饥饿润滑', right: '乏油润滑', term: 'starved lubrication' },
  { wrong: '摩擦薄膜', right: '摩擦膜', term: 'tribofilm' },
  { wrong: '案例 / 外壳', right: '硬化层 / 表层', term: 'case' },
  { wrong: '核心', right: '心部', term: 'core' },
  { wrong: '抖动 / 抖松', right: '安定', term: 'shakedown' },
  { wrong: '机械棘轮', right: '棘轮效应（循环塑性累积）', term: 'ratcheting' },
  { wrong: '碎片', right: '磨屑', term: 'debris' },
  { wrong: '假布氏硬度', right: '伪压痕', term: 'false brinelling' },
  { wrong: '牵引（车辆）', right: '牵引力（接触区切向力）', term: 'traction' },
  { wrong: '散射 / 色散', right: '离散性', term: 'scatter / dispersion (life data)' },
  { wrong: '旋转', right: '自旋', term: 'spin (bearing kinematics)' },
  { wrong: '保留奥氏体', right: '残余奥氏体', term: 'retained austenite' },
  { wrong: '缓解应力', right: '去应力 / 降低应力', term: 'stress relief' },
]

/** Case-insensitive index for fast lookup (en, abbr and zh). */
const INDEX = (() => {
  const map = new Map()
  const put = (key, entry) => {
    if (typeof key !== 'string' || key === '') return
    const normalized = key.toLowerCase()
    // Longest entry wins for a key, so "rolling contact fatigue" beats "contact".
    const current = map.get(normalized)
    if (current === undefined || entry.en.length > current.en.length) map.set(normalized, entry)
  }
  for (const entry of GLOSSARY) {
    put(entry.en, entry)
    put(entry.abbr, entry)
    put(entry.zh, entry)
  }
  return map
})()

/** Exact lookup by English term, abbreviation or Chinese term. */
export function lookup(term) {
  if (typeof term !== 'string') return undefined
  return INDEX.get(term.trim().toLowerCase())
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Word-boundary matcher tolerant of hyphen/space variants and plurals. */
function matcherFor(term) {
  const body = escapeRegExp(term)
    .replace(/\s+/g, '[\\s-]+')
    .replace(/\\-\\s\+/g, '[\\s-]+')
  return new RegExp(`(?<![\\w-])${body}(?:s|es)?(?![\\w-])`, 'gi')
}

/**
 * Glossary entries whose English term (or abbreviation) occurs in `text`.
 * Longest match wins; overlapping shorter matches are dropped.
 *
 * @param {string} text
 * @param {{limit?:number, minLength?:number}} [options]
 * @returns {Array<{en:string,zh:string,abbr?:string,note?:string,category:string,count:number}>}
 */
export function findTerms(text, options = {}) {
  const source = String(text ?? '')
  if (source.trim() === '') return []
  const limit = options.limit ?? 40
  const minLength = options.minLength ?? 3
  const found = []
  for (const entry of GLOSSARY) {
    if (entry.en.length < minLength && entry.abbr === undefined) continue
    const needles = [entry.en, ...(entry.abbr === undefined ? [] : [entry.abbr])]
    let count = 0
    for (const needle of needles) {
      if (needle.replace(/[^A-Za-z0-9]/g, '').length < 3) continue
      const matches = source.match(matcherFor(needle))
      if (matches !== null) count += matches.length
    }
    if (count > 0) found.push({ ...entry, count, span: entry.en.length })
  }
  found.sort((a, b) => b.span - a.span || b.count - a.count)
  // Overlapping entries are kept on purpose: "maximum shear stress" occurs
  // inside "depth of maximum shear stress", and pinning both makes the
  // post-check able to catch either rendering going missing.
  return found.slice(0, limit).map(({ span, ...entry }) => entry)
}

/** The glossary entries that must appear in a translation of `text`. */
export function requiredTerms(text, direction = 'zh', options = {}) {
  const terms = findTerms(text, options)
  const needle = direction === 'zh' ? 'zh' : 'en'
  return terms.filter((term) => {
    const value = needle === 'zh' ? term.zh : term.en
    // Single-letter abbreviations (Λ, L10) are not a reliable post-check on the
    // Chinese side; keep them as prompt constraints only.
    return typeof value === 'string' && value.trim() !== '' && (needle !== 'zh' || /[\u4e00-\u9fa5]/.test(value))
  })
}

/**
 * Verify a translation kept every pinned term. Returns the ones that are
 * missing so the caller can retry with a stricter instruction.
 */
export function verifyTerms(translation, terms, direction = 'zh') {
  const output = String(translation ?? '')
  const needle = direction === 'zh' ? 'zh' : 'en'
  const missing = []
  for (const term of terms) {
    const expected = term[needle]
    if (typeof expected !== 'string' || expected.trim() === '') continue
    // A glossary rendering may carry an annotation ("GCr15（≈100Cr6…）"); the
    // part before the bracket is what must appear.
    const core = expected.split(/[（(]/)[0].trim()
    if (core === '') continue
    const variants = [core, core.replace(/\s*(?:（[^）]*）|\([^)]*\))\s*/g, '')].filter(Boolean)
    if (!variants.some((variant) => output.includes(variant))) missing.push(term)
  }
  return { missing, ok: missing.length === 0 }
}

/** DO-NOT-TRANSLATE hits in a text, for the prompt and the response. */
export function protectedTokens(text) {
  const source = String(text ?? '')
  const hits = []
  for (const rule of DO_NOT_TRANSLATE) {
    const matches = source.match(new RegExp(rule.pattern, 'g'))
    if (matches === null) continue
    for (const value of new Set(matches)) hits.push({ value, reason: rule.reason })
  }
  return hits
}

/** Small report used by the tests, the panel's term list and diagnostics. */
export function glossaryStats() {
  const byCategory = {}
  for (const entry of GLOSSARY) byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1
  return { total: GLOSSARY.length, byCategory, protectedRules: DO_NOT_TRANSLATE.length, mistranslations: MISTRANSLATIONS.length }
}
