import { useRouter } from 'expo-router';

import { EmptyState, Header, Screen } from '@/ui';

// Placeholder — the search screen is built in a later phase. Discover routes here
// from the header search button; for now it just shows intent.
export default function SearchScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Search" variant="compact" onBack={() => router.back()} />
      <EmptyState
        title="Search coming soon"
        description="Full-text event search across the active city lands in a later phase."
      />
    </Screen>
  );
}
