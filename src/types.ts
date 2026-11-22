export type Category = 'shirt' | 'pullover' | 'tshirt' | 'jacket' | 'pants' | 'shoes' | 'accessory';
export type Pattern = 'solid' | 'striped' | 'checkered' | 'patterned';
export type Formality = 'formal' | 'smart_casual' | 'casual';
export type Season = 'summer' | 'winter' | 'all';
export type ItemStatus = 'available' | 'laundry';

export type Occasion = 'work' | 'smart_casual' | 'casual' | 'evening';
export type Weather = 'cold' | 'mild' | 'hot';

export interface WardrobeItem {
  id?: number;
  imageBlob: Blob;
  category: Category;
  colorName: string;
  colorHex: string;
  pattern: Pattern;
  formality: Formality;
  season: Season;
  status: ItemStatus;
  createdAt: number;
}

/** Item that is guaranteed to be persisted (has an id). */
export type StoredItem = WardrobeItem & { id: number };

export interface Outfit {
  id?: number;
  name: string;
  itemIds: number[];
  occasion: Occasion | 'quick';
  reasonAr: string;
  shoeTipAr: string;
  isFavorite: boolean;
  createdAt: number;
}

export interface WearRecord {
  id?: number;
  outfitId?: number;
  itemIds: number[];
  wornAt: number;
}

export type EngineSource = 'rules' | 'ai';

/** A generated (not yet saved) outfit suggestion. */
export interface OutfitSuggestion {
  key: string;
  itemIds: number[];
  title: string;
  reasonAr: string;
  shoeTipAr: string;
  score: number;
  source: EngineSource;
  warnings: string[];
}

export interface GenerateRequest {
  pool: StoredItem[];
  occasion?: Occasion;
  weather?: Weather;
  pinnedIds: number[];
  recentWear: WearRecord[];
  mode: 'quick' | 'context';
}

export interface GenerateResult {
  suggestions: OutfitSuggestion[];
  source: EngineSource;
  /** Set when AI mode was requested but we fell back to the built-in rules. */
  fallbackReason?: string;
  /** Set when nothing could be generated. */
  errorAr?: string;
}

export type AiProvider = 'gemini' | 'anthropic';

export interface AppSettings {
  aiEnabled: boolean;
  aiProvider: AiProvider;
  geminiKey: string;
  anthropicKey: string;
  geminiModel: string;
  anthropicModel: string;
  autoLaundryOnWear: boolean;
}
