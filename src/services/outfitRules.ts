/**
 * Engine A — built-in menswear styling ruleset (works 100% offline).
 *
 * Each candidate outfit is built from layer slots
 *   outer (jacket) → mid (pullover) → inner (shirt | t-shirt) → pants → shoes
 * and scored on: color harmony, light/dark contrast, pattern discipline,
 * layering logic, formality coherence, occasion, weather and recent-wear repetition.
 * Every rule that fires leaves a human Arabic reason, so the UI can explain *why*.
 */
import { colorProfile, type ColorKey, type PaletteColor } from './colorUtils';
import { CATEGORY_LABELS, LAYER_ORDER } from '../labels';
import type {
  Category,
  Formality,
  GenerateRequest,
  Occasion,
  OutfitSuggestion,
  StoredItem,
  Weather,
  WearRecord,
} from '../types';

// ---------- types ----------

type ReasonTag = 'classic' | 'contrast' | 'mono' | 'layer' | 'tonal' | 'casual' | 'formal' | 'balance' | 'weather';

interface Reason {
  text: string;
  weight: number;
  tag: ReasonTag;
}

interface Candidate {
  inner?: StoredItem;
  mid?: StoredItem;
  outer?: StoredItem;
  pants: StoredItem;
  shoes?: StoredItem;
}

interface Scored {
  candidate: Candidate;
  score: number;
  reasons: Reason[];
  warnings: string[];
}

const FORMALITY_LEVEL: Record<Formality, number> = { casual: 0, smart_casual: 1, formal: 2 };
const DAY_MS = 24 * 60 * 60 * 1000;
export const RECENT_WEAR_DAYS = 3;

// ---------- color harmony knowledge ----------

interface PairRule {
  score: number;
  text: string;
  tag: ReasonTag;
}

const PAIR_RULES = new Map<string, PairRule>();

function pairKey(a: ColorKey, b: ColorKey): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function rule(a: ColorKey, b: ColorKey, score: number, text: string, tag: ReasonTag = 'classic'): void {
  PAIR_RULES.set(pairKey(a, b), { score, text, tag });
}

