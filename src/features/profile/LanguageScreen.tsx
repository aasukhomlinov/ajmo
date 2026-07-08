import { Check } from 'phosphor-react-native';
import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/lib/i18n';
import { LANGUAGES, useLanguage, useSettings } from '@/lib/stores/settings';
import { theme } from '@/lib/theme';
import { Divider, Header, ListRow, Text } from '@/ui';

// Language picker (frame 207:1181). Single-select list of the app languages;
// the active one shows a lime check. Selecting writes the settings store, which
// re-renders every useT() consumer — the whole UI switches language instantly.
// Row labels stay in their OWN language (English / Srpski / Русский) by design.
const CHECK_SIZE = 20;

export interface LanguageScreenProps {
  onBack?: () => void;
}

export function LanguageScreen({ onBack }: LanguageScreenProps) {
  const t = useT();
  const language = useLanguage();
  const setLanguage = useSettings((s) => s.setLanguage);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title={t('profile.language')} variant="compact" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text variant="sectionHeader" color={theme.colors.text.secondary}>
            {t('language.appLanguage')}
          </Text>
          <View style={styles.card}>
            {LANGUAGES.map((lang, index) => (
              <Fragment key={lang.id}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  label={lang.name}
                  onPress={() => setLanguage(lang.id)}
                  showChevron={false}
                  trailing={
                    lang.id === language ? (
                      <Check size={CHECK_SIZE} color={theme.colors.accent.base} />
                    ) : undefined
                  }
                />
              </Fragment>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.surface.base,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
});
