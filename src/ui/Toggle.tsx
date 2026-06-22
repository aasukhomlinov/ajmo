import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

// Switch — 52×32 track, radius/full. On: lime track + dark on-accent knob (right).
// Off: surface + hairline, light primary knob (left). Disabled dims.
const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const KNOB_SIZE = 24;

export interface ToggleProps {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Toggle({ value, onValueChange, disabled = false, style }: ToggleProps) {
  return (
    <Pressable
      onPress={() => onValueChange?.(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[
        styles.track,
        value ? styles.trackOn : styles.trackOff,
        { justifyContent: value ? 'flex-end' : 'flex-start' },
        disabled && styles.disabled,
        style,
      ]}
    >
      <View
        style={[
          styles.knob,
          { backgroundColor: value ? theme.colors.text.onAccent : theme.colors.text.primary },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: theme.radii.full,
    paddingHorizontal: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  trackOn: {
    backgroundColor: theme.colors.accent.base,
  },
  trackOff: {
    backgroundColor: theme.colors.surface.base,
    borderColor: theme.colors.border,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: theme.radii.full,
  },
  disabled: {
    opacity: 0.4,
  },
});
