import Dexie, { type EntityTable } from 'dexie';
import type {
  Category,
  Formality,
  ItemStatus,
  Outfit,
  Pattern,
  Season,
  StoredItem,
  WardrobeItem,
  WearRecord,
} from '../types';

class WardrobeDatabase extends Dexie {
  items!: EntityTable<WardrobeItem, 'id'>;
  outfits!: EntityTable<Outfit, 'id'>;
  wearHistory!: EntityTable<WearRecord, 'id'>;

  constructor() {
    super('dolabi');
    // Note: booleans aren't valid IndexedDB keys, so `isFavorite` is filtered in memory.
    this.version(1).stores({
      items: '++id, category, status, colorName, createdAt',
      outfits: '++id, createdAt',
      wearHistory: '++id, outfitId, wornAt',
    });
  }
}

export const db = new WardrobeDatabase();

export function isStored(item: WardrobeItem): item is StoredItem {
  return typeof item.id === 'number';
}

// ---------- item helpers ----------

export async function addItems(items: Omit<WardrobeItem, 'id'>[]): Promise<number[]> {
  const keys = await db.items.bulkAdd(items as WardrobeItem[], { allKeys: true });
  return keys.filter((k): k is number => typeof k === 'number');
}

export async function updateItem(id: number, changes: Partial<Omit<WardrobeItem, 'id'>>): Promise<void> {
  await db.items.update(id, changes);
}

export async function toggleItemStatus(item: StoredItem): Promise<void> {
  const next: ItemStatus = item.status === 'available' ? 'laundry' : 'available';
  await db.items.update(item.id, { status: next });
}

export async function deleteItem(id: number): Promise<void> {
  await db.transaction('rw', db.items, db.outfits, async () => {
    await db.items.delete(id);
    // Saved outfits that relied on this piece are no longer wearable.
    const affected = await db.outfits.filter((o) => o.itemIds.includes(id)).toArray();
    await db.outfits.bulkDelete(affected.map((o) => o.id).filter((x): x is number => typeof x === 'number'));
  });
}

export async function setItemsStatus(ids: number[], status: ItemStatus): Promise<void> {
  await db.transaction('rw', db.items, async () => {
    for (const id of ids) await db.items.update(id, { status });
  });
}

// ---------- outfits & history ----------

export async function saveOutfit(outfit: Omit<Outfit, 'id'>): Promise<number> {
  const existing = await findOutfitBySet(outfit.itemIds);
  if (existing?.id !== undefined) {
    await db.outfits.update(existing.id, { isFavorite: outfit.isFavorite || existing.isFavorite });
    return existing.id;
  }
  return (await db.outfits.add(outfit as Outfit)) as number;
}

export async function findOutfitBySet(itemIds: number[]): Promise<Outfit | undefined> {
  const key = setKey(itemIds);
  return db.outfits.filter((o) => setKey(o.itemIds) === key).first();
}

export async function setFavorite(outfitId: number, isFavorite: boolean): Promise<void> {
  await db.outfits.update(outfitId, { isFavorite });
}

export async function logWear(itemIds: number[], outfitId: number | undefined, markLaundry: boolean): Promise<void> {
  await db.transaction('rw', db.wearHistory, db.items, async () => {
    await db.wearHistory.add({ itemIds: [...itemIds], outfitId, wornAt: Date.now() } as WearRecord);
    if (markLaundry) {
      for (const id of itemIds) {
        const item = await db.items.get(id);
        // shoes & accessories don't go in the laundry
        if (item && item.category !== 'shoes' && item.category !== 'accessory') {
          await db.items.update(id, { status: 'laundry' });
        }
      }
    }
  });
}

export async function recentWear(days: number): Promise<WearRecord[]> {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return db.wearHistory.where('wornAt').aboveOrEqual(since).toArray();
}

export function setKey(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join('-');
}

// ---------- backup (JSON with base64 images) ----------

const BACKUP_APP = 'dolabi';
const BACKUP_VERSION = 1;

interface BackupItem extends Omit<WardrobeItem, 'imageBlob'> {
  imageDataUrl: string;
}

interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  items: BackupItem[];
  outfits: Outfit[];
  wearHistory: WearRecord[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read error')));
    reader.onerror = () => reject(reader.error ?? new Error('read error'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('صورة غير صالحة في ملف النسخة الاحتياطية');
  const mime = match[1] ?? 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  if (!isBase64) return new Blob([decodeURIComponent(payload)], { type: mime });
  const bin = atob(payload);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportBackup(): Promise<Blob> {
  const [items, outfits, wearHistory] = await Promise.all([
    db.items.toArray(),
    db.outfits.toArray(),
    db.wearHistory.toArray(),
  ]);
  const backupItems: BackupItem[] = [];
  for (const item of items) {
    const { imageBlob, ...rest } = item;
    backupItems.push({ ...rest, imageDataUrl: await blobToDataUrl(imageBlob) });
  }
  const file: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: backupItems,
    outfits,
    wearHistory,
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

// ----- strict runtime validation (no `any`) -----

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNumArr = (v: unknown): v is number[] => Array.isArray(v) && v.every(isNum);
const oneOf = <T extends string>(v: unknown, opts: readonly T[]): v is T => isStr(v) && (opts as readonly string[]).includes(v);

const CATEGORIES: readonly Category[] = ['shirt', 'pullover', 'tshirt', 'jacket', 'pants', 'shoes', 'accessory'];
const PATTERNS: readonly Pattern[] = ['solid', 'striped', 'checkered', 'patterned'];
const FORMALITIES: readonly Formality[] = ['formal', 'smart_casual', 'casual'];
const SEASONS: readonly Season[] = ['summer', 'winter', 'all'];
const STATUSES: readonly ItemStatus[] = ['available', 'laundry'];
const OCCASIONS = ['work', 'smart_casual', 'casual', 'evening', 'quick'] as const;

function parseItem(v: unknown): WardrobeItem {
  if (
    !isRec(v) ||
    !isNum(v.id) ||
    !isStr(v.imageDataUrl) ||
    !oneOf(v.category, CATEGORIES) ||
    !isStr(v.colorName) ||
    !isStr(v.colorHex) ||
    !oneOf(v.pattern, PATTERNS) ||
    !oneOf(v.formality, FORMALITIES) ||
    !oneOf(v.season, SEASONS) ||
    !oneOf(v.status, STATUSES) ||
    !isNum(v.createdAt)
  ) {
    throw new Error('قطعة غير صالحة في ملف النسخة الاحتياطية');
  }
  return {
    id: v.id,
    imageBlob: dataUrlToBlob(v.imageDataUrl),
    category: v.category,
    colorName: v.colorName,
    colorHex: v.colorHex,
    pattern: v.pattern,
    formality: v.formality,
    season: v.season,
    status: v.status,
    createdAt: v.createdAt,
  };
}

function parseOutfit(v: unknown): Outfit {
  if (
    !isRec(v) ||
    !isNum(v.id) ||
    !isStr(v.name) ||
    !isNumArr(v.itemIds) ||
    !oneOf(v.occasion, OCCASIONS) ||
    !isStr(v.reasonAr) ||
    !isStr(v.shoeTipAr) ||
    typeof v.isFavorite !== 'boolean' ||
    !isNum(v.createdAt)
  ) {
    throw new Error('طقم غير صالح في ملف النسخة الاحتياطية');
  }
  return {
    id: v.id,
    name: v.name,
    itemIds: v.itemIds,
    occasion: v.occasion,
    reasonAr: v.reasonAr,
    shoeTipAr: v.shoeTipAr,
    isFavorite: v.isFavorite,
    createdAt: v.createdAt,
  };
}

function parseWear(v: unknown): WearRecord {
  if (!isRec(v) || !isNum(v.id) || !isNumArr(v.itemIds) || !isNum(v.wornAt)) {
    throw new Error('سجل لبس غير صالح في ملف النسخة الاحتياطية');
  }
  return { id: v.id, itemIds: v.itemIds, wornAt: v.wornAt, outfitId: isNum(v.outfitId) ? v.outfitId : undefined };
}

export interface ImportSummary {
  items: number;
  outfits: number;
  wearHistory: number;
}

/** Replaces the whole wardrobe with the backup contents (ids preserved so outfits stay linked). */
export async function importBackup(file: Blob): Promise<ImportSummary> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('الملف ده مش ملف JSON صالح');
  }
  if (!isRec(parsed) || parsed.app !== BACKUP_APP || !isNum(parsed.version)) {
    throw new Error('الملف ده مش نسخة احتياطية من دولابي');
  }
  if (parsed.version > BACKUP_VERSION) throw new Error('النسخة الاحتياطية دي من إصدار أحدث من التطبيق');
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const rawOutfits = Array.isArray(parsed.outfits) ? parsed.outfits : [];
  const rawWear = Array.isArray(parsed.wearHistory) ? parsed.wearHistory : [];

  const items = rawItems.map(parseItem);
  const outfits = rawOutfits.map(parseOutfit);
  const wear = rawWear.map(parseWear);

  await db.transaction('rw', db.items, db.outfits, db.wearHistory, async () => {
    await Promise.all([db.items.clear(), db.outfits.clear(), db.wearHistory.clear()]);
    await db.items.bulkAdd(items);
    await db.outfits.bulkAdd(outfits);
    await db.wearHistory.bulkAdd(wear);
  });
  return { items: items.length, outfits: outfits.length, wearHistory: wear.length };
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.items, db.outfits, db.wearHistory, async () => {
    await Promise.all([db.items.clear(), db.outfits.clear(), db.wearHistory.clear()]);
  });
}
