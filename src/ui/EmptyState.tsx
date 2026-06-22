import { Ghost } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { Button } from './Button';
import { Text } from './Text';

// Empty state for feed/map/saved. Ghost icon, H2 title, secondary description,
// optional primary Button.
const ICON_SIZE = 48;
const DESCRIPTION_MAX_WIDTH = 260;

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      {icon ?? <Ghost size={ICON_SIZE} color={theme.colors.text.secondary} />}
      <Text variant="h2" style={styles.center}>
        {title}
      </Text>
      {description ? (
        <Text variant="bodySmall" color={theme.colors.text.secondary} style={styles.description}>
          {description}
        </Text>
      ) : null}
      {actionLabel ? <Button label={actionLabel} type="primary" onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing['4xl'],
  },
  center: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    maxWidth: DESCRIPTION_MAX_WIDTH,
  },
});
