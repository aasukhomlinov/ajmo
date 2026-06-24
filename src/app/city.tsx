import { useRouter } from 'expo-router';

import { EmptyState, Header, Screen } from '@/ui';

// Placeholder — the city picker (Belgrade / Novi Sad) is built in a later phase.
// Discover routes here from the header city pill; for now it just shows intent.
export default function CityScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Choose city" variant="compact" onBack={() => router.back()} />
      <EmptyState
        title="City picker coming soon"
        description="Belgrade and Novi Sad — a manual 2-item picker lands in a later phase."
      />
    </Screen>
  );
}
