import { Image } from 'expo-image';
import { MapPin } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { theme } from '@/lib/theme';
import { Text } from '@/ui/Text';

import { openInMaps } from './maps';

// Event Detail LOCATION snippet — a SCREEN-LEVEL pattern, not a src/ui primitive
// (see figma-design-system.md). Renders a real dark Mapbox static map centered
// on the venue with OUR lime Phosphor pin overlaid on center (brand consistency
// over a Mapbox marker). When no Mapbox token is configured it falls back to a
// stylised grid placeholder instead of crashing. Tapping the block launches the
// user's maps app (openInMaps) — unchanged.
const HEIGHT = 160;
const PIN_SIZE = 40;

// Static image request (logical px; @2x doubles the served resolution). Wider
// than the box so contentFit="cover" can crop without upscaling. The map is
// centered on the venue, so the centered pin marks the exact spot.
const MAP_W = 600;
const MAP_H = 280;
const MAP_ZOOM = 15;

// Public client token, inlined by Metro from .env. Absent in some setups → we
// fall back to the placeholder below.
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

/** Mapbox Static Images URL — dark-v11, centered on the venue, retina, no
 *  Mapbox marker/logo/attribution (we overlay our own pin). */
function staticMapUrl(lat: number, lng: number): string | undefined {
  if (!MAPBOX_TOKEN) return undefined;
  return (
    'https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/' +
    `${lng},${lat},${MAP_ZOOM}/${MAP_W}x${MAP_H}@2x` +
    `?access_token=${MAPBOX_TOKEN}&logo=false&attribution=false`
  );
}

// Fallback placeholder grid (used only when no token). Faint lines that read as
// a map without faking a real one.
const V_LINES = [0.22, 0.46, 0.7, 0.88];
const H_LINES = [0.3, 0.62];

export interface LocationPreviewProps {
  lat: number;
  lng: number;
  venueName: string;
  address: string;
}

export function LocationPreview({ lat, lng, venueName, address }: LocationPreviewProps) {
  const mapUrl = staticMapUrl(lat, lng);

  return (
    <Pressable
      style={styles.container}
      onPress={() => openInMaps({ lat, lng }, `${venueName}, ${address}`)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${venueName} in a maps app`}
    >
      <View style={styles.map}>
        {mapUrl ? (
          <Image
            source={{ uri: mapUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
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
            <Line
              x1="0"
              y1="100%"
              x2="100%"
              y2="22%"
              stroke={theme.colors.surface.base}
              strokeWidth={6}
            />
          </Svg>
        )}

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
