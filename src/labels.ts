import type { Category, Formality, Occasion, Pattern, Season, Weather } from './types';

export const CATEGORY_LABELS: Record<Category, string> = {
  shirt: 'قميص',
  pullover: 'بلوفر',
  tshirt: 'تيشيرت',
  jacket: 'جاكيت',
  pants: 'بنطلون',
  shoes: 'جزمة',
  accessory: 'إكسسوار',
};

export const CATEGORY_PLURAL: Record<Category, string> = {
  shirt: 'قمصان',
  pullover: 'بلوفرات',
  tshirt: 'تيشيرتات',
  jacket: 'جواكت',
  pants: 'بناطيل',
  shoes: 'جزم',
  accessory: 'إكسسوارات',
};

export const CATEGORY_ORDER: Category[] = ['shirt', 'tshirt', 'pullover', 'jacket', 'pants', 'shoes', 'accessory'];

/** Visual layering order for outfit stacks (outermost top → bottom). */
export const LAYER_ORDER: Category[] = ['jacket', 'pullover', 'shirt', 'tshirt', 'pants', 'shoes', 'accessory'];

export const PATTERN_LABELS: Record<Pattern, string> = {
  solid: 'سادة',
  striped: 'مقلّم',
  checkered: 'كاروهات',
  patterned: 'منقوش',
};

export const FORMALITY_LABELS: Record<Formality, string> = {
  formal: 'رسمي',
  smart_casual: 'سمارت كاجوال',
  casual: 'كاجوال',
};

export const SEASON_LABELS: Record<Season, string> = {
  summer: 'صيفي',
  winter: 'شتوي',
  all: 'كل المواسم',
};

export const OCCASION_LABELS: Record<Occasion, string> = {
  work: 'شغل',
  smart_casual: 'سمارت كاجوال',
  casual: 'كاجوال',
  evening: 'سهرة',
};

export const WEATHER_LABELS: Record<Weather, string> = {
  cold: 'برد - طبقات',
  mild: 'معتدل',
  hot: 'حر',
};

export const DEFAULT_FORMALITY: Record<Category, Formality> = {
  shirt: 'smart_casual',
  tshirt: 'casual',
  pullover: 'smart_casual',
  jacket: 'smart_casual',
  pants: 'smart_casual',
  shoes: 'smart_casual',
  accessory: 'smart_casual',
};

export const DEFAULT_SEASON: Record<Category, Season> = {
  shirt: 'all',
  tshirt: 'summer',
  pullover: 'winter',
  jacket: 'winter',
  pants: 'all',
  shoes: 'all',
  accessory: 'all',
};

export function itemLabel(category: Category, colorName: string): string {
  return `${CATEGORY_LABELS[category]} ${colorName}`;
}