// — proven combos —
rule('navy', 'grey', 3, 'الكحلي مع الرصاصي تركيبة كلاسيك مضمونة — هادية وشيك.');
rule('navy', 'lightgrey', 2.6, 'الكحلي مع الرمادي الفاتح هادي ومريح للعين.');
rule('navy', 'white', 3, 'الكحلي والأبيض أنضف كونتراست في اللبس الرجالي.', 'contrast');
rule('navy', 'offwhite', 2.8, 'الكحلي مع الأوف وايت شيك وأنعم من الأبيض الصريح.', 'contrast');
rule('navy', 'beige', 2.8, 'الكحلي مع البيج تركيبة دافية وأنيقة.');
rule('navy', 'khaki', 2.5, 'الكحلي مع الكاكي ستايل سمارت كاجوال كلاسيك.');
rule('navy', 'camel', 2.6, 'الكحلي مع الجملي من أشيك التركيبات الشتوي.');
rule('navy', 'lightblue', 2.6, 'الأزرق الفاتح مع الكحلي درجات من نفس العيلة — متناسقين جدًا.', 'tonal');
rule('navy', 'pink', 1.8, 'البينك الهادي مع الكحلي لمسة لون محسوبة.');
rule('navy', 'burgundy', 1.6, 'النبيتي مع الكحلي تركيبة غامقة وغنية.');
rule('navy', 'olive', 1.2, 'الزيتي مع الكحلي تركيبة هادية لو في قطعة فاتحة معاهم.');
rule('navy', 'denim', 0.6, 'الكحلي مع الجينز درجات أزرق متقاربة.', 'tonal');
rule('grey', 'white', 2.6, 'الأبيض مع الرصاصي نضيف وبسيط.');
rule('grey', 'black', 2.8, 'الأسود مع الرصاصي مونوكروم شيك — والرصاصي بيكسر غمق الأسود.', 'mono');
rule('grey', 'charcoal', 1.8, 'درجتين رمادي (فاتح وغامق) — لوك توناليتي هادي.', 'mono');
rule('grey', 'lightgrey', 1.2, 'درجات الرمادي مع بعض هادية بس محتاجة قطعة تكسرها.', 'mono');
rule('grey', 'burgundy', 2.5, 'النبيتي مع الرصاصي تركيبة شتوي فخمة.');
rule('grey', 'lightblue', 2.5, 'الأزرق الفاتح مع الرصاصي منعش وسمارت.');
rule('grey', 'pink', 2.2, 'البينك مع الرصاصي ستايل عصري وهادي.');
rule('grey', 'olive', 1.6, 'الزيتي مع الرصاصي هادي ومتوازن.');
rule('grey', 'camel', 2.2, 'الجملي مع الرصاصي دافي وشيك.');
rule('grey', 'denim', 2, 'الجينز مع الرصاصي كاجوال نضيف.');
rule('grey', 'beige', 1.4, 'البيج مع الرصاصي هادي ومحايد.');
rule('black', 'white', 2.8, 'الأبيض والأسود كونتراست حاد وواضح — ستايل مينيمال.', 'contrast');
rule('black', 'offwhite', 2.4, 'الأوف وايت مع الأسود كونتراست أنعم وأشيك.', 'contrast');
rule('black', 'lightgrey', 2.6, 'الرمادي الفاتح مع الأسود مونوكروم بكونتراست لطيف.', 'mono');
rule('black', 'charcoal', 1.2, 'أسود مع فحمي — مونوكروم غامق جريء.', 'mono');
rule('black', 'camel', 2.4, 'الجملي مع الأسود تركيبة أنيقة جدًا.');
rule('black', 'olive', 2.2, 'الزيتي مع الأسود ستايل عصري.');
rule('black', 'beige', 2, 'البيج مع الأسود كونتراست دافي.', 'contrast');
rule('black', 'denim', 2, 'الجينز مع الأسود كاجوال مضمون.', 'casual');
rule('black', 'burgundy', 1.6, 'النبيتي مع الأسود لوك سهرة غامق.');
rule('black', 'lightblue', 1.6, 'الأزرق الفاتح بيفتّح الأسود.');
rule('black', 'pink', 1.6, 'البينك مع الأسود لمسة لون جريئة ومحسوبة.');
rule('charcoal', 'white', 2.6, 'الأبيض مع الفحمي كونتراست شيك.', 'contrast');
rule('charcoal', 'lightblue', 2.5, 'الأزرق الفاتح مع الفحمي كلاسيك مكاتب.');
rule('charcoal', 'pink', 2, 'البينك مع الفحمي لمسة لطيفة.');
rule('charcoal', 'burgundy', 2, 'النبيتي مع الفحمي غني وشتوي.');
rule('charcoal', 'beige', 1.8, 'البيج مع الفحمي متوازن.');
rule('beige', 'white', 2.2, 'البيج مع الأبيض ستايل صيفي هادي.', 'tonal');
rule('beige', 'brown', 2.2, 'البني مع البيج درجات إيرثي متناسقة.', 'tonal');
rule('beige', 'olive', 2.4, 'الزيتي مع البيج تركيبة إيرثي جميلة.', 'tonal');
rule('beige', 'burgundy', 2.2, 'النبيتي مع البيج دافي وأنيق.');
rule('beige', 'lightblue', 2.2, 'الأزرق الفاتح مع البيج منعش وصيفي.');
rule('beige', 'denim', 2, 'الجينز مع البيج كاجوال مريح.', 'casual');
rule('olive', 'white', 2.4, 'الزيتي مع الأبيض نضيف وعصري.', 'contrast');
rule('olive', 'offwhite', 2.4, 'الزيتي مع الأوف وايت تركيبة إيرثي ناعمة.');
rule('olive', 'khaki', 1.4, 'الزيتي مع الكاكي درجات إيرثي.', 'tonal');
rule('olive', 'denim', 1.8, 'الزيتي مع الجينز كاجوال عملي.', 'casual');
rule('olive', 'camel', 1.6, 'الزيتي مع الجملي دافي.', 'tonal');
rule('brown', 'white', 2.2, 'البني مع الأبيض كلاسيك.');
rule('brown', 'offwhite', 2.2, 'البني مع الأوف وايت دافي وناعم.');
rule('brown', 'lightblue', 2.4, 'الأزرق الفاتح مع البني تركيبة إيطالي كلاسيك.');
rule('brown', 'khaki', 1.6, 'البني مع الكاكي درجات إيرثي.', 'tonal');
rule('brown', 'denim', 2, 'البني مع الجينز كاجوال مضمون.', 'casual');
rule('brown', 'navy', 1.8, 'البني مع الكحلي تركيبة إيطالي محترمة.');
rule('khaki', 'white', 2.2, 'الكاكي مع الأبيض صيفي ونضيف.');
rule('khaki', 'lightblue', 2.3, 'الأزرق الفاتح مع الكاكي سمارت كاجوال مثالي.');
rule('denim', 'white', 2.4, 'الجينز والأبيض أبسط وأنضف كاجوال.', 'casual');
rule('denim', 'lightgrey', 2, 'الجينز مع الرمادي الفاتح هادي.', 'casual');
rule('denim', 'burgundy', 2, 'النبيتي مع الجينز لمسة لون حلوة.');
rule('denim', 'camel', 2, 'الجملي مع الجينز شتوي كاجوال.');
rule('camel', 'white', 2.2, 'الجملي مع الأبيض نضيف ودافي.');
rule('blue', 'white', 2.2, 'الأزرق مع الأبيض منعش.', 'contrast');
rule('blue', 'grey', 2, 'الأزرق مع الرصاصي هادي.');
rule('blue', 'beige', 2, 'الأزرق مع البيج متوازن.');
rule('lightblue', 'white', 1.6, 'الأزرق الفاتح مع الأبيض صيفي فاتح.', 'tonal');

