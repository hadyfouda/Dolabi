/** Six flat SVG demo garments so the styling engine can be tried before uploading real photos. */
import { addItems } from '../db/wardrobeDb';
import type { Category, Formality, Season, WardrobeItem } from '../types';

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function wrap(body: string, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}">${body}</svg>`;
}

function pantsSvg(color: string): string {
  const dark = shade(color, -0.06);
  const line = shade(color, 0.08);
  return wrap(
    `<path d="M22 8 H138 L146 292 H96 L80 92 L64 292 H14 Z" fill="${color}"/>
     <rect x="22" y="8" width="116" height="16" fill="${dark}"/>
     <path d="M80 24 V92" stroke="${line}" stroke-width="2"/>
     <path d="M40 24 Q48 44 36 56" stroke="${line}" stroke-width="2" fill="none"/>
     <path d="M120 24 Q112 44 124 56" stroke="${line}" stroke-width="2" fill="none"/>
     <path d="M44 100 L36 288 M116 100 L124 288" stroke="${dark}" stroke-width="1.5" opacity=".6"/>`,
    160,
    300,
  );
}

function pulloverSvg(color: string): string {
  const rib = shade(color, -0.07);
  const neck = shade(color, -0.1);
  return wrap(
    `<path d="M70 20 Q110 34 150 20 L196 40 Q210 46 212 62 L222 196 L190 200 L178 86 L176 236 H44 L42 86 L30 200 L-2 196 L8 62 Q10 46 24 40 Z" fill="${color}" transform="translate(10 0)"/>
     <path d="M80 20 Q120 48 160 20" stroke="${neck}" stroke-width="9" fill="none" stroke-linecap="round"/>
     <rect x="54" y="226" width="132" height="14" rx="3" fill="${rib}"/>
     <rect x="8" y="188" width="32" height="14" rx="3" fill="${rib}" transform="rotate(4 24 195)"/>
     <rect x="200" y="188" width="32" height="14" rx="3" fill="${rib}" transform="rotate(-4 216 195)"/>`,
    240,
    246,
  );
}

function shirtSvg(color: string): string {
  const light = color.toUpperCase() === '#F5F5F2';
  const stroke = light ? '#D6D6D2' : shade(color, 0.12);
  const collar = light ? '#FFFFFF' : shade(color, 0.05);
  const btn = light ? '#CFCFCA' : shade(color, 0.22);
  return wrap(
    `<path d="M84 18 L120 30 L156 18 L204 40 Q214 46 216 60 L226 206 L194 210 L182 90 L180 244 H60 L58 90 L46 210 L14 206 L24 60 Q26 46 36 40 Z" fill="${color}" stroke="${stroke}" stroke-width="2"/>
     <path d="M84 18 L104 54 L120 30 Z M156 18 L136 54 L120 30 Z" fill="${collar}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
     <path d="M120 32 V244" stroke="${stroke}" stroke-width="2"/>
     ${[66, 100, 134, 168, 202].map((y) => `<circle cx="126" cy="${y}" r="3.2" fill="${btn}"/>`).join('')}
     <path d="M66 76 H96 V100 H66 Z" fill="none" stroke="${stroke}" stroke-width="1.6"/>`,
    240,
    250,
  );
}

interface DemoSpec {
  category: Category;
  colorName: string;
  colorHex: string;
  formality: Formality;
  season: Season;
  svg: string;
}

const NAVY = '#1F2A44';
const GREY = '#8E9196';
const BLACK = '#1C1C1E';
const WHITE = '#F5F5F2';

export function demoSpecs(): DemoSpec[] {
  return [
    { category: 'pants', colorName: 'كحلي', colorHex: NAVY, formality: 'smart_casual', season: 'all', svg: pantsSvg(NAVY) },
    { category: 'pants', colorName: 'رصاصي', colorHex: GREY, formality: 'smart_casual', season: 'all', svg: pantsSvg(GREY) },
    { category: 'pullover', colorName: 'أسود', colorHex: BLACK, formality: 'smart_casual', season: 'winter', svg: pulloverSvg(BLACK) },
    { category: 'pullover', colorName: 'رصاصي', colorHex: GREY, formality: 'smart_casual', season: 'winter', svg: pulloverSvg(GREY) },
    { category: 'shirt', colorName: 'أسود', colorHex: BLACK, formality: 'smart_casual', season: 'all', svg: shirtSvg(BLACK) },
    { category: 'shirt', colorName: 'أبيض', colorHex: WHITE, formality: 'formal', season: 'all', svg: shirtSvg(WHITE) },
  ];
}

export async function seedDemoItems(): Promise<number[]> {
  const now = Date.now();
  const items: Omit<WardrobeItem, 'id'>[] = demoSpecs().map((s, i) => ({
    imageBlob: new Blob([s.svg], { type: 'image/svg+xml' }),
    category: s.category,
    colorName: s.colorName,
    colorHex: s.colorHex,
    pattern: 'solid',
    formality: s.formality,
    season: s.season,
    status: 'available',
    createdAt: now + i,
  }));
  return addItems(items);
}
