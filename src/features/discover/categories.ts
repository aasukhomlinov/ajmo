import {
  Confetti,
  DotsThreeOutline,
  FilmSlate,
  ForkKnife,
  type Icon,
  MaskHappy,
  MusicNotes,
  PaintBrush,
  Storefront,
} from 'phosphor-react-native';

import type { TranslationKey, Translator } from '@/lib/i18n';
import type { EventCategory } from '@/lib/types';

// Per-category i18n label key + Phosphor glyph. Shared by the category filter
// chip (icon + active label) and the card cover badge (label) — render labels
// via t(meta.labelKey). Icons follow the DS outline/fill convention via the
// consuming component. `other` is the parser's catch-all; it needs a label/icon
// for the badge but is not a filter chip.
export const CATEGORY_META: Record<EventCategory, { labelKey: TranslationKey; icon: Icon }> = {
  music: { labelKey: 'category.music', icon: MusicNotes },
  party: { labelKey: 'category.party', icon: Confetti },
  art: { labelKey: 'category.art', icon: PaintBrush },
  food: { labelKey: 'category.food', icon: ForkKnife },
  cinema: { labelKey: 'category.cinema', icon: FilmSlate },
  theatre: { labelKey: 'category.theatre', icon: MaskHappy },
  market: { labelKey: 'category.market', icon: Storefront },
  other: { labelKey: 'category.other', icon: DotsThreeOutline },
};

// Display order for the category filter grid (Categories sheet). The seven
// curated categories only — `other` is deliberately excluded so it never appears
// as a filter chip (it still renders as a badge on cards/detail).
export const CATEGORY_ORDER: EventCategory[] = [
  'music',
  'party',
  'art',
  'food',
  'cinema',
  'theatre',
  'market',
];

export function categoryLabel(category: EventCategory, t: Translator): string {
  return t(CATEGORY_META[category].labelKey);
}