// — clashes —
rule('navy', 'black', -3, 'الكحلي الغامق جنب الأسود بيبانوا لون واحد باهت.');
rule('brown', 'black', -2, 'البني جنب الأسود غالبًا بيتخانقوا.');
rule('green', 'red', -3, 'الأخضر مع الأحمر صارخين مع بعض.');
rule('red', 'pink', -2, 'الأحمر مع البينك متضاربين.');
rule('red', 'burgundy', -1.5, 'الأحمر مع النبيتي قريبين ومتضاربين.');
rule('red', 'mustard', -2, 'الأحمر مع المستردة زحمة ألوان.');
rule('olive', 'green', -1.2, 'درجتين أخضر قريبين بيعملوا تضارب.');
rule('navy', 'charcoal', -1, 'الكحلي مع الفحمي غامقين ومتقاربين زيادة.');
rule('brown', 'burgundy', -0.8, 'البني مع النبيتي غامقين ومتقاربين.');
rule('navy', 'green', -0.8, 'الكحلي مع الأخضر الغامق تقيلين على بعض.');

interface PairResult {
  score: number;
  reason?: Reason;
}

function colorPair(a: PaletteColor, b: PaletteColor, hasLightSeparator: boolean): PairResult {
  if (a.key === b.key) {
    if (a.key === 'black') return { score: 0.4 };
    if (a.tone === 'neutral') return { score: -0.6 };
    return {
      score: -1.5,
      reason: { text: `ال${a.nameAr} فوق وتحت من غير كونتراست بيبان ماتشي زيادة.`, weight: -1.5, tag: 'balance' },
    };
  }
  const known = PAIR_RULES.get(pairKey(a.key, b.key));
  if (known) {
    let score = known.score;
    let text = known.text;
    // Intentional contrast: a light piece separating navy & black makes it work.
    if (pairKey(a.key, b.key) === pairKey('navy', 'black') && hasLightSeparator) {
      score = -0.4;
      text = 'الكحلي مع الأسود ماشيين هنا لأن القطعة الفاتحة عاملة فاصل واضح بينهم.';
    }
    return { score, reason: { text, weight: score, tag: known.tag } };
  }
  if (a.tone === 'bold' && b.tone === 'bold') {
    return { score: -2.5, reason: { text: 'لونين صارخين مع بعض بيزحموا الطقم.', weight: -2.5, tag: 'balance' } };
  }
  if (a.tone === 'neutral' || b.tone === 'neutral') {
    const neutral = a.tone === 'neutral' ? a : b;
    return { score: 1.2, reason: { text: `ال${neutral.nameAr} لون محايد بيمشي مع أي حاجة.`, weight: 0.6, tag: 'balance' } };
  }
  if (a.tone === b.tone && (a.tone === 'earth' || a.tone === 'cool')) {
    return { score: 0.8, reason: { text: 'درجات من نفس عيلة الألوان — متناسقين.', weight: 0.6, tag: 'tonal' } };
  }
  if ((a.tone === 'earth' && b.tone === 'cool') || (a.tone === 'cool' && b.tone === 'earth')) return { score: 0.5 };
  return { score: 0 };
}

// ---------- helpers ----------

const profileCache = new Map<number, PaletteColor>();
function prof(item: StoredItem): PaletteColor {
  const cached = profileCache.get(item.id);
  if (cached && cached.nameAr === item.colorName) return cached;
  const p = colorProfile(item.colorName, item.colorHex);
  profileCache.set(item.id, p);
  return p;
}

