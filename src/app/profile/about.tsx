import { useRouter } from 'expo-router';

import { AboutScreen } from '@/features/profile/AboutScreen';

export default function AboutRoute() {
  const router = useRouter();
  return <AboutScreen onBack={() => router.back()} />;
}
