// Iron Screens — Entry Point (auto-redirect)
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { loadTerminal } from '@/services/storageService';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      const { terminalId } = await loadTerminal();
      if (terminalId) {
        router.replace('/player');
      } else {
        router.replace('/setup');
      }
    }
    redirect();
  }, []);

  return <View style={styles.black} />;
}

const styles = StyleSheet.create({
  black: {
    flex: 1,
    backgroundColor: '#000',
  },
});