function coreItems(c: Candidate): StoredItem[] {
  return [c.outer, c.mid, c.inner, c.pants].filter((x): x is StoredItem => Boolean(x));
}

function allItems(c: Candidate): StoredItem[] {
  return [...coreItems(c), ...(c.shoes ? [c.shoes] : [])];
}

function visibleTop(c: Candidate): StoredItem | undefined {
  return c.outer ?? c.mid ?? c.inner;
}

function label(item: StoredItem): string {
  return `${CATEGORY_LABELS[item.category]} ال${item.colorName}`;
}

export function outfitDisplayName(items: StoredItem[]): string {
  return sortByLayer(items)
    .filter((i) => i.category !== 'accessory')
    .map((i) => `${CATEGORY_LABELS[i.category]} ${i.colorName}`)
    .join(' + ');
}

export function sortByLayer<T extends { category: Category }>(items: T[]): T[] {
  return [...items].sort((a, b) => LAYER_ORDER.indexOf(a.category) - LAYER_ORDER.indexOf(b.category));
}

// ---------- scoring ----------

interface Context {
  occasion?: Occasion;
  weather?: Weather;
  poolHasLayers: boolean;
  pinned: Set<number>;
  recent: WearRecord[];
  now: number;
}

function scoreCandidate(c: Candidate, ctx: Context): Scored | null {
  const reasons: Reason[] = [];
  const warnings: string[] = [];
  let score = 0;
  const add = (pts: number, text?: string, tag: ReasonTag = 'balance', weight = pts) => {
    score += pts;
    if (text) reasons.push({ text, weight, tag });
  };

  const core = coreItems(c);
  const top = visibleTop(c);
  if (!top || (!c.inner && !c.mid)) return null; // need a real top layer under any jacket

  // --- pattern discipline: max ONE patterned piece ---
  const patterned = core.filter((i) => i.pattern !== 'solid');
  if (patterned.length > 1) {
    const allPinned = patterned.every((i) => ctx.pinned.has(i.id));
    if (!allPinned) return null;
    add(-5);
    warnings.push('فيه أكتر من قطعة منقوشة — الأفضل قطعة واحدة بس بنقشة.');
  } else if (patterned.length === 1) {
    add(0.6, `ال${CATEGORY_LABELS[patterned[0].category]} هو القطعة الوحيدة اللي فيها نقشة والباقي سادة — ده التوازن الصح.`, 'balance', 0.9);
  } else {
    add(0.3, 'كل القطع سادة فالطقم نضيف ومرتب.', 'balance', 0.35);
  }

  // --- color harmony (weighted by how visible the two pieces are together) ---
  const profiles = core.map(prof);
  const hasLight = profiles.some((p) => p.depth === 'light');
  const pairs: Array<[StoredItem, StoredItem, number]> = [[top, c.pants, 1]];
  if (c.inner && c.mid) pairs.push([c.inner, c.mid, 0.85]);
  if (c.mid && c.outer) pairs.push([c.mid, c.outer, 0.7]);
  if (c.inner && c.outer && !c.mid) pairs.push([c.inner, c.outer, 0.85]);
  if (c.inner && c.inner !== top) pairs.push([c.inner, c.pants, 0.4]);
  if (c.mid && c.mid !== top) pairs.push([c.mid, c.pants, 0.5]);

  for (const [a, b, w] of pairs) {
    const pa = prof(a);
    const pb = prof(b);
    // shirt & pullover in the same color hides the collar
    if (pa.key === pb.key && a.category !== 'pants' && b.category !== 'pants') {
      add(-1.5 * w, `ال${CATEGORY_LABELS[a.category]} وال${CATEGORY_LABELS[b.category]} نفس اللون فالطبقات مش هتبان.`, 'balance');
      continue;
    }
    const res = colorPair(pa, pb, hasLight);
    score += res.score * w;
    if (res.reason) reasons.push({ ...res.reason, weight: res.reason.weight * w });
  }

  // --- light/dark balance ---
  const depths = new Set(profiles.map((p) => p.depth));
  const allNeutralMono = profiles.every((p) => ['black', 'charcoal', 'grey', 'lightgrey', 'white'].includes(p.key));
  if (depths.size === 1 && depths.has('dark')) {
    if (allNeutralMono) {
      add(ctx.occasion === 'evening' ? 1 : -0.4, ctx.occasion === 'evening' ? 'لوك غامق بالكامل — مناسب جدًا للسهرة.' : undefined, 'mono');
    } else {
      add(-2, 'الطقم كله غامق ومحتاج قطعة فاتحة تكسره.');
    }
  } else if (depths.size === 1 && depths.has('light')) {
    add(ctx.weather === 'hot' ? -0.3 : -1, ctx.weather === 'hot' ? undefined : 'الطقم كله فاتح ومحتاج قطعة غامقة تعمل توازن.');
  } else if (depths.has('light') && depths.has('dark')) {
    add(1, 'فيه توازن حلو بين الفاتح والغامق.', 'contrast', 0.7);
  }
  const bolds = new Set(profiles.filter((p) => p.tone === 'bold').map((p) => p.key));
  if (bolds.size > 1) add(-2);

  // --- layering logic ---
  if (c.inner && c.mid) {
    if (prof(c.inner).key === prof(c.mid).key) {
      add(-1.5); // same color: collar disappears (reason already given by the color pass)
    } else if (c.inner.category === 'shirt') {
      add(2, `ياقة ال${label(c.inner)} طالعة من البلوفر — طبقات سمارت ومظبوطة.`, 'layer', 2);
    } else if (ctx.occasion === 'casual' || ctx.occasion === undefined) {
      add(0.3);
    } else {
      add(-1, 'التيشيرت تحت البلوفر كاجوال زيادة للخروجة دي — القميص أحسن.', 'layer');
    }
  }
  if (c.mid && !c.inner && ctx.occasion === 'work') add(-1.5, 'للشغل يفضل يكون تحت البلوفر قميص بياقة.', 'layer');
  if (c.outer) {
    const under = c.mid ?? c.inner;
    if (under?.category === 'shirt') add(1.5, 'الجاكيت فوق القميص بيدي شكل متكامل ومترتب.', 'layer', 1.4);
    else if (under?.category === 'tshirt') {
      if (ctx.occasion === 'work' || ctx.occasion === 'evening') add(-1.5, 'جاكيت فوق تيشيرت كاجوال زيادة للمناسبة دي.', 'layer');
      else add(0.8, 'جاكيت فوق تيشيرت لوك كاجوال عصري.', 'casual', 0.9);
    } else if (under?.category === 'pullover') {
      add(ctx.weather === 'cold' ? 1 : -0.5, ctx.weather === 'cold' ? 'جاكيت فوق بلوفر — دفا وشياكة في نفس الوقت.' : undefined, 'layer');
    }
    if (c.inner && c.mid) add(ctx.weather === 'cold' ? 0.8 : -2, ctx.weather === 'cold' ? undefined : '3 طبقات كتير على الجو ده.', 'weather');
  }

  // --- formality coherence ---
  const levels = core.map((i) => FORMALITY_LEVEL[i.formality]);
  const spread = Math.max(...levels) - Math.min(...levels);
  if (spread >= 2) add(-3, 'فيه قطعة رسمية جدًا مع قطعة كاجوال جدًا — مش راكبين على بعض.', 'formal');
  else if (spread === 0) add(0.5);

  // --- occasion ---
  const casualCount = core.filter((i) => i.formality === 'casual').length;
  const formalCount = core.filter((i) => i.formality === 'formal').length;
  switch (ctx.occasion) {
    case 'work':
      add(-2 * casualCount);
      if (top.category === 'tshirt') add(-3, 'للشغل القميص أنسب بكتير من التيشيرت.', 'formal');
      if (casualCount === 0) add(1, 'القطع كلها مناسبة لجو الشغل.', 'formal', 0.8);
      break;
    case 'smart_casual':
      add(-0.8 * casualCount - 0.3 * formalCount);
      if (c.inner?.category === 'shirt' && core.every((i) => i.formality !== 'formal')) {
        add(0.8, 'قميص من غير رسمية زيادة — ده بالظبط السمارت كاجوال.', 'formal', 0.8);
      }
      break;
    case 'casual':
      add(-1 * formalCount + 0.4 * casualCount);
      if (formalCount === 0) add(0.5, 'لوك مريح ومناسب لخروجة كاجوال.', 'casual', 0.5);
      break;
    case 'evening':
      if (top.category === 'tshirt' && !c.outer) add(-1.5);
      if (prof(top).depth === 'dark') add(1, 'الألوان الغامقة فوق أشيك للسهرة.', 'formal', 0.9);
      break;
    default:
      break;
  }

  // --- weather ---
  const hasLayer = Boolean(c.mid || c.outer);
  switch (ctx.weather) {
    case 'hot':
      for (const i of core) if (i.season === 'winter') add(-2);
      if (top.category === 'tshirt' || top.category === 'shirt') add(0.4);
      break;
    case 'cold':
      if (!hasLayer) add(-3, undefined);
      else add(1.5, 'طبقات تدفّي من غير ما تبقى تقيلة.', 'weather', 0.8);
      for (const i of core) if (i.season === 'summer') add(-1.2);
      break;
    case 'mild':
      for (const i of core) if (i.season !== 'all') add(-0.3);
      break;
    default:
      // Quick-pick: if the user laid out a pullover/jacket, they probably want to wear it.
      if (ctx.poolHasLayers && hasLayer) add(1);
      break;
  }

  // --- repetition penalty (combos worn in the last 3 days) ---
  const coreIds = new Set(core.map((i) => i.id));
  for (const rec of ctx.recent) {
    if (ctx.now - rec.wornAt > RECENT_WEAR_DAYS * DAY_MS) continue;
    const worn = new Set(rec.itemIds);
    const overlap = [...coreIds].filter((id) => worn.has(id)).length;
    if (overlap === coreIds.size) {
      add(-8);
      warnings.push('الطقم ده اتلبس في آخر 3 أيام.');
    } else if (worn.has(top.id) && worn.has(c.pants.id)) {
      add(-4);
    } else {
      add(-0.6 * overlap);
    }
  }

  return { candidate: c, score, reasons, warnings: [...new Set(warnings)] };
}

