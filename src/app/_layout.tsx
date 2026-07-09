import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/lib/stores/auth';
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

  const authStatus = useAuth((s) => s.status);
  const onboarded = useAuth((s) => s.onboarded);

  // Load the persisted session + saves + active city + app settings once so
  // the gate and every screen reflect them on launch (saves/city/settings are
  // local stores; Auth-2 swaps them to per-user Supabase queries).
  useEffect(() => {
    void useAuth.getState().hydrate();
    void useSaves.getState().hydrate();
    void useCity.getState().hydrate();
    void useSettings.getState().hydrate();
  }, []);

  // Hold the native splash until BOTH fonts and the persisted session are in:
  // rendering the navigator earlier would flash the auth flow at signed-in
  // users before the gate flips.
  const ready = (fontsLoaded || fontError != null) && authStatus !== 'restoring';
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  const signedIn = authStatus === 'signedIn';

  return (
    // Required at the app root for react-native-gesture-handler (Swipeable on the
    // Saved rows). Expo Router doesn't wrap this automatically.
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        {/* HARD GATE (CLAUDE.md): no guest browsing. Guards route by session +
            onboarding state; when a guard flips, expo-router redirects to the
            first available screen (sign-out → auth, onboarding done → tabs).
            auth/callback stays outside the guards — the magic link must be
            handleable from both gate states. */}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.bg },
          }}
        >
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && !onboarded}>
            <Stack.Screen name="onboarding/city" />
            <Stack.Screen name="onboarding/notifications" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && onboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="search" />
            <Stack.Screen name="event/[id]" />
            <Stack.Screen name="city" />
            <Stack.Screen name="profile/language" />
            <Stack.Screen name="profile/reminders" />
            <Stack.Screen name="profile/about" />
            <Stack.Screen name="gallery" />
          </Stack.Protected>
          <Stack.Screen name="auth/callback" />
        </Stack>
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
