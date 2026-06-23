import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// Uppercase group label above a list section (Saved, Profile, filters). Uses
// the `sectionHeader` type preset (condensed bold, uppercase baked into the
// token). Optional trailing slot for a count/action.
export interface ListSectionHeaderProps {
  title: string;
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ListSectionHeader({ title, trailing, style }: ListSectionHeaderProps) {
  return (
    <View style={[styles.base, style]}>
      <Text variant="sectionHeader" color={theme.colors.text.secondary} style={styles.title}>
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
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.sm,
  },
  title: {
    flex: 1,
  },
});
