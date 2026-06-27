import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { PRIVACY_URL, TERMS_URL } from '@/lib/appInfo';

// Profile tab = the settings hub. Rows navigate to the sub-screens (pushed over
// the tab bar) or open external legal links. No auth/account wiring in v1.
export default function ProfileTab() {
  const router = useRouter();
  return (
    <ProfileScreen
      onOpenLanguage={() => router.push('/profile/language')}
      onOpenReminders={() => router.push('/profile/reminders')}
      onOpenAbout={() => router.push('/profile/about')}
      onOpenPrivacy={() => Linking.openURL(PRIVACY_URL)}
      onOpenTerms={() => Linking.openURL(TERMS_URL)}
    />
  );
}
