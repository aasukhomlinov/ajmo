import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useProfileBootstrap } from '@/features/auth/useProfileBootstrap';
import { queryClient } from '@/lib/queryClient';
import { useAuth, useAuthStatus, useOnboarded } from '@/lib/stores/auth';
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

  // Restore the persisted session once; saves/city/settings are user-scoped
  // Supabase data hydrated by useProfileBootstrap (inside the provider below).
  useEffect(() => {
    void useAuth.getState().hydrate();
  }, []);

  return (
    // Required at the app root for react-native-gesture-handler (Swipeable on the
    // Saved rows). Expo Router doesn't wrap this automatically.
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <RootNavigator fontsReady={fontsLoaded || fontError != null} />
        <StatusBar style="light" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

interface RootNavigatorProps {
  fontsReady: boolean;
}

// Separate component so the profile bootstrap can use react-query (the provider
// is rendered by RootLayout above).
function RootNavigator({ fontsReady }: RootNavigatorProps) {
  const authStatus = useAuthStatus();
  const onboarded = useOnboarded();

  // While signed in, load the profile + saves and mirror them into the stores
  // before the gate renders — the app comes up with the USER'S city/language/
  // prefs, not defaults (no flash of empty state).
  const profileReady = useProfileBootstrap();

  // Hold the native splash until fonts, the persisted session AND the profile
  // mirrors are in: rendering the navigator earlier would flash the auth flow
  // (or default settings) at signed-in users before the gate flips.
  const ready = fontsReady && authStatus !== 'restoring' && profileReady;
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
    /* HARD GATE (CLAUDE.md): no guest browsing. Guards route by session +
       onboarding state; when a guard flips, expo-router redirects to the
       first available screen (sign-out → auth, onboarding done → tabs).
       auth/callback stays outside the guards — the magic link must be
       handleable from both gate states. */
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
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
