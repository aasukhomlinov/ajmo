import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { queryClient } from '@/lib/queryClient';
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

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      />
      <StatusBar style="light" />
    </QueryClientProvider>
  );
}