// ---------- shoes ----------

function scoreShoes(shoes: StoredItem, c: Candidate, ctx: Context): number {
  const ps = prof(shoes);
  const pp = prof(c.pants);
  let s = 0;
  if (pp.key === 'black' && ps.key === 'brown') s -= 3;
  if (pp.key === 'black' && ps.key === 'black') s += 2;
  if (['navy', 'grey', 'charcoal'].includes(pp.key) && ['brown', 'black', 'burgundy'].includes(ps.key)) s += 2;
  if (['beige', 'khaki', 'olive', 'camel', 'denim'].includes(pp.key) && ['brown', 'camel', 'white'].includes(ps.key)) s += 2;
  if (ps.key === 'white') s += ctx.occasion === 'work' || ctx.occasion === 'evening' ? -1.5 : 1;
  if (ps.key === pp.key && ps.tone !== 'neutral') s -= 0.5;
  const avg = coreItems(c).reduce((sum, i) => sum + FORMALITY_LEVEL[i.formality], 0) / coreItems(c).length;
  s -= Math.abs(FORMALITY_LEVEL[shoes.formality] - avg);
  return s;
}

export function shoeTip(pants: StoredItem, occasion: Occasion | undefined, shoes?: StoredItem): string {
  if (shoes) {
    const ps = prof(shoes);
    return `ال${CATEGORY_LABELS.shoes} ال${shoes.colorName} ماشية مع البنطلون ال${pants.colorName}؛ خلّي الحزام نفس لون الجزمة (${ps.key === 'white' ? 'أو حزام جلد بني فاتح' : ps.nameAr}).`;
  }
  const p = prof(pants);
  const casual = occasion === 'casual';
  const dressy = occasion === 'work' || occasion === 'evening';
  if (p.key === 'black') {
    return casual
      ? 'كوتشي أبيض أو أسود سادة، والحزام أسود. بلاش بني مع البنطلون الأسود.'
      : 'جزمة سوداء جلد وحزام أسود — بلاش بني مع البنطلون الأسود.';
  }
  if (['navy', 'grey', 'charcoal', 'lightgrey'].includes(p.key)) {
    if (casual) return 'كوتشي أبيض نضيف أو سويد بني، والحزام بني.';
    return dressy && occasion === 'evening'
      ? 'جزمة سوداء أو بني غامق جلد لامع، والحزام بنفس لون الجزمة بالظبط.'
      : 'جزمة بني غامق أو أسود جلد، والحزام بنفس لون الجزمة.';
  }
  if (['beige', 'khaki', 'olive', 'camel', 'brown'].includes(p.key)) {
    return casual
      ? 'كوتشي أبيض أو بوت سويد بني، والحزام بني.'
      : 'جزمة بني أو سويد جملي، والحزام بني بنفس الدرجة.';
  }
  if (p.key === 'denim' || p.key === 'blue') return 'كوتشي أبيض أو بوت بني، والحزام بني جلد.';
  if (p.depth === 'light') return 'لوفر بني فاتح أو كوتشي أبيض، والحزام بني فاتح.';
  return 'جزمة بني أو سوداء سادة، والحزام دايمًا بنفس لون الجزمة.';
}

