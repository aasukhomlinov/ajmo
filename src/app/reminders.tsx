import { useRouter } from 'expo-router';

import { RemindersScreen } from '@/features/settings/RemindersScreen';

export default function RemindersRoute() {
  const router = useRouter();
  return <RemindersScreen onBack={() => router.back()} />;
}
