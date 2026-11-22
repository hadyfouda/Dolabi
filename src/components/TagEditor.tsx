import type { ReactNode } from 'react';
import { Pipette } from 'lucide-react';
import { CATEGORY_LABELS, CATEGORY_ORDER, FORMALITY_LABELS, PATTERN_LABELS, SEASON_LABELS } from '../labels';
import { nearestPaletteColor, PALETTE } from '../services/colorUtils';
import type { Category, Formality, Pattern, Season } from '../types';
import { Chip, ColorDot, cx } from './ui';

export interface ItemTags {
  category: Category;
  colorName: string;
  colorHex: string;
  pattern: Pattern;
  formality: Formality;
  season: Season;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-[13px] font-bold text-muted">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function ColorPicker({
  colorName,
  colorHex,
  onChange,
  suggestedHex,
}: {
  colorName: string;
  colorHex: string;
  suggestedHex?: string;
  onChange: (name: string, hex: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-2xl bg-cutout px-3 py-2.5">
        <ColorDot hex={colorHex} size="size-6" />
        <div className="flex-1">
          <div className="text-sm font-bold">{colorName}</div>
          <div className="text-xs text-muted" dir="ltr">
            {colorHex}
          </div>
        </div>
        {suggestedHex && suggestedHex.toUpperCase() !== colorHex.toUpperCase() && (
          <button
            type="button"
            className="rounded-full bg-card px-3 py-1 text-xs font-bold text-ink-soft"
            onClick={() => onChange(nearestPaletteColor(suggestedHex).nameAr, suggestedHex)}
          >
            اللون المقترح
          </button>
        )}
        <label className="relative grid size-9 cursor-pointer place-items-center rounded-full bg-card" aria-label="اختار لون مخصص">
          <Pipette className="size-4" />
          <input
            type="color"
            value={colorHex.length === 7 ? colorHex : '#888888'}
            onChange={(e) => {
              const hex = e.target.value.toUpperCase();
              onChange(nearestPaletteColor(hex).nameAr, hex);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {PALETTE.map((c) => {
          const active = c.nameAr === colorName;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onChange(c.nameAr, c.hex)}
              className={cx(
                'flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold',
                active ? 'bg-ink text-white' : 'text-ink-soft active:bg-cutout',
              )}
            >
              <ColorDot hex={c.hex} size="size-6" />
              {c.nameAr}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TagEditor({
  value,
  onChange,
  suggestedHex,
  compact = false,
}: {
  value: ItemTags;
  onChange: (patch: Partial<ItemTags>) => void;
  suggestedHex?: string;
  compact?: boolean;
}) {
  return (
    <div>
      <Row label="النوع">
        {CATEGORY_ORDER.map((c) => (
          <Chip key={c} active={value.category === c} onClick={() => onChange({ category: c })}>
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </Row>
      <div className="mt-4">
        <div className="mb-2 text-[13px] font-bold text-muted">اللون</div>
        <ColorPicker
          colorName={value.colorName}
          colorHex={value.colorHex}
          suggestedHex={suggestedHex}
          onChange={(colorName, colorHex) => onChange({ colorName, colorHex })}
        />
      </div>
      <Row label="النقشة">
        {(Object.keys(PATTERN_LABELS) as Pattern[]).map((p) => (
          <Chip key={p} active={value.pattern === p} onClick={() => onChange({ pattern: p })}>
            {PATTERN_LABELS[p]}
          </Chip>
        ))}
      </Row>
      {!compact && (
        <>
          <Row label="الرسمية">
            {(Object.keys(FORMALITY_LABELS) as Formality[]).map((f) => (
              <Chip key={f} active={value.formality === f} onClick={() => onChange({ formality: f })}>
                {FORMALITY_LABELS[f]}
              </Chip>
            ))}
          </Row>
          <Row label="الموسم">
            {(Object.keys(SEASON_LABELS) as Season[]).map((s) => (
              <Chip key={s} active={value.season === s} onClick={() => onChange({ season: s })}>
                {SEASON_LABELS[s]}
              </Chip>
            ))}
          </Row>
        </>
      )}
    </div>
  );
}
