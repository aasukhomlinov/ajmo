import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityPicker } from '@/features/city/CityPicker';
import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';
import { Button, Header, Screen, Text } from '@/ui';

// Onboarding "What's your location?" step (frame 284:1496) — shown once after
// sign-in. Reuses the shared CityPicker; the chrome differs from the in-app
// /city route: an H1 prompt (no centered header title) and a Continue CTA that
// advances the flow. Selecting a city writes the store immediately (the check
// moves); Continue advances. The full onboarding/auth flow is wired in a later
// phase — Continue's navigation is a placeholder for now.
export default function OnboardingCityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <Screen>
      <Header variant="compact" title="" onBack={() => router.back()} />

      <View style={styles.body}>
        <Text variant="h1" style={styles.prompt}>
          {t('city.onboardingPrompt')}
        </Text>
        <CityPicker />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        {/* Placeholder advance — the real onboarding/auth flow lands later. */}
        <Button label={t('common.continue')} fullWidth onPress={() => router.replace('/discover')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: theme.spacing.lg,
  },
  prompt: {
    paddingHorizontal: theme.spacing.lg,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
});
