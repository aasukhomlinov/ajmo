import { Tabs } from 'expo-router';

import { theme } from '@/lib/theme';
import { TabBar } from '@/ui';

// Android / web: our custom Liquid-Glass-matching blur bar (src/ui/TabBar).
// iOS overrides this file with _layout.ios.tsx (real system glass via NativeTabs).
// Discover is the default tab.
export const unstable_settings = { initialRouteName: 'discover' };

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="discover"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Tabs.Screen name="discover" options={{ title: 'Discover' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
