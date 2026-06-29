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

import type { EventCategory } from '@/lib/types';

// Per-category display label + Phosphor glyph. Shared by the category filter chip
// (icon + active label) and the card cover badge (label). Icons follow the DS
// outline/fill convention via the consuming component. `other` is the parser's
// catch-all; it needs a label/icon for the badge but is not a filter chip.
export const CATEGORY_META: Record<EventCategory, { label: string; icon: Icon }> = {
  music: { label: 'Music', icon: MusicNotes },
  party: { label: 'Party', icon: Confetti },
  art: { label: 'Art', icon: PaintBrush },
  food: { label: 'Food', icon: ForkKnife },
  cinema: { label: 'Cinema', icon: FilmSlate },
  theatre: { label: 'Theatre', icon: MaskHappy },
  market: { label: 'Market', icon: Storefront },
  other: { label: 'Other', icon: DotsThreeOutline },
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

export function categoryLabel(category: EventCategory): string {
  return CATEGORY_META[category].label;
}
