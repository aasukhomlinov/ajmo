import { useRouter } from 'expo-router';

import { CityPicker } from '@/features/city/CityPicker';
import { useT } from '@/lib/i18n';
import { Header, Screen } from '@/ui';

// In-app city picker (frame 275:1451) — opened from the Discover header pill.
// Selecting a city writes the store and closes; the Discover header label and
// the city-scoped feed update to the new city on return.
export default function CityScreen() {
  const router = useRouter();
  const t = useT();
  return (
    <Screen>
      <Header title={t('city.chooseTitle')} variant="compact" onBack={() => router.back()} />
      <CityPicker searchable onSelect={() => router.back()} />
    </Screen>
  );
}
