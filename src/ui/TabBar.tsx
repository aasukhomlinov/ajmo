import { BlurView } from 'expo-blur';
import { BookmarkSimple, Compass, User, type Icon } from 'phosphor-react-native';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/lib/theme';

import type { Tabs } from 'expo-router';

// DS TabBar (node 58:21) — Android / non-iOS fallback for the native Liquid Glass
// bar. iOS uses the real system bar via app/(tabs)/_layout.ios.tsx; this is the
// matching custom blur capsule. Per the DS: icon-only, NEUTRAL active state
// (frosted pill behind a Fill-weight glyph in text/primary), outline + secondary
// when idle. No labels, no lime — lime stays reserved for CTAs/badges.
// Glass constants come from theme.glass / theme.colors.glass.

// Custom tabBar receives react-navigation's BottomTabBarProps. Derive the type
// from expo-router's Tabs so we don't depend on a deep package subpath.
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICON_SIZE = 24;
// expo-blur intensity is a 0–100 scale (not px); this approximates the DS
// Glass/Bar backdrop blur (theme.glass.blur = 28) for the Android fallback.
const BLUR_INTENSITY = 48;

const TAB_ICONS: Record<string, Icon> = {
  discover: Compass,
  saved: BookmarkSimple,
  profile: User,
};

export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom + theme.spacing.sm }]}
    >
      <BlurView intensity={BLUR_INTENSITY} tint="dark" style={styles.capsule}>
        <View style={styles.fill} pointerEvents="none" />
        {state.routes.map((route, index) => {
          const Glyph = TAB_ICONS[route.name];
          if (!Glyph) return null;

          const isActive = state.index === index;
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isActive && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={label}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Glyph
                size={ICON_SIZE}
                weight={isActive ? 'fill' : 'regular'}
                color={isActive ? theme.colors.text.primary : theme.colors.text.secondary}
              />
            </Pressable>
          );
        })}
        {/* Top specular highlight (DS Glass/Bar inner shadow, approximated). */}
        <View style={styles.specular} pointerEvents="none" />
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'stretch',
    paddingHorizontal: theme.spacing.xl,
  },
  capsule: {
    flexDirection: 'row',
    padding: theme.spacing.xs,
    borderRadius: theme.radii.full,
    overflow: 'hidden',
    ...theme.glass.shadow,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.glass.fill,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.full,
  },
  tabActive: {
    backgroundColor: theme.colors.glass.activePill,
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.glass.specular.shadowColor,
  },
});
