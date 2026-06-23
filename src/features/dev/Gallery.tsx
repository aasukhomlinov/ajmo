import {
  ArrowRight,
  Bell,
  Calendar,
  Funnel,
  Ghost,
  Heart,
  MagnifyingGlass,
  MapTrifold,
  Plus,
  ShareNetwork,
} from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EventCard } from '@/features/discover/EventCard';
import { EventRow } from '@/features/discover/EventRow';
import { theme } from '@/lib/theme';
import {
  Badge,
  Button,
  Carousel,
  Checkbox,
  Chip,
  Cover,
  Divider,
  EmptyState,
  EventCardSkeleton,
  EventRowSkeleton,
  Header,
  IconButton,
  Input,
  ListRow,
  ListSectionHeader,
  PageDots,
  Radio,
  Screen,
  Skeleton,
  Text,
  Toast,
  Toggle,
  type TextVariant,
} from '@/ui';

// DEV-ONLY acceptance gallery — every live primitive in each state/variant,
// grouped foundations → inputs/actions → content → feedback/structure. Reached
// via the dev link on the home screen. SegmentedControl is intentionally
// excluded (unused in MVP); TabBar is NOT mocked here — it's live in the real
// (tabs) layout (iOS system glass / Android custom blur bar), reachable via
// "Open app (tabs)" on the home screen.

const SAMPLE_IMAGES = [
  'https://picsum.photos/seed/ajmo-1/800/1000',
  'https://picsum.photos/seed/ajmo-2/800/1000',
  'https://picsum.photos/seed/ajmo-3/800/1000',
];

const TYPE_VARIANTS: TextVariant[] = [
  'display',
  'h1',
  'h2',
  'body',
  'bodySmall',
  'caption',
  'button',
  'sectionHeader',
];

const SWATCHES: { label: string; color: string; border?: boolean }[] = [
  { label: 'bg', color: theme.colors.bg, border: true },
  { label: 'surface.base', color: theme.colors.surface.base },
  { label: 'surface.raised', color: theme.colors.surface.raised },
  { label: 'accent.base', color: theme.colors.accent.base },
  { label: 'text.primary', color: theme.colors.text.primary },
  { label: 'border', color: theme.colors.border },
  { label: 'success', color: theme.colors.success },
  { label: 'warning', color: theme.colors.warning },
  { label: 'error', color: theme.colors.error },
];

export interface GalleryProps {
  onBack?: () => void;
}

