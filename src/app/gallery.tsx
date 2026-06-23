import { useRouter } from 'expo-router';

import { Gallery } from '@/features/dev/Gallery';

export default function GalleryRoute() {
  const router = useRouter();
  return <Gallery onBack={() => router.back()} />;
}
