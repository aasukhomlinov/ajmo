import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';

// iOS: the real system Liquid Glass tab bar (Expo Router native tabs). We do NOT
// restyle the glass — the system draws it (and the iOS 26 selection highlight).
// Per DS node 58:21: icon-only (labels hidden), neutral active state. The bar
// can't render Phosphor SVG components, so it consumes template PNGs rasterized
// from the SAME Phosphor glyphs (assets/tab-icons/, via npm run generate-tab-icons).
// iOS tints the template masks: idle = text/secondary, selected = text/primary.
export const unstable_settings = { initialRouteName: 'discover' };

export default function TabsLayoutIOS() {
  const t = useT();
  return (
    <NativeTabs
      iconColor={{
        default: theme.colors.text.secondary,
        selected: theme.colors.text.primary,
      }}
    >
      <NativeTabs.Trigger name="discover">
        <NativeTabs.Trigger.Icon
          src={{
            default: require('../../../assets/tab-icons/compass.png'),
            selected: require('../../../assets/tab-icons/compass-fill.png'),
          }}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label hidden>{t('tabs.discover')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Icon
          src={{
            default: require('../../../assets/tab-icons/bookmark.png'),
            selected: require('../../../assets/tab-icons/bookmark-fill.png'),
          }}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label hidden>{t('tabs.saved')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          src={{
            default: require('../../../assets/tab-icons/user.png'),
            selected: require('../../../assets/tab-icons/user-fill.png'),
          }}
          renderingMode="template"
        />
        <NativeTabs.Trigger.Label hidden>{t('tabs.profile')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
