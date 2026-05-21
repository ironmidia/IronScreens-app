// Iron Screens — Root Layout
import { useEffect, useRef } from 'react';
import { Platform, AppState, BackHandler, ToastAndroid } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';

async function enableImmersiveMode() {
  if (Platform.OS === 'android') {
    await NavigationBar.setVisibilityAsync('hidden');
    await NavigationBar.setBehaviorAsync('immersive-sticky');
    await NavigationBar.setPositionAsync('absolute');
    await NavigationBar.setBackgroundColorAsync('#00000000');
  }
}

export default function RootLayout() {
  const backPressedOnce = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    enableImmersiveMode();

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        enableImmersiveMode();
      }
    });

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pathname === '/player') {
        if (backPressedOnce.current) {
          backPressedOnce.current = false;
          router.replace('/setup');
          return true;
        }
        backPressedOnce.current = true;
        ToastAndroid.show('Pressione voltar novamente para trocar o terminal', ToastAndroid.SHORT);
        setTimeout(() => { backPressedOnce.current = false; }, 2000);
        return true;
      }
      return false;
    });

    return () => {
      appStateSubscription.remove();
      backHandler.remove();
    };
  }, [pathname, router]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" hidden={true} translucent={true} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="setup" />
        <Stack.Screen name="player" />
        <Stack.Screen name="terminals" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
