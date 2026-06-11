import { StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/lib/fonts';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>ajmo</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    fontFamily: fonts.sans,
    fontSize: 24,
  },
});
