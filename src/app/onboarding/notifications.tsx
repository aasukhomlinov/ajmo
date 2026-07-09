import { NotificationsPermissionScreen } from '@/features/auth/NotificationsPermissionScreen';

// Onboarding step 2 (frame 253:1322): notifications permission, after the city
// picker. Finishing (either choice) completes onboarding → the gate opens the tabs.
export default function OnboardingNotificationsRoute() {
  return <NotificationsPermissionScreen />;
}
