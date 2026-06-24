import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { theme } from '@/lib/theme';
import { Button, Logo } from '@/ui';

export default function HomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Logo height={48} />
      {/* Temporary dev entries — remove once the auth gate becomes the entry point. */}
      <Button label="Open app (tabs)" onPress={() => router.push('/discover')} />
      <Button
        label="Event reminders"
        type="secondary"
        onPress={() => router.push('/reminders')}
      />
      <Button
        label="UI Gallery"
        type="text"
        onPress={() => router.push('/gallery')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
    gap: theme.spacing['2xl'],
  },
});
