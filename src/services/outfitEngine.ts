/**
 * Dual-mode outfit engine.
 *   Engine A (default, offline): built-in menswear ruleset  → ./outfitRules.ts
 *   Engine B (optional):         Gemini / Claude stylist    → ./aiStylist.ts
 * Engine B always falls back to Engine A when offline, on timeout, or on any error.
 */
import { generateWithAi } from './aiStylist';
import { generateWithRules, shoeTip, sortByLayer, validateOutfitIds } from './outfitRules';
import { getSettings, isAiReady } from './settings';
import type { GenerateRequest, GenerateResult, OutfitSuggestion, StoredItem } from '../types';
import { setKey } from '../db/wardrobeDb';

export { outfitDisplayName, sortByLayer, RECENT_WEAR_DAYS } from './outfitRules';

export async function generateOutfits(req: GenerateRequest): Promise<GenerateResult> {
  const settings = getSettings();
  const rules = generateWithRules(req);

  if (!isAiReady(settings)) {
    return { suggestions: rules.suggestions, source: 'rules', errorAr: rules.suggestions.length ? undefined : rules.errorAr };
  }
  if (!navigator.onLine) {
    return {
      suggestions: rules.suggestions,
      source: 'rules',
      fallbackReason: 'مفيش نت دلوقتي — استخدمنا المنسّق الداخلي.',
      errorAr: rules.suggestions.length ? undefined : rules.errorAr,
    };
  }
  if (rules.errorAr && rules.suggestions.length === 0 && /تثبّت/.test(rules.errorAr)) {
    // hard user error (e.g. two pinned shirts) — no point asking the AI
    return { suggestions: [], source: 'rules', errorAr: rules.errorAr };
  }

  try {
    const aiOutfits = await generateWithAi(req, settings);
    const byId = new Map<number, StoredItem>(req.pool.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const aiSuggestions: OutfitSuggestion[] = [];
    for (const o of aiOutfits) {
      if (validateOutfitIds(o.itemIds, byId, req.pinnedIds)) continue;
      const k = setKey(o.itemIds);
      if (seen.has(k)) continue;
      seen.add(k);
      const items = sortByLayer(o.itemIds.map((id) => byId.get(id)).filter((x): x is StoredItem => Boolean(x)));
      const pants = items.find((i) => i.category === 'pants');
      const shoes = items.find((i) => i.category === 'shoes');
      aiSuggestions.push({
        key: `ai-${k}`,
        itemIds: items.map((i) => i.id),
        title: o.title,
        reasonAr: o.reasonAr || 'اقتراح من الستايليست الذكي.',
        shoeTipAr: o.shoeTipAr || (pants ? shoeTip(pants, req.occasion, shoes) : ''),
        score: 0,
        source: 'ai',
        warnings: [],
      });
      if (aiSuggestions.length >= 3) break;
    }

    if (aiSuggestions.length === 0) throw new Error('AI returned no valid outfits');

    // top up to at least 2 with distinct rule-based outfits
    for (const r of rules.suggestions) {
      if (aiSuggestions.length >= 2) break;
      const k = setKey(r.itemIds);
      if (!seen.has(k)) {
        seen.add(k);
        aiSuggestions.push(r);
      }
    }
    return { suggestions: aiSuggestions, source: 'ai' };
  } catch (err) {
    console.warn('[dolabi] AI stylist failed, falling back to rules:', err);
    const msg = err instanceof Error && /401|403|API key|invalid/i.test(err.message)
      ? 'مفتاح الـ AI مش شغال — راجع الإعدادات. استخدمنا المنسّق الداخلي.'
      : 'الستايليست الذكي مردّش — استخدمنا المنسّق الداخلي.';
    return {
      suggestions: rules.suggestions,
      source: 'rules',
      fallbackReason: msg,
      errorAr: rules.suggestions.length ? undefined : rules.errorAr,
    };
  }
}
