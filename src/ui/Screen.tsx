import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { theme } from '@/lib/theme';

// Screen container — bg/base fill + safe-area insets. `scroll` swaps the body
// for a ScrollView; `padded` applies the standard spacing/lg gutter. Structural
// primitive (no dedicated DS node): derived from tokens only.
const DEFAULT_EDGES: readonly Edge[] = ['top'];

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  scroll = false,
  padded = false,
  edges = DEFAULT_EDGES,
  style,
  contentContainerStyle,
}: ScreenProps) {
  const padding = padded ? styles.padded : null;

  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scrollContent, padding, contentContainerStyle]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.body, padding, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  padded: {
    padding: theme.spacing.lg,
  },
});
