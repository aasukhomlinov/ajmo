import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarBlank,
  Check,
  MapPin,
  Plus,
  ShareNetwork,
  Ticket,
} from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useIsSaved, useToggleSave } from '@/lib/api/saves';
import { detailDateLabel, timeLabel } from '@/lib/datetime';
import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';
import type { Event } from '@/lib/types';
import { Badge, Button, Carousel, Divider, IconButton, PageDots, Screen, Text } from '@/ui';

import { categoryLabel } from '../discover/categories';
import { LocationPreview } from './LocationPreview';

// Event Detail (app frame 152:178). Full-bleed 4:5 Carousel cover (paginates +
// shows dots when the event has multiple covers) with a soft bottom scrim;
// overlaid cover chrome = back (top-left) + Share (top-right). A
// scrolling body (heading, meta, about, location) and a pinned action bar: the
// single local Save is a wide Button that flips DS variant on toggle — Primary
// (lime, + SAVE) when unsaved → Secondary (neutral outline, ✓ SAVED, no lime)
// once saved — beside a secondary Open-in-browser icon button (ArrowUpRight →
// the event's web page). Save writes the user's Supabase saves (optimistic);
// Share is the native sheet, browser/maps are external links.
const HERO_RATIO = 4 / 5;
const META_ICON = 20;
const ACTION_ICON = 24;

export interface EventDetailScreenProps {
  event: Event;
}

export function EventDetailScreen({ event }: EventDetailScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  // Save state comes from the shared user-scoped query — toggling here is
  // reflected in the feed card and the Saved screen, and vice versa.
  const saved = useIsSaved(event.id);
  const toggleSave = useToggleSave();
  const [coverIndex, setCoverIndex] = useState(0);

  const onShare = useCallback(() => {
    void Share.share({
      title: event.title,
      message: `${event.title}\n${event.source_url}`,
      url: event.source_url, // iOS-only field; ignored on Android
    });
  }, [event.title, event.source_url]);

  const onOpenBrowser = useCallback(() => {
    void Linking.openURL(event.source_url);
  }, [event.source_url]);

  const dateLine = `${detailDateLabel(event.starts_at, t.lang)} · ${timeLabel(event.starts_at, event.ends_at)}`;
  const priceLine = event.is_free ? t('event.free') : event.price_text;
  const covers = event.covers ?? [event.cover_url];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Hero — Carousel of the event's covers. One cover renders without page
            dots; multiple covers paginate + show lime dots. */}
        <View style={styles.hero}>
          <Carousel
            images={covers}
            aspectRatio={HERO_RATIO}
            showDots={false}
            onIndexChange={setCoverIndex}
          />

          <View style={styles.bottomScrim} pointerEvents="none">
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="heroBottom" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={theme.colors.bg} stopOpacity={0} />
                  <Stop offset="0.6" stopColor={theme.colors.bg} stopOpacity={0.55} />
                  <Stop offset="1" stopColor={theme.colors.bg} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#heroBottom)" />
            </Svg>
          </View>

          {/* Cover chrome: back (left) + Share (right) — no top scrim: the
              overlay IconButtons carry their own scrim bg, and the hero sits
              below the status bar (Screen top safe-area), so nothing else up
              there needs contrast help. Poster art stays undimmed (Afiša). */}
          <View style={[styles.topBar, { top: theme.spacing.lg }]}>
            <IconButton
              icon={<ArrowLeft size={ACTION_ICON} color={theme.colors.text.primary} />}
              variant="surface"
              style={styles.overlayButton}
              onPress={() => router.back()}
              accessibilityLabel={t('common.goBack')}
            />
            <IconButton
              icon={<ShareNetwork size={ACTION_ICON} color={theme.colors.text.primary} />}
              variant="surface"
              style={styles.overlayButton}
              onPress={onShare}
              accessibilityLabel={t('event.shareA11y')}
            />
          </View>

          {/* Page dots — drawn at the screen level ABOVE the bottom scrim (which
              would otherwise hide the Carousel's own dots), tracking swipes. */}
          {covers.length > 1 ? (
            <View style={styles.dots} pointerEvents="none">
              <PageDots count={covers.length} activeIndex={coverIndex} />
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {/* Heading */}
          <View style={styles.heading}>
            <Badge label={categoryLabel(event.category, t)} tone="neutral" />
            <Text variant="h1">{event.title}</Text>
          </View>

          {/* Meta */}
          <View style={styles.meta}>
            <View style={styles.metaRow}>
              <CalendarBlank size={META_ICON} color={theme.colors.text.secondary} />
              <Text variant="bodySmall" style={styles.flex}>
                {dateLine}
              </Text>
            </View>
            <View style={styles.metaRowTop}>
              <MapPin size={META_ICON} color={theme.colors.text.secondary} />
              <View style={styles.flex}>
                <Text variant="bodySmall">{event.venue.name}</Text>
                <Text variant="bodySmall" color={theme.colors.text.secondary}>
                  {event.venue.address}
                </Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Ticket size={META_ICON} color={theme.colors.text.secondary} />
              <Text variant="bodySmall">{priceLine}</Text>
            </View>
          </View>

          <Divider />

          {/* About — plain description text */}
          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.text.secondary} style={styles.sectionLabel}>
              {t('event.about')}
            </Text>
            <Text variant="body">{event.description}</Text>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.text.secondary} style={styles.sectionLabel}>
              {t('event.location')}
            </Text>
            <LocationPreview
              lat={event.venue.lat}
              lng={event.venue.lng}
              venueName={event.venue.name}
              address={event.venue.address}
            />
          </View>
        </View>
      </ScrollView>

      {/* Action bar — single local Save (primary, wide) + Open-in-browser icon */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + theme.spacing.sm }]}>
        <Button
          label={saved ? t('event.saved') : t('event.save')}
          type={saved ? 'secondary' : 'primary'}
          leftIcon={saved ? Check : Plus}
          onPress={() => toggleSave(event.id, saved)}
          style={styles.saveButton}
        />
        <IconButton
          icon={<ArrowUpRight size={ACTION_ICON} color={theme.colors.text.primary} />}
          variant="surface"
          onPress={onOpenBrowser}
          accessibilityLabel={t('event.openBrowserA11y')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing.lg,
  },
  hero: {
    width: '100%',
    position: 'relative',
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '32%',
  },
  topBar: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overlayButton: {
    backgroundColor: theme.colors.scrim,
  },
  body: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  heading: {
    gap: theme.spacing.sm,
  },
  meta: {
    gap: theme.spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  metaRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    backgroundColor: theme.colors.bg,
  },
  saveButton: {
    flex: 1,
  },
  dots: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