// ---------- titles & explanation ----------

const TITLES: Record<ReasonTag, string> = {
  classic: 'كلاسيك مضمون',
  contrast: 'كونتراست واضح',
  mono: 'مونوكروم هادي',
  layer: 'طبقات سمارت',
  tonal: 'درجات متناسقة',
  casual: 'كاجوال مريح',
  formal: 'شيك ومحترم',
  balance: 'طقم متوازن',
  weather: 'دافي وشيك',
};

function compose(s: Scored): { title: string; reasonAr: string } {
  const positives = s.reasons
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .filter((r, i, arr) => arr.findIndex((x) => x.text === r.text) === i);
  const top = positives.slice(0, 3);
  const title = TITLES[top[0]?.tag ?? 'balance'];
  const negatives = s.reasons.filter((r) => r.weight <= -1.4).sort((a, b) => a.weight - b.weight);
  let reasonAr = top.length ? top.map((r) => r.text).join(' ') : 'تركيبة بسيطة ومتوازنة.';
  if (negatives.length && s.warnings.length === 0) reasonAr += ` ملاحظة: ${negatives[0].text}`;
  return { title, reasonAr };
}

// ---------- generation ----------

function slotOf(item: StoredItem): keyof Candidate | null {
  switch (item.category) {
    case 'shirt':
    case 'tshirt':
      return 'inner';
    case 'pullover':
      return 'mid';
    case 'jacket':
      return 'outer';
    case 'pants':
      return 'pants';
    case 'shoes':
      return 'shoes';
    default:
      return null;
  }
}

