import { Stack } from 'expo-router';

import { theme } from '@/lib/theme';

// Signed-out flow: start splash → welcome landing → email → sent / expired.
// Mounted only while there is no session (see the root-layout gate).
export const unstable_settings = { initialRouteName: 'index' };

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    />
  );
}