export function Gallery({ onBack }: GalleryProps) {
  const [filterActive, setFilterActive] = useState(true);
  const [agree, setAgree] = useState(true);
  const [city, setCity] = useState<'bg' | 'ns'>('bg');
  const [notify, setNotify] = useState(true);
  const [rowToggle, setRowToggle] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <Screen scroll edges={['top']} contentContainerStyle={styles.content}>
      <Header title="UI Gallery" variant="compact" onBack={onBack} />

      {/* ---- Foundations ------------------------------------------------ */}
      <Section title="Foundations · Type">
        {TYPE_VARIANTS.map((variant) => (
          <Variant key={variant} label={variant}>
            <Text variant={variant}>Ajmo — šta ima večeras?</Text>
          </Variant>
        ))}
      </Section>

      <Section title="Foundations · Color">
        <Cluster>
          {SWATCHES.map((s) => (
            <View key={s.label} style={styles.swatchCol}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: s.color },
                  s.border && styles.swatchBorder,
                ]}
              />
              <Text variant="caption" color={theme.colors.text.secondary}>
                {s.label}
              </Text>
            </View>
          ))}
        </Cluster>
      </Section>

      {/* ---- Inputs / actions ------------------------------------------ */}
      <Section title="Actions · Button">
        <Variant label="primary / secondary / text">
          <Cluster>
            <Button label="Primary" type="primary" />
            <Button label="Secondary" type="secondary" />
            <Button label="Text" type="text" />
          </Cluster>
        </Variant>
        <Variant label="disabled">
          <Cluster>
            <Button label="Primary" type="primary" disabled />
            <Button label="Secondary" type="secondary" disabled />
          </Cluster>
        </Variant>
        <Variant label="left / right icon">
          <Cluster>
            <Button label="Add" type="primary" leftIcon={Plus} />
            <Button label="Next" type="secondary" rightIcon={ArrowRight} />
          </Cluster>
        </Variant>
        <Variant label="fullWidth">
          <Button label="Full width" type="primary" fullWidth />
        </Variant>
      </Section>

      <Section title="Actions · IconButton">
        <Cluster>
          <IconButton
            icon={<Heart size={24} color={theme.colors.text.primary} />}
            variant="surface"
            accessibilityLabel="Like"
          />
          <IconButton
            icon={<ShareNetwork size={24} color={theme.colors.text.primary} />}
            variant="ghost"
            accessibilityLabel="Share"
          />
          <IconButton
            icon={<Heart size={24} color={theme.colors.text.primary} />}
            variant="surface"
            disabled
            accessibilityLabel="Like (disabled)"
          />
        </Cluster>
      </Section>

      <Section title="Actions · Chip">
        <Cluster>
          <Chip label="Tonight" />
          <Chip
            label="Filters"
            active={filterActive}
            leftIcon={Funnel}
            onPress={() => setFilterActive((v) => !v)}
          />
          <Chip label="Free" active />
          <Chip label="This week" leftIcon={Calendar} />
        </Cluster>
      </Section>

      <Section title="Inputs · Input">
        <Variant label="search (text + left icon)">
          <Input
            placeholder="Search events"
            leftIcon={<MagnifyingGlass size={20} color={theme.colors.text.secondary} />}
          />
        </Variant>
        <Variant label="filled / error / disabled">
          <Input value="Drum & Bass night" />
          <Input value="Invalid" error />
          <Input placeholder="Disabled" disabled />
        </Variant>
        <Variant label="dropdown (empty / filled)">
          <Input type="dropdown" placeholder="Choose city" onPress={() => {}} />
          <Input type="dropdown" value="Beograd" onPress={() => {}} />
        </Variant>
      </Section>

      <Section title="Inputs · Selection">
        <Variant label="Checkbox">
          <Cluster>
            <Checkbox checked={agree} onChange={setAgree} label="I agree" />
            <Checkbox checked={false} onChange={() => {}} />
            <Checkbox checked disabled label="Locked" />
          </Cluster>
        </Variant>
        <Variant label="Radio (single-select)">
          <Radio checked={city === 'bg'} onChange={() => setCity('bg')} label="Beograd" />
          <Radio checked={city === 'ns'} onChange={() => setCity('ns')} label="Novi Sad" />
          <Radio checked={false} disabled label="Disabled" />
        </Variant>
        <Variant label="Toggle">
          <Cluster>
            <Toggle value={notify} onValueChange={setNotify} />
            <Toggle value={false} onValueChange={() => {}} />
            <Toggle value disabled />
          </Cluster>
        </Variant>
      </Section>

      {/* ---- Content ---------------------------------------------------- */}
      <Section title="Content · Cover">
        <Variant label="date chip + category + scrim (16:10)">
          <Cover
            imageUrl={SAMPLE_IMAGES[0]}
            dateLabel="SUB 21"
            categoryLabel="KONCERT"
            borderRadius={theme.radii.lg}
          />
        </Variant>
        <Variant label="thumbnail (1:1, overlays off)">
          <View style={styles.thumb}>
            <Cover
              imageUrl={SAMPLE_IMAGES[1]}
              ratio="1:1"
              showScrim={false}
              showDateChip={false}
              showBadge={false}
              borderRadius={theme.radii.lg}
            />
          </View>
        </Variant>
      </Section>

      <SectionFlush title="Content · Carousel">
        <Carousel images={SAMPLE_IMAGES} />
      </SectionFlush>

      <Section title="Content · EventCard">
        <EventCard
          title="Koncert na Dorćolu"
          venue="KC Grad, Savamala"
          time="21:00"
          price="Gratis"
          dateLabel="SUB 21"
          category="KONCERT"
          imageUrl={SAMPLE_IMAGES[2]}
          saved={saved}
          onToggleSave={() => setSaved((v) => !v)}
        />
        <Text variant="caption" color={theme.colors.text.secondary}>
          Tap “+” to toggle saved ({saved ? 'saved' : 'not saved'})
        </Text>
      </Section>

      <Section title="Content · EventRow">
        <EventRow
          title="Električni ambijent"
          venue="Drugstore"
          date="SUB · 21 JUN"
          imageUrl={SAMPLE_IMAGES[0]}
          badge={{ label: 'FREE', tone: 'success' }}
        />
        <EventRow
          title="Jazz u bašti"
          venue="Kafana SFRJ"
          date="NED · 22 JUN"
          imageUrl={SAMPLE_IMAGES[1]}
        />
      </Section>

      <Section title="Content · Skeletons">
        <EventCardSkeleton />
        <EventRowSkeleton />
        <Variant label="base bars">
          <Skeleton width="60%" />
          <Skeleton width="40%" height={theme.spacing.md} />
        </Variant>
      </Section>

      {/* ---- Feedback / structure -------------------------------------- */}
      <Section title="Feedback · Badge">
        <Cluster>
          <Badge label="Neutral" tone="neutral" />
          <Badge label="Accent" tone="accent" />
          <Badge label="Free" tone="success" />
          <Badge label="Soon" tone="warning" />
          <Badge label="Sold out" tone="error" />
        </Cluster>
      </Section>

      <Section title="Feedback · Toast">
        <Toast message="Saved to your list" tone="info" />
        <Toast message="Reminder set" tone="success" actionLabel="Undo" onAction={() => {}} />
        <Toast message="Couldn’t save" tone="error" actionLabel="Retry" onAction={() => {}} />
      </Section>

      <Section title="Feedback · EmptyState">
        <EmptyState
          title="Nothing saved yet"
          description="Events you save will show up here."
          actionLabel="Browse events"
          onAction={() => {}}
        />
        <EmptyState
          title="No events nearby"
          description="Try another date or city."
          icon={<Ghost size={48} color={theme.colors.text.secondary} />}
        />
      </Section>

      <Section title="Structure · Header">
        <Variant label="large (with trailing)">
          <Header
            title="Discover"
            variant="large"
            trailing={
              <IconButton
                icon={<MagnifyingGlass size={24} color={theme.colors.text.primary} />}
                variant="ghost"
                accessibilityLabel="Search"
              />
            }
          />
        </Variant>
        <Variant label="compact (back + trailing)">
          <Header
            title="Event details"
            variant="compact"
            onBack={() => {}}
            trailing={
              <IconButton
                icon={<Heart size={24} color={theme.colors.text.primary} />}
                variant="ghost"
                accessibilityLabel="Like"
              />
            }
          />
        </Variant>
      </Section>

      <Section title="Structure · ListRow + Divider" trailing={<Badge label="4" tone="neutral" />}>
        <View style={styles.card}>
          <ListRow
            label="Notifications"
            leftIcon={<Bell size={24} color={theme.colors.text.secondary} />}
            trailing={<Toggle value={rowToggle} onValueChange={setRowToggle} />}
          />
          <Divider inset={theme.spacing.lg} />
          <ListRow label="City" value="Beograd" onPress={() => {}} />
          <Divider inset={theme.spacing.lg} />
          <ListRow
            label="Open in Maps"
            description="Static preview taps out to your maps app"
            leftIcon={<MapTrifold size={24} color={theme.colors.text.secondary} />}
            onPress={() => {}}
          />
          <Divider inset={theme.spacing.lg} />
          <ListRow label="Disabled row" value="—" disabled />
        </View>
      </Section>

      <Section title="Structure · PageDots">
        <Cluster>
          <PageDots count={4} activeIndex={0} />
          <PageDots count={4} activeIndex={2} />
        </Cluster>
      </Section>

      <Section title="Structure · Screen">
        <Text variant="bodySmall" color={theme.colors.text.secondary}>
          This whole gallery is rendered inside {'<Screen scroll edges={[\'top\']}>'} — bg/base
          fill + safe-area insets + scroll.
        </Text>
      </Section>

      <Section title="TabBar · live in (tabs)">
        <View style={styles.tabbarPlaceholder}>
          <Text variant="bodySmall" color={theme.colors.text.secondary}>
            Not mocked here — TabBar is the real navigation chrome. iOS renders the
            native Liquid Glass bar; Android/web use the matching custom blur bar.
            Open it via “Open app (tabs)” on the home screen.
          </Text>
        </View>
      </Section>
    </Screen>
  );
}

// --- section/variant scaffolding (dev-only layout, tokens only) ------------

function Section({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View>
      <ListSectionHeader title={title} trailing={trailing} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

// Same as Section but the body is full-bleed (edge-to-edge) for Carousel.
function SectionFlush({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <ListSectionHeader title={title} />
      {children}
    </View>
  );
}

function Variant({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.variant}>
      <Text variant="caption" color={theme.colors.text.secondary}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function Cluster({ children }: { children: ReactNode }) {
  return <View style={styles.cluster}>{children}</View>;
}

const SWATCH_SIZE = 56;

const styles = StyleSheet.create({
  content: {
    paddingBottom: theme.spacing['6xl'],
  },
  sectionBody: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  variant: {
    gap: theme.spacing.sm,
  },
  cluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  swatchCol: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: theme.radii.sm,
  },
  swatchBorder: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  thumb: {
    width: 120,
  },
  card: {
    backgroundColor: theme.colors.surface.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
  },
  tabbarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    backgroundColor: theme.colors.surface.raised,
  },
});
