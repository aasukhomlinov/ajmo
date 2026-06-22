import { ArrowLeft } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

// Screen top bar on bg/base. Large: H1 title + optional trailing action.
// Compact: back button + centered H2 + optional trailing. Pass trailing actions
// (e.g. filters/share) as an IconButton node.
const ACTION_SIZE = 44;

export type HeaderVariant = 'large' | 'compact';

export interface HeaderProps {
  title: string;
  variant?: HeaderVariant;
  onBack?: () => void;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Header({ title, variant = 'large', onBack, trailing, style }: HeaderProps) {
  if (variant === 'compact') {
    return (
      <View style={[styles.base, styles.compact, style]}>
        {onBack ? (
          <IconButton
            icon={<ArrowLeft size={24} color={theme.colors.text.primary} />}
            variant="ghost"
            onPress={onBack}
            accessibilityLabel="Go back"
          />
        ) : (
          <View style={styles.spacer} />
        )}
        <Text variant="h2" style={styles.compactTitle} numberOfLines={1}>
          {title}
        </Text>
        {trailing ?? <View style={styles.spacer} />}
      </View>
    );
  }

  return (
    <View style={[styles.base, styles.large, style]}>
      <Text variant="h1" style={styles.largeTitle} numberOfLines={1}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.bg,
  },
  large: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  compact: {
    padding: theme.spacing.sm,
  },
  largeTitle: {
    flex: 1,
  },
  compactTitle: {
    flex: 1,
    textAlign: 'center',
  },
  spacer: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
  },
});
