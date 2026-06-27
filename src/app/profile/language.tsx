import { useRouter } from 'expo-router';

import { LanguageScreen } from '@/features/profile/LanguageScreen';

export default function LanguageRoute() {
  const router = useRouter();
  return <LanguageScreen onBack={() => router.back()} />;
}
