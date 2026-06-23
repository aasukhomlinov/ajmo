import { Tabs } from 'expo-router';

import { theme } from '@/lib/theme';

// Step-1 scaffold: route group with the three MVP tabs. Discover is the default.
// The real bar is built in step 2 — iOS gets native Liquid Glass (_layout.ios.tsx),
// Android/web get our custom blur bar via a custom `tabBar` here.
export const unstable_settings = { initialRouteName: 'discover' };

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="discover"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent.base,
        tabBarInactiveTintColor: theme.colors.text.secondary,
        sceneStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
