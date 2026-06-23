import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

// Hairline separator between flat dark layers (color/border). `inset` insets
// both ends; defaults to a full-bleed line. Structural primitive (no dedicated
// DS node) — the DS expresses dividers as the border token.
export interface DividerProps {
  inset?: number;
  style?: StyleProp<ViewStyle>;
}

export function Divider({ inset = 0, style }: DividerProps) {
  return <View style={[styles.line, { marginHorizontal: inset }, style]} />;
}

const styles = StyleSheet.create({
  line: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
});
