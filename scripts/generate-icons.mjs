// Generates real PNG app icons (iOS ignores SVG home-screen icons) + favicon.ico.
// Usage: npm run icons
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public');
await mkdir(out, { recursive: true });

const BG = '#17171B';
const SHIRT = '#F3EEE6';
const SHIRT_SHADE = '#D9CFBF';

/** Minimal hanger + shirt mark, designed on a 512 grid. */
function glyph() {
  return `
    <path d="M256 210 V186 a26 26 0 1 1 26 -26" fill="none" stroke="#FFFFFF" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M156 238 L218 206 Q256 232 294 206 L356 238 L394 304 L352 324 L340 300 V398 Q340 412 326 412 H186 Q172 412 172 398 V300 L160 324 L118 304 Z" fill="${SHIRT}"/>
    <path d="M218 206 L256 250 L294 206" fill="none" stroke="${BG}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M256 252 V404" stroke="${SHIRT_SHADE}" stroke-width="5"/>
    <circle cx="256" cy="286" r="6" fill="${SHIRT_SHADE}"/>
    <circle cx="256" cy="330" r="6" fill="${SHIRT_SHADE}"/>
    <circle cx="256" cy="374" r="6" fill="${SHIRT_SHADE}"/>`;
}

/**
 * @param {{ rounded?: boolean, scale?: number }} opts
 */
function svg({ rounded = false, scale = 1 } = {}) {
  const t = (1 - scale) * 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="${BG}"/>
  <g transform="translate(${t} ${t}) scale(${scale})">${glyph()}</g>
</svg>`;
}

async function png(svgString, size, file) {
  await sharp(Buffer.from(svgString)).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(out, file));
  console.log('✓', file, `${size}x${size}`);
}

await png(svg({ rounded: true }), 192, 'pwa-192x192.png');
await png(svg({ rounded: true }), 512, 'pwa-512x512.png');
await png(svg({ scale: 0.82 }), 512, 'maskable-icon-512x512.png'); // full-bleed, content inside safe zone
await png(svg({ scale: 0.92 }), 180, 'apple-touch-icon.png'); // opaque: iOS fills transparency with black
await writeFile(path.join(out, 'favicon.svg'), svg({ rounded: true }));
console.log('✓ favicon.svg');

// favicon.ico with an embedded 48x48 PNG (valid ICO container)
const ico48 = await sharp(Buffer.from(svg({ rounded: true }))).resize(48, 48).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count
const entry = Buffer.alloc(16);
entry.writeUInt8(48, 0);
entry.writeUInt8(48, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(ico48.length, 8);
entry.writeUInt32LE(6 + 16, 12);
await writeFile(path.join(out, 'favicon.ico'), Buffer.concat([header, entry, ico48]));
console.log('✓ favicon.ico');
