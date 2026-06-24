import { MapPin } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { theme } from '@/lib/theme';
import { Text } from '@/ui/Text';

import { openInMaps } from './maps';

// Event Detail LOCATION snippet — a SCREEN-LEVEL pattern, not a src/ui primitive
// (see figma-design-system.md). MVP has no maps SDK and no static-tiles key, so
// instead of a rendered basemap we draw a stylised placeholder: a faint street
// grid on surface/raised + a lime Phosphor pin (the DS "active marker"), with
// the address beneath. Tapping launches the user's maps app (openInMaps).
const HEIGHT = 160;
const PIN_SIZE = 40;

// Faint grid lines (fractions of width/height) that read as a map without faking
// a real one. Drawn in the border token at low opacity.
const V_LINES = [0.22, 0.46, 0.7, 0.88];
const H_LINES = [0.3, 0.62];

export interface LocationPreviewProps {
  lat: number;
  lng: number;
  venueName: string;
  address: string;
}

export function LocationPreview({ lat, lng, venueName, address }: LocationPreviewProps) {
  return (
    <Pressable
      style={styles.container}
      onPress={() => openInMaps({ lat, lng }, `${venueName}, ${address}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${venueName} in a maps app`}
    >
      <View style={styles.map}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          {V_LINES.map((x) => (
            <Line
              key={`v${x}`}
              x1={`${x * 100}%`}
              y1="0"
              x2={`${x * 100}%`}
              y2="100%"
              stroke={theme.colors.border}
              strokeWidth={1}
            />
          ))}
          {H_LINES.map((y) => (
            <Line
              key={`h${y}`}
              x1="0"
              y1={`${y * 100}%`}
              x2="100%"
              y2={`${y * 100}%`}
              stroke={theme.colors.border}
              strokeWidth={1}
            />
          ))}
          {/* A single brighter "road" to break the grid up. */}
          <Line
            x1="0"
            y1="100%"
            x2="100%"
            y2="22%"
            stroke={theme.colors.surface.base}
            strokeWidth={6}
          />
        </Svg>

        <View style={styles.pin} pointerEvents="none">
          <MapPin size={PIN_SIZE} weight="fill" color={theme.colors.accent.base} />
        </View>
      </View>

      <Text variant="bodySmall" color={theme.colors.text.secondary} numberOfLines={1}>
        {address}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.sm,
  },
  map: {
    height: HEIGHT,
    width: '100%',
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface.raised,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    ...theme.shadows.raised,
  },
});
