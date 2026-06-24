import {
  Confetti,
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
// outline/fill convention via the consuming component.
export const CATEGORY_META: Record<EventCategory, { label: string; icon: Icon }> = {
  music: { label: 'Music', icon: MusicNotes },
  party: { label: 'Party', icon: Confetti },
  art: { label: 'Art', icon: PaintBrush },
  food: { label: 'Food', icon: ForkKnife },
  cinema: { label: 'Cinema', icon: FilmSlate },
  theatre: { label: 'Theatre', icon: MaskHappy },
  market: { label: 'Market', icon: Storefront },
};

export function categoryLabel(category: EventCategory): string {
  return CATEGORY_META[category].label;
}
