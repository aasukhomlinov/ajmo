import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { PRIVACY_URL, TERMS_URL } from '@/lib/appInfo';
import { useT } from '@/lib/i18n';
import { richTemplate } from '@/lib/i18n/rich';
import { theme } from '@/lib/theme';
import { Button, Logo, Text } from '@/ui';

// Auth landing (frame 282:5467) — full-bleed crowd photo dissolving into bg,
// white wordmark top-left, Display copy, and the sign-in options. Apple/Google
// are NATIVE-BRAND buttons (marked "not DS" in the frame) and OAuth is out of
// scope this phase (no dev account yet) — they render DISABLED as coming-soon
// placeholders; only "Continue with email" is live. The final implementation
// swaps them for the real native-branded buttons.
const HERO_HEIGHT_RATIO = 0.6;
const SCRIM_HEIGHT = 200;
const TOP_SCRIM_HEIGHT = 129;

// Frame: logo 96pt wide at 98:33 ratio → height 32.
const LOGO_HEIGHT = 32;

// Brand marks from the frame (vendor-fixed artwork, not DS icons).
function AppleMark() {
  return (
    <Svg width={15} height={18} viewBox="0 0 15 18" fill="none">
      <Path
        d="M11.9543 9.44648C11.9473 8.15625 12.5309 7.18242 13.7121 6.46523C13.0512 5.51953 12.0527 4.99922 10.7344 4.89727C9.48633 4.79883 8.12227 5.625 7.62305 5.625C7.0957 5.625 5.88633 4.93242 4.93711 4.93242C2.97539 4.96406 0.890625 6.49688 0.890625 9.61523C0.890625 10.5363 1.05937 11.4879 1.39687 12.4699C1.84687 13.7602 3.47109 16.9242 5.16562 16.8715C6.05156 16.8504 6.67734 16.2422 7.83047 16.2422C8.94844 16.2422 9.52852 16.8715 10.5164 16.8715C12.225 16.8469 13.6945 13.9711 14.1234 12.6773C11.8312 11.598 11.9543 9.51328 11.9543 9.44648ZM9.96445 3.67383C10.9242 2.53477 10.8363 1.49766 10.8082 1.125C9.96094 1.17422 8.98008 1.70156 8.42109 2.35195C7.80586 3.04805 7.44375 3.90938 7.52109 4.87969C8.43867 4.95 9.27539 4.47891 9.96445 3.67383Z"
        fill={theme.colors.constant.white}
      />
    </Svg>
  );
}

function GoogleMark() {
  // Google-brand colors are fixed by their sign-in guidelines.
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M18.1712 8.36792H17.5V8.33333H10V11.6667H14.7096C14.0225 13.6071 12.1762 15 10 15C7.23875 15 5 12.7612 5 10C5 7.23875 7.23875 5 10 5C11.2746 5 12.4342 5.48083 13.3171 6.26625L15.6742 3.90917C14.1858 2.52208 12.195 1.66667 10 1.66667C5.39792 1.66667 1.66667 5.39792 1.66667 10C1.66667 14.6021 5.39792 18.3333 10 18.3333C14.6021 18.3333 18.3333 14.6021 18.3333 10C18.3333 9.44125 18.2758 8.89583 18.1712 8.36792Z"
        fill="#FFC107"
      />
      <Path
        d="M2.6275 6.12125L5.36542 8.12917C6.10625 6.295 7.90042 5 10 5C11.2746 5 12.4342 5.48083 13.3171 6.26625L15.6742 3.90917C14.1858 2.52208 12.195 1.66667 10 1.66667C6.79917 1.66667 4.02333 3.47375 2.6275 6.12125Z"
        fill="#FF3D00"
      />
      <Path
        d="M10 18.3333C12.1525 18.3333 14.1083 17.5096 15.5871 16.17L13.0079 13.9875C12.1713 14.6212 11.1313 15 10 15C7.8325 15 5.99208 13.6179 5.29875 11.6892L2.58125 13.7829C3.96042 16.4817 6.76125 18.3333 10 18.3333Z"
        fill="#4CAF50"
      />
      <Path
        d="M18.1712 8.36792H17.5V8.33333H10V11.6667H14.7096C14.3796 12.5987 13.78 13.4025 13.0067 13.9879L15.5858 16.1704C15.4046 16.3354 18.3333 14.1667 18.3333 10C18.3333 9.44125 18.2758 8.89583 18.1712 8.36792Z"
        fill="#1976D2"
      />
    </Svg>
  );
}

