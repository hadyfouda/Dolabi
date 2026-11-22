/**
 * Menswear color palette + perceptual (CIE Lab) nearest-color matching
 * and dominant color extraction from garment pixels.
 */

export type ColorKey =
  | 'white'
  | 'offwhite'
  | 'lightgrey'
  | 'grey'
  | 'charcoal'
  | 'black'
  | 'navy'
  | 'denim'
  | 'blue'
  | 'lightblue'
  | 'beige'
  | 'khaki'
  | 'camel'
  | 'brown'
  | 'olive'
  | 'green'
  | 'burgundy'
  | 'red'
  | 'mustard'
  | 'pink';

/** neutral = goes with everything; earth/cool/warm = color families; bold = loud accent */
export type Tone = 'neutral' | 'earth' | 'cool' | 'warm' | 'bold';
export type Depth = 'light' | 'mid' | 'dark';

export interface PaletteColor {
  key: ColorKey;
  nameAr: string;
  hex: string;
  tone: Tone;
  depth: Depth;
}

export const PALETTE: readonly PaletteColor[] = [
  { key: 'white', nameAr: 'أبيض', hex: '#F5F5F2', tone: 'neutral', depth: 'light' },
  { key: 'offwhite', nameAr: 'أوف وايت', hex: '#ECE4D3', tone: 'neutral', depth: 'light' },
  { key: 'lightgrey', nameAr: 'رمادي فاتح', hex: '#C5C7CB', tone: 'neutral', depth: 'light' },
  { key: 'grey', nameAr: 'رصاصي', hex: '#8E9196', tone: 'neutral', depth: 'mid' },
  { key: 'charcoal', nameAr: 'فحمي', hex: '#3C3D42', tone: 'neutral', depth: 'dark' },
  { key: 'black', nameAr: 'أسود', hex: '#1C1C1E', tone: 'neutral', depth: 'dark' },
  { key: 'navy', nameAr: 'كحلي', hex: '#1F2A44', tone: 'cool', depth: 'dark' },
  { key: 'denim', nameAr: 'جينز', hex: '#3E5A80', tone: 'cool', depth: 'mid' },
  { key: 'blue', nameAr: 'أزرق', hex: '#2F5DA8', tone: 'cool', depth: 'mid' },
  { key: 'lightblue', nameAr: 'أزرق فاتح', hex: '#A9C6E8', tone: 'cool', depth: 'light' },
  { key: 'beige', nameAr: 'بيج', hex: '#D8C3A0', tone: 'earth', depth: 'light' },
  { key: 'khaki', nameAr: 'كاكي', hex: '#B4A57B', tone: 'earth', depth: 'mid' },
  { key: 'camel', nameAr: 'جملي', hex: '#B98A52', tone: 'earth', depth: 'mid' },
  { key: 'brown', nameAr: 'بني', hex: '#6B4A2F', tone: 'earth', depth: 'dark' },
  { key: 'olive', nameAr: 'زيتي', hex: '#5A5D39', tone: 'earth', depth: 'dark' },
  { key: 'green', nameAr: 'أخضر', hex: '#2F5E45', tone: 'cool', depth: 'dark' },
  { key: 'burgundy', nameAr: 'نبيتي', hex: '#5E1F2B', tone: 'warm', depth: 'dark' },
  { key: 'red', nameAr: 'أحمر', hex: '#B3262E', tone: 'bold', depth: 'mid' },
  { key: 'mustard', nameAr: 'مستردة', hex: '#C99A2E', tone: 'bold', depth: 'mid' },
  { key: 'pink', nameAr: 'بينك', hex: '#E8B4BC', tone: 'warm', depth: 'light' },
];

const BY_NAME = new Map<string, PaletteColor>(PALETTE.map((c) => [c.nameAr, c]));
const BY_KEY = new Map<ColorKey, PaletteColor>(PALETTE.map((c) => [c.key, c]));

export function paletteByKey(key: ColorKey): PaletteColor {
  const c = BY_KEY.get(key);
  if (!c) throw new Error(`Unknown color key ${key}`);
  return c;
}

// ---------- color math ----------

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean.padEnd(6, '0').slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 128, g: 128, b: 128 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

interface Lab {
  l: number;
  a: number;
  b: number;
}

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab({ r, g, b }: Rgb): Lab {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  // D65
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function deltaE(a: Lab, b: Lab): number {
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

const PALETTE_LAB = PALETTE.map((c) => ({ color: c, lab: rgbToLab(hexToRgb(c.hex)) }));

export function nearestPaletteColor(hex: string): PaletteColor {
  const lab = rgbToLab(hexToRgb(hex));
  let best = PALETTE_LAB[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const entry of PALETTE_LAB) {
    const d = deltaE(lab, entry.lab);
    if (d < bestD) {
      bestD = d;
      best = entry;
    }
  }
  return best.color;
}

/** Resolve an item's color to a palette profile (by its Arabic name first, then by hex). */
export function colorProfile(colorName: string, colorHex: string): PaletteColor {
  return BY_NAME.get(colorName.trim()) ?? nearestPaletteColor(colorHex);
}

/** Relative luminance (0..1) — used to pick readable outlines for very light swatches. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

// ---------- dominant color ----------

/**
 * Samples opaque pixels from the central region of a cropped garment and returns
 * the dominant color (largest quantized bucket, averaged for accuracy).
 */
export function extractDominantColor(data: ImageData): { hex: string; color: PaletteColor } {
  const { width, height } = data;
  const px = data.data;
  // central 60% box — avoids collars, cuffs, shadows at garment edges
  const x0 = Math.floor(width * 0.2);
  const x1 = Math.ceil(width * 0.8);
  const y0 = Math.floor(height * 0.2);
  const y1 = Math.ceil(height * 0.8);
  const area = (x1 - x0) * (y1 - y0);
  const step = Math.max(1, Math.floor(Math.sqrt(area / 6000))); // ~6k samples max

  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  let total = 0;
  const sample = (minAlpha: number) => {
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const i = (y * width + x) * 4;
        if (px[i + 3] < minAlpha) continue;
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.count++;
          bucket.r += r;
          bucket.g += g;
          bucket.b += b;
        } else {
          buckets.set(key, { count: 1, r, g, b });
        }
        total++;
      }
    }
  };
  sample(230);
  if (total < 20) sample(100); // thin garments: relax opacity

  if (total === 0) {
    const fallback = paletteByKey('grey');
    return { hex: fallback.hex, color: fallback };
  }

  // Merge each bucket with its direct neighbours' weight so gradients (folds/shading) don't split the vote.
  let bestKey = -1;
  let bestScore = -1;
  for (const [key, bucket] of buckets) {
    const r = key >> 8;
    const g = (key >> 4) & 15;
    const b = key & 15;
    let score = bucket.count * 2;
    for (const [dr, dg, db] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ]) {
      const nr = r + dr;
      const ng = g + dg;
      const nb = b + db;
      if (nr < 0 || ng < 0 || nb < 0 || nr > 15 || ng > 15 || nb > 15) continue;
      score += buckets.get((nr << 8) | (ng << 4) | nb)?.count ?? 0;
    }
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  const best = buckets.get(bestKey);
  if (!best) {
    const fallback = paletteByKey('grey');
    return { hex: fallback.hex, color: fallback };
  }
  const hex = rgbToHex({ r: best.r / best.count, g: best.g / best.count, b: best.b / best.count });
  return { hex, color: nearestPaletteColor(hex) };
}
