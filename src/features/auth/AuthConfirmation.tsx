import { ArrowLeft } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';
import { Button, IconButton, Screen, Text } from '@/ui';

// Shared confirmation layout for the Email Sent (221:1316), Link expired
// (274:1430) and Notifications permission (253:1322) frames: circular badge
// with a 52px icon, centered H1 + body, and a bottom primary CTA + text action.
const BADGE_SIZE = 104;

export interface AuthConfirmationProps {
  /** Pre-sized icon node (52px Phosphor glyph, status-colored by the caller). */
  icon: ReactNode;
  title: string;
  /** Plain string or richTemplate() output; rendered inside a body Text. */
  body: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onBack?: () => void;
  /** Overlay slot (e.g. a transient Toast) rendered above the actions. */
  overlay?: ReactNode;
}

export function AuthConfirmation({
  icon,
  title,
  body,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
  onBack,
  overlay,
}: AuthConfirmationProps) {
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <Screen>
      <View style={styles.topBar}>
        {onBack ? (
          <IconButton
            icon={<ArrowLeft size={24} color={theme.colors.text.primary} />}
            variant="ghost"
            onPress={onBack}
            accessibilityLabel={t('common.goBack')}
          />
        ) : null}
      </View>

      <View style={styles.center}>
        <View style={styles.badge}>{icon}</View>
        <Text variant="h1" style={styles.centeredText}>
          {title}
        </Text>
        <Text variant="body" color={theme.colors.text.secondary} style={styles.centeredText}>
          {body}
        </Text>
      </View>

      {overlay ? (
        <View style={styles.overlay} pointerEvents="box-none">
          {overlay}
        </View>
      ) : null}

      <View style={[styles.actions, { paddingBottom: insets.bottom + theme.spacing.sm }]}>
        <Button
          label={primaryLabel}
          fullWidth
          disabled={primaryDisabled}
          onPress={onPrimary}
        />
        {secondaryLabel && onSecondary ? (
          <Button label={secondaryLabel} type="text" onPress={onSecondary} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 44 + theme.spacing.xs + 2,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs + 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface.raised,
  },
  centeredText: {
    textAlign: 'center',
  },
  overlay: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  actions: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
    alignItems: 'stretch',
  },
});