export interface RulesOutput {
  suggestions: OutfitSuggestion[];
  errorAr?: string;
}

const MAX_COMBOS = 60000;

export function generateWithRules(req: GenerateRequest, maxResults = 3): RulesOutput {
  const pinned = new Set(req.pinnedIds);
  const pool = req.pool;
  const bySlot: Record<'inner' | 'mid' | 'outer' | 'pants' | 'shoes', StoredItem[]> = {
    inner: [],
    mid: [],
    outer: [],
    pants: [],
    shoes: [],
  };
  const accessoriesPinned: StoredItem[] = [];
  for (const item of pool) {
    const slot = slotOf(item);
    if (slot) bySlot[slot].push(item);
    else if (pinned.has(item.id)) accessoriesPinned.push(item);
  }

  // pinned items fix their slot
  const pinnedBySlot = new Map<string, StoredItem>();
  for (const item of pool) {
    if (!pinned.has(item.id)) continue;
    const slot = slotOf(item);
    if (!slot) continue;
    if (pinnedBySlot.has(slot)) {
      return { suggestions: [], errorAr: 'مينفعش تثبّت قطعتين من نفس النوع (زي قميصين) في نفس الطقم.' };
    }
    pinnedBySlot.set(slot, item);
  }

  if (bySlot.pants.length === 0) return { suggestions: [], errorAr: 'محتاجين بنطلون واحد على الأقل متاح.' };
  if (bySlot.inner.length + bySlot.mid.length === 0) {
    return { suggestions: [], errorAr: 'محتاجين قميص أو تيشيرت أو بلوفر واحد على الأقل متاح.' };
  }

  const ctx: Context = {
    occasion: req.occasion,
    weather: req.weather,
    poolHasLayers: bySlot.mid.length + bySlot.outer.length > 0,
    pinned,
    recent: req.recentWear,
    now: Date.now(),
  };

  // Hot weather: no pullovers/jackets unless the user pinned one.
  const allowLayers = req.weather !== 'hot';
  const options = <T,>(slot: string, list: T[], optional: boolean, allow = true): Array<T | undefined> => {
    const fixed = pinnedBySlot.get(slot) as T | undefined;
    if (fixed) return [fixed];
    const base: Array<T | undefined> = allow ? [...list] : [];
    if (optional) base.unshift(undefined);
    return base.length ? base : [undefined];
  };

  let inners = options('inner', bySlot.inner, true);
  let mids = options('mid', bySlot.mid, true, allowLayers);
  let outers = options('outer', bySlot.outer, true, allowLayers);
  let pantsList = options('pants', bySlot.pants, false) as StoredItem[];

  // prune very large wardrobes
  const total = inners.length * mids.length * outers.length * pantsList.length;
  if (total > MAX_COMBOS) {
    const cap = Math.max(4, Math.floor(Math.cbrt(MAX_COMBOS / pantsList.length)));
    const sample = <T,>(arr: T[]) => (arr.length > cap ? [arr[0], ...shuffle(arr.slice(1)).slice(0, cap - 1)] : arr);
    inners = sample(inners);
    mids = sample(mids);
    outers = sample(outers);
    if (pantsList.length > 12) pantsList = shuffle(pantsList).slice(0, 12);
  }

  const scored: Scored[] = [];
  for (const pants of pantsList) {
    if (!pants) continue;
    for (const inner of inners) {
      for (const mid of mids) {
        for (const outer of outers) {
          const s = scoreCandidate({ inner, mid, outer, pants }, ctx);
          if (s) scored.push(s);
        }
      }
    }
  }

  if (scored.length === 0) {
    return { suggestions: [], errorAr: 'مقدرناش نطلع طقم لايق من القطع دي — جرّب تضيف قطع تانية أو تشيل التثبيت.' };
  }

  scored.sort((a, b) => b.score - a.score);

  // Pick 2–3 *distinct* outfits (must differ by ≥ 2 core pieces, relaxed to ≥ 1 if needed).
  const picks: Scored[] = [];
  const differs = (a: Scored, b: Scored, min: number) => {
    const A = new Set(coreItems(a.candidate).map((i) => i.id));
    const B = new Set(coreItems(b.candidate).map((i) => i.id));
    const diff = [...A].filter((x) => !B.has(x)).length + [...B].filter((x) => !A.has(x)).length;
    return diff >= min;
  };
  const best = scored[0].score;
  const passes: Array<{ min: number; floor: number }> = [
    { min: 3, floor: -Infinity },
    { min: 2, floor: best - 7 }, // only accept a less-distinct extra outfit if it's still decent
    { min: 1, floor: -Infinity },
  ];
  for (const { min, floor } of passes) {
    if (min === 1 && picks.length >= 2) break;
    for (const s of scored) {
      if (picks.length >= maxResults) break;
      if (picks.includes(s) || s.score < floor) continue;
      if (picks.every((p) => differs(p, s, min))) picks.push(s);
    }
  }

  picks.sort((a, b) => b.score - a.score);

  // shoes per outfit
  const fixedShoes = pinnedBySlot.get('shoes');
  for (const p of picks) {
    if (fixedShoes) p.candidate.shoes = fixedShoes;
    else if (bySlot.shoes.length) {
      let best: StoredItem | undefined;
      let bestScore = -Infinity;
      for (const sh of bySlot.shoes) {
        const sc = scoreShoes(sh, p.candidate, ctx);
        if (sc > bestScore) {
          bestScore = sc;
          best = sh;
        }
      }
      if (best && bestScore > -2) p.candidate.shoes = best;
    }
  }

  const suggestions: OutfitSuggestion[] = picks.map((p) => {
    const items = [...allItems(p.candidate), ...accessoriesPinned];
    const { title, reasonAr } = compose(p);
    const ids = sortByLayer(items).map((i) => i.id);
    return {
      key: `rules-${ids.join('-')}`,
      itemIds: ids,
      title,
      reasonAr,
      shoeTipAr: shoeTip(p.candidate.pants, req.occasion, p.candidate.shoes),
      score: Math.round(p.score * 10) / 10,
      source: 'rules',
      warnings: p.warnings,
    };
  });

  return { suggestions };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Validate an externally produced outfit (AI) against hard rules. Returns error text or null. */
export function validateOutfitIds(ids: number[], poolById: Map<number, StoredItem>, pinned: number[]): string | null {
  const items = ids.map((id) => poolById.get(id));
  if (items.some((i) => !i)) return 'unknown id';
  const list = items as StoredItem[];
  const count = (cats: Category[]) => list.filter((i) => cats.includes(i.category)).length;
  if (count(['pants']) !== 1) return 'needs exactly one pants';
  if (count(['shirt', 'tshirt']) > 1 || count(['pullover']) > 1 || count(['jacket']) > 1 || count(['shoes']) > 1) {
    return 'duplicate layer';
  }
  if (count(['shirt', 'tshirt', 'pullover']) === 0) return 'needs a top';
  if (list.filter((i) => i.pattern !== 'solid' && i.category !== 'shoes' && i.category !== 'accessory').length > 1) {
    return 'too many patterns';
  }
  if (!pinned.every((p) => ids.includes(p))) return 'missing pinned';
  return null;
}
