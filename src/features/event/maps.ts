import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';

// "Open in maps app" launcher for the Event Detail LocationPreview. We ship NO
// maps SDK (CLAUDE.md), so this just hands a coordinate off to whatever native
// maps app the user has installed, detected via Linking.canOpenURL.
//
// IMPORTANT: canOpenURL only returns true for a scheme that is declared in
// app.json → ios.infoPlist.LSApplicationQueriesSchemes. All four schemes below
// MUST stay in sync with that list or iOS silently reports the app as missing.

export interface GeoPoint {
  lat: number;
  lng: number;
}

interface MapsApp {
  name: string;
  /** Probe URL for canOpenURL (the app's custom scheme). */
  scheme: string;
  /** Deep link to drop a pin at a coordinate. */
  url: (point: GeoPoint) => string;
}

const MAPS_APPS: MapsApp[] = [
  { name: 'Apple Maps', scheme: 'maps://', url: ({ lat, lng }) => `maps://?q=${lat},${lng}` },
  {
    name: 'Google Maps',
    scheme: 'comgooglemaps://',
    url: ({ lat, lng }) => `comgooglemaps://?q=${lat},${lng}`,
  },
  {
    name: 'Yandex Maps',
    scheme: 'yandexmaps://',
    url: ({ lat, lng }) => `yandexmaps://maps.yandex.ru/?pt=${lng},${lat}`,
  },
  { name: '2GIS', scheme: 'dgis://', url: ({ lat, lng }) => `dgis://2gis.ru/geo/${lng},${lat}` },
];

// Keyless web fallback when no native maps app is reachable (e.g. bare Android).
const WEB_FALLBACK: MapsApp = {
  name: 'Google Maps',
  scheme: 'https://',
  url: ({ lat, lng }) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
};

/** Probe installed maps apps. Apple Maps is always present on iOS (system app). */
async function availableApps(): Promise<MapsApp[]> {
  const checks = await Promise.all(
    MAPS_APPS.map(async (app) => {
      if (app.name === 'Apple Maps' && Platform.OS === 'ios') return app; // guaranteed
      try {
        return (await Linking.canOpenURL(app.scheme)) ? app : null;
      } catch {
        return null;
      }
    }),
  );
  const found = checks.filter((app): app is MapsApp => app !== null);
  return found.length > 0 ? found : [WEB_FALLBACK];
}

/**
 * Open `point` in a maps app. With one match, launches it directly; with several
 * (e.g. Apple + Google installed), shows a native action sheet listing only the
 * apps actually present. `label` titles the sheet (venue name + address).
 */
export async function openInMaps(point: GeoPoint, label: string): Promise<void> {
  const apps = await availableApps();

  if (apps.length === 1) {
    void Linking.openURL(apps[0].url(point));
    return;
  }

  if (Platform.OS === 'ios') {
    const options = [...apps.map((app) => app.name), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      { title: label, options, cancelButtonIndex: options.length - 1 },
      (index) => {
        if (index < apps.length) void Linking.openURL(apps[index].url(point));
      },
    );
    return;
  }

  Alert.alert('Open in Maps', label, [
    ...apps.map((app) => ({ text: app.name, onPress: () => void Linking.openURL(app.url(point)) })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
