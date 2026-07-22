import { useEffect, useRef } from 'react';
import { Platform, AppState, BackHandler, ToastAndroid, NativeModules, Linking } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import * as IntentLauncher from 'expo-intent-launcher';

async function enableImmersiveMode() {
  if (Platform.OS === 'android') {
    await NavigationBar.setVisibilityAsync('hidden');
    await NavigationBar.setBehaviorAsync('overlay-swipe');
    await NavigationBar.setPositionAsync('absolute');
    await NavigationBar.setBackgroundColorAsync('#00000000');
  }
}

async function requestOverlayPermission() {
  if (Platform.OS !== 'android') return;
  try {
    // Verifica se já tem a permissão via Settings.canDrawOverlays
    const { data } = await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.MANAGE_OVERLAY_PERMISSION,
      { data: 'package:com.ironmidia.ironscreens' }
    );
  } catch (e) {
    // Fallback: abre as configurações do app diretamente
    Linking.openURL('package:com.ironmidia.ironscreens');
  }
}

export default function RootLayout() {
  const backPressedOnce = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const overlayRequested = useRef(false);

  useEffect(() => {
    enableImmersiveMode();

    // Solicita permissão de sobreposição apenas uma vez
    if (Platform.OS === 'android' && !overlayRequested.current) {
      overlayRequested.current = true;
      requestOverlayPermission();
    }

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
        <Stack.Screen name="debug-rotation" />
        <Stack.Screen name="terminals" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}