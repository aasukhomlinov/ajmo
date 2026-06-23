import { StyleSheet, View } from 'react-native';

import { theme } from '@/lib/theme';
import { Screen, Text } from '@/ui';

// Temporary tab-shell placeholder. Real Discover/Saved/Profile content arrives in
// the screen phase — this only exists so the tab navigator + glass bar have
// something scrollable to render over. Scrollable on purpose: lets us verify the
// glass bar's blur reacting to content passing underneath it.
export interface TabPlaceholderProps {
  title: string;
  subtitle?: string;
}

const FILLER = Array.from({ length: 16 }, (_, i) => i);

export function TabPlaceholder({ title, subtitle }: TabPlaceholderProps) {
  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <Text variant="h1">{title}</Text>
      {subtitle ? (
        <Text variant="bodySmall" color={theme.colors.text.secondary}>
          {subtitle}
        </Text>
      ) : null}
      <View style={styles.fillerGroup}>
        {FILLER.map((i) => (
          <View key={i} style={styles.filler}>
            <Text variant="body" color={theme.colors.text.secondary}>
              Placeholder row {i + 1}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    // Generous tail so content scrolls under the floating tab bar during verify.
    paddingBottom: theme.spacing['6xl'] * 2,
    gap: theme.spacing.md,
  },
  fillerGroup: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  filler: {
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
