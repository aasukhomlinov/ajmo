import { StartScreen } from '@/features/auth/StartScreen';

// '/' while signed out — the start splash (frame 217:1271). Signed-in users
// never land here: the root gate redirects them into the tabs.
export default function StartRoute() {
  return <StartScreen />;
}
