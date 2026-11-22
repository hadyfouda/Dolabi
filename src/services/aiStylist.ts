/**
 * Engine B — optional AI stylist (Gemini or Claude).
 * Only lightweight metadata JSON is sent (never the images).
 */
import { CATEGORY_LABELS, OCCASION_LABELS, WEATHER_LABELS } from '../labels';
import type { AppSettings, GenerateRequest } from '../types';
import { activeApiKey } from './settings';

export interface AiOutfit {
  itemIds: number[];
  title: string;
  reasonAr: string;
  shoeTipAr: string;
}

const TIMEOUT_MS = 30000;

const SYSTEM_PROMPT = `انت ستايليست رجالي مصري شاطر. هتاخد قائمة هدوم متاحة (JSON) وترجّع أطقم لايقة.
قواعد إلزامية:
- كل طقم فيه بنطلون واحد بالظبط، وقطعة علوية واحدة على الأقل (shirt أو tshirt أو pullover).
- ممنوع قطعتين من نفس الطبقة: قميص/تيشيرت واحد بس، بلوفر واحد، جاكيت واحد، جزمة واحدة.
- أقصى حاجة قطعة واحدة منقوشة (pattern مش solid) في الطقم.
- القميص تحت البلوفر، والجاكيت فوق القميص أو التيشيرت أو البلوفر. راعي الرسمية والمناسبة والجو.
- لازم كل طقم يحتوي على كل القطع المثبتة (pinnedIds).
- ابعد عن تكرار التركيبات اللي اتلبست قريب (recentlyWorn).
- استخدم بس الـ id الموجودين في القائمة.
اكتب الشرح بالعامية المصرية، قصير وواضح (جملتين لتلاتة) وقول ليه الألوان والقطع ماشية مع بعض.
ورجّع JSON فقط بالشكل ده بدون أي كلام تاني:
{"outfits":[{"itemIds":[1,2,3],"title":"عنوان قصير","reasonAr":"الشرح","shoeTipAr":"نصيحة لون الجزمة والحزام"}]}
رجّع من 2 لـ 3 أطقم مختلفة عن بعض بوضوح، مترتبين من الأحسن للأقل.`;

function buildUserPrompt(req: GenerateRequest): string {
  const inventory = req.pool.map((i) => ({
    id: i.id,
    category: i.category,
    categoryAr: CATEGORY_LABELS[i.category],
    color: i.colorName,
    hex: i.colorHex,
    pattern: i.pattern,
    formality: i.formality,
    season: i.season,
  }));
  const payload = {
    occasion: req.occasion ? OCCASION_LABELS[req.occasion] : 'مش محددة (اختار الأنسب للقطع المتاحة)',
    weather: req.weather ? WEATHER_LABELS[req.weather] : 'مش محدد',
    pinnedIds: req.pinnedIds,
    recentlyWorn: req.recentWear.map((r) => r.itemIds),
    inventory,
  };
  return JSON.stringify(payload);
}

// ---------- response parsing (strict, no `any`) ----------

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI response had no JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function parseAiOutfits(text: string): AiOutfit[] {
  const parsed = extractJson(text);
  if (!isRec(parsed) || !Array.isArray(parsed.outfits)) throw new Error('AI response missing outfits');
  const result: AiOutfit[] = [];
  for (const o of parsed.outfits) {
    if (!isRec(o) || !Array.isArray(o.itemIds)) continue;
    const ids = o.itemIds.map((x) => (typeof x === 'string' ? Number(x) : x)).filter((x): x is number => typeof x === 'number' && Number.isInteger(x));
    result.push({
      itemIds: [...new Set(ids)],
      title: typeof o.title === 'string' && o.title.trim() ? o.title.trim().slice(0, 40) : 'اقتراح الستايليست',
      reasonAr: typeof o.reasonAr === 'string' ? o.reasonAr.trim() : '',
      shoeTipAr: typeof o.shoeTipAr === 'string' ? o.shoeTipAr.trim() : '',
    });
  }
  return result;
}

// ---------- providers ----------

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function errorText(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (isRec(body) && isRec(body.error) && typeof body.error.message === 'string') return body.error.message;
  } catch {
    // ignore
  }
  return `HTTP ${res.status}`;
}

async function callGemini(key: string, model: string, user: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini: ${await errorText(res)}`);
  const body: unknown = await res.json();
  if (isRec(body) && Array.isArray(body.candidates)) {
    const cand: unknown = body.candidates[0];
    if (isRec(cand) && isRec(cand.content) && Array.isArray(cand.content.parts)) {
      const text = cand.content.parts
        .map((p: unknown) => (isRec(p) && typeof p.text === 'string' ? p.text : ''))
        .join('');
      if (text) return text;
    }
  }
  throw new Error('Gemini: empty response');
}

async function callAnthropic(key: string, model: string, user: string): Promise<string> {
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // required for calling the API directly from a browser with the user's own key
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude: ${await errorText(res)}`);
  const body: unknown = await res.json();
  if (isRec(body) && Array.isArray(body.content)) {
    const text = body.content
      .map((b: unknown) => (isRec(b) && b.type === 'text' && typeof b.text === 'string' ? b.text : ''))
      .join('');
    if (text) return text;
  }
  throw new Error('Claude: empty response');
}

export async function generateWithAi(req: GenerateRequest, settings: AppSettings): Promise<AiOutfit[]> {
  const key = activeApiKey(settings);
  const user = buildUserPrompt(req);
  const text =
    settings.aiProvider === 'gemini'
      ? await callGemini(key, settings.geminiModel.trim() || 'gemini-3.6-flash', user)
      : await callAnthropic(key, settings.anthropicModel.trim() || 'claude-haiku-5-5', user);
  return parseAiOutfits(text);
}

/** Tiny round-trip used by the Settings "test key" button. */
export async function testAiConnection(settings: AppSettings): Promise<void> {
  const key = activeApiKey(settings);
  const probe = 'رد بكلمة واحدة: تمام';
  if (settings.aiProvider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.geminiModel.trim())}:generateContent`;
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: probe }] }] }),
    });
    if (!res.ok) throw new Error(await errorText(res));
  } else {
    await callAnthropic(key, settings.anthropicModel.trim(), probe);
  }
}
