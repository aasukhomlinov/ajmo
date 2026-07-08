import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_VERSION_NUMBER } from '@/lib/appInfo';
import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';
import { Divider, Header, Logo, Text } from '@/ui';

// About (frame 276:1483). Static identity screen: the lime ajmo wordmark, the
// tagline, the app version (from the Expo config), and a credit line. No links
// live on this screen — the Privacy/Terms links sit on the Profile hub.
const LOGO_HEIGHT = 48;

export interface AboutScreenProps {
  onBack?: () => void;
}

export function AboutScreen({ onBack }: AboutScreenProps) {
  const t = useT();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title={t('about.title')} variant="compact" onBack={onBack} />

      <View style={styles.content}>
        <View style={styles.identity}>
          <Logo height={LOGO_HEIGHT} />
          <Text variant="body" color={theme.colors.text.secondary} style={styles.centered}>
            {t('about.tagline')}
          </Text>
          <Text variant="bodySmall" color={theme.colors.text.secondary} style={styles.centered}>
            {t('about.version', { version: APP_VERSION_NUMBER })}
          </Text>
        </View>

        <Divider />

        <Text variant="bodySmall" color={theme.colors.text.secondary} style={styles.centered}>
          {t('about.credit')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    paddingTop: theme.spacing['5xl'],
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.lg,
    alignItems: 'center',
  },
  identity: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  centered: {
    textAlign: 'center',
  },
});
