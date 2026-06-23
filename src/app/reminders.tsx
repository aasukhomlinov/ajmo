import { useRouter } from 'expo-router';

import { RemindersScreen } from '@/features/profile/RemindersScreen';

export default function RemindersRoute() {
  const router = useRouter();
  return <RemindersScreen onBack={() => router.back()} />;
}
