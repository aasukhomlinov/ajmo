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
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { detailDateLabel, timeLabel } from '@/lib/datetime';
import { theme } from '@/lib/theme';
import type { Event } from '@/lib/types';
import { Badge, Button, Carousel, Divider, IconButton, Screen, Text } from '@/ui';

import { categoryLabel } from '../discover/categories';
import { LocationPreview } from './LocationPreview';
import { sourceHandle } from './source';

// Event Detail (app frame 152:178). Full-bleed 4:5 Carousel cover with a soft
// bottom scrim (poster dissolves into the page) + a top scrim for the back
// button; a scrolling body (heading, meta, about, source, location); and a
// pinned action bar (save CTA + native Share). Save is local-only and Share is
// the native sheet — no Supabase here (per the build scope).
const HERO_RATIO = 4 / 5;
const META_ICON = 20;
const ACTION_ICON = 24;

export interface EventDetailScreenProps {
  event: Event;
}

export function EventDetailScreen({ event }: EventDetailScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [saved, setSaved] = useState(false);

  const onShare = useCallback(() => {
    void Share.share({
      title: event.title,
      message: `${event.title}\n${event.source_url}`,
      url: event.source_url, // iOS-only field; ignored on Android
    });
  }, [event.title, event.source_url]);

  const dateLine = `${detailDateLabel(event.starts_at)} · ${timeLabel(event.starts_at, event.ends_at)}`;
  const priceLine = event.is_free ? 'Free' : event.price_text;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Hero — first real use of the Carousel outside the gallery. One cover
            renders without page dots; multiple covers page + show lime dots. */}
        <View style={styles.hero}>
          <Carousel images={[event.cover_url]} aspectRatio={HERO_RATIO} />

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

          <View style={styles.topScrim} pointerEvents="none">
            <Svg width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="heroTop" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={theme.colors.bg} stopOpacity={0.6} />
                  <Stop offset="1" stopColor={theme.colors.bg} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#heroTop)" />
            </Svg>
          </View>

          <View style={[styles.topBar, { top: theme.spacing.lg }]}>
            <IconButton
              icon={<ArrowLeft size={ACTION_ICON} color={theme.colors.text.primary} />}
              variant="surface"
              style={styles.overlayButton}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
            />
          </View>
        </View>

        <View style={styles.body}>
          {/* Heading */}
          <View style={styles.heading}>
            <Badge label={categoryLabel(event.category)} tone="neutral" />
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

          {/* About */}
          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.text.secondary} style={styles.sectionLabel}>
              About
            </Text>
            <Text variant="body">{event.description}</Text>
          </View>

          {/* Source attribution */}
          <Pressable
            style={styles.source}
            onPress={() => void Linking.openURL(event.source_url)}
            accessibilityRole="link"
            accessibilityLabel={`Open source: ${sourceHandle(event.source_url)}`}
          >
            <Text variant="bodySmall" color={theme.colors.text.secondary}>
              via {sourceHandle(event.source_url)}
            </Text>
            <ArrowUpRight size={16} color={theme.colors.text.secondary} />
          </Pressable>

          {/* Location */}
          <View style={styles.section}>
            <Text variant="caption" color={theme.colors.text.secondary} style={styles.sectionLabel}>
              Location
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

      {/* Action bar — save (local) + native Share */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + theme.spacing.sm }]}>
        <Button
          label={saved ? 'Saved' : 'Save'}
          type="primary"
          leftIcon={saved ? Check : Plus}
          onPress={() => setSaved((prev) => !prev)}
          style={styles.saveButton}
        />
        <IconButton
          icon={<ShareNetwork size={ACTION_ICON} color={theme.colors.text.primary} />}
          variant="surface"
          style={styles.overlayButton}
          onPress={onShare}
          accessibilityLabel="Share event"
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
  topScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 120,
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
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
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
});
