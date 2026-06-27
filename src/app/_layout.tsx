import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { queryClient } from '@/lib/queryClient';
import { useCity } from '@/lib/stores/city';
import { useSaves } from '@/lib/stores/saves';
import { useSettings } from '@/lib/stores/settings';
import { theme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Static cuts instanced from the variable master (scripts/build-fonts.py).
  // RN can't drive variable axes at runtime, so each type preset ships as its
  // own family with weight/width/opsz baked in. Regenerate: npm run generate-fonts.
  const [fontsLoaded, fontError] = useFonts({
    'TikTokSans-Display': require('../../assets/fonts/TikTokSans-Display.ttf'),
    'TikTokSans-H1': require('../../assets/fonts/TikTokSans-H1.ttf'),
    'TikTokSans-H2': require('../../assets/fonts/TikTokSans-H2.ttf'),
    'TikTokSans-Body': require('../../assets/fonts/TikTokSans-Body.ttf'),
    'TikTokSans-Caption': require('../../assets/fonts/TikTokSans-Caption.ttf'),
    'TikTokSans-Button': require('../../assets/fonts/TikTokSans-Button.ttf'),
    'TikTokSans-Section': require('../../assets/fonts/TikTokSans-Section.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Load persisted saves + active city + app settings once so the feed/detail/
  // Saved screen, the city scope and the Profile settings reflect them on launch
  // (local stores; swap to per-user Supabase queries later).
  useEffect(() => {
    void useSaves.getState().hydrate();
    void useCity.getState().hydrate();
    void useSettings.getState().hydrate();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    // Required at the app root for react-native-gesture-handler (Swipeable on the
    // Saved rows). Expo Router doesn't wrap this automatically.
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.bg },
          }}
        />
        <StatusBar style="light" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