interface BrandButtonProps {
  mark: React.ReactNode;
  label: string;
  kind: 'apple' | 'google';
}

// Disabled coming-soon stand-in for the native sign-in buttons.
function BrandButton({ mark, label, kind }: BrandButtonProps) {
  return (
    <View
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      style={[styles.brandButton, kind === 'apple' ? styles.brandApple : styles.brandGoogle]}
    >
      {mark}
      <Text
        variant="button"
        color={kind === 'apple' ? theme.colors.constant.white : theme.colors.constant.black}
      >
        {label}
      </Text>
    </View>
  );
}

export function WelcomeScreen() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroHeight = Math.round(height * HERO_HEIGHT_RATIO);

  const legal = richTemplate(t('auth.legal'), {
    terms: (
      <Text
        variant="caption"
        color={theme.colors.accent.base}
        onPress={() => void Linking.openURL(TERMS_URL)}
        suppressHighlighting
      >
        {t('auth.legalTerms')}
      </Text>
    ),
    privacy: (
      <Text
        variant="caption"
        color={theme.colors.accent.base}
        onPress={() => void Linking.openURL(PRIVACY_URL)}
        suppressHighlighting
      >
        {t('auth.legalPrivacy')}
      </Text>
    ),
  });

  return (
    <View style={styles.root}>
      <Image
        source={require('../../../assets/images/auth/auth-hero.jpg')}
        style={[styles.hero, { height: heroHeight }]}
        contentFit="cover"
      />
      {/* Photo dissolves into bg above the copy (frame scrim: 0 → 55% → solid). */}
      <View style={[styles.scrim, { top: heroHeight - SCRIM_HEIGHT, height: SCRIM_HEIGHT }]}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="welcomeScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.colors.bg} stopOpacity={0} />
              <Stop offset="0.55" stopColor={theme.colors.bg} stopOpacity={0.55} />
              <Stop offset="1" stopColor={theme.colors.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcomeScrim)" />
        </Svg>
      </View>
      {/* Mirrored scrim at the top keeps the status bar + wordmark legible. */}
      <View style={[styles.scrim, styles.topScrim]}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="welcomeTopScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.colors.bg} stopOpacity={1} />
              <Stop offset="0.45" stopColor={theme.colors.bg} stopOpacity={0.55} />
              <Stop offset="1" stopColor={theme.colors.bg} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#welcomeTopScrim)" />
        </Svg>
      </View>

      <View style={[styles.logo, { top: insets.top + theme.spacing.lg }]}>
        <Logo height={LOGO_HEIGHT} color={theme.colors.constant.white} />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <View style={styles.copy}>
          <Text variant="display">{t('auth.heroTitle')}</Text>
          <Text variant="body" color={theme.colors.text.secondary}>
            {t('auth.heroSubtitle')}
          </Text>
        </View>

        <View style={styles.buttons}>
          <BrandButton mark={<AppleMark />} label={t('auth.continueApple')} kind="apple" />
          <BrandButton mark={<GoogleMark />} label={t('auth.continueGoogle')} kind="google" />
          <Button
            label={t('auth.continueEmail')}
            type="secondary"
            fullWidth
            onPress={() => router.push('/email')}
          />
        </View>

        <Text variant="caption" color={theme.colors.text.secondary} style={styles.legal}>
          {legal}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  topScrim: {
    top: 0,
    height: TOP_SCRIM_HEIGHT,
  },
  logo: {
    position: 'absolute',
    left: theme.spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  copy: {
    gap: theme.spacing.sm,
  },
  buttons: {
    gap: theme.spacing.md,
  },
  brandButton: {
    minHeight: 44,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    // OAuth is out of scope this phase — coming-soon placeholders.
    opacity: 0.4,
  },
  brandApple: {
    backgroundColor: theme.colors.constant.black,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  brandGoogle: {
    backgroundColor: theme.colors.constant.white,
  },
  legal: {
    textAlign: 'center',
  },
});
