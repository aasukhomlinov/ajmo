import { Tabs } from 'expo-router';

import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';
import { TabBar } from '@/ui';

// Android / web: our custom Liquid-Glass-matching blur bar (src/ui/TabBar).
// iOS overrides this file with _layout.ios.tsx (real system glass via NativeTabs).
// Discover is the default tab. The bar is icon-only — titles are accessibility
// labels, localized like the rest of the chrome.
export const unstable_settings = { initialRouteName: 'discover' };

export default function TabsLayout() {
  const t = useT();
  return (
    <Tabs
      initialRouteName="discover"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Tabs.Screen name="discover" options={{ title: t('tabs.discover') }} />
      <Tabs.Screen name="saved" options={{ title: t('tabs.saved') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
