// Iron Screens — Device Identity
// Gera e persiste um identificador único por instalação do app, usado para
// detectar quando dois aparelhos físicos tentam usar o mesmo terminal.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { STORAGE_KEYS } from '@/constants/config';

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const stored = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (stored) {
    cachedDeviceId = stored;
    return stored;
  }

  const generated = Crypto.randomUUID();
  await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, generated);
  cachedDeviceId = generated;
  return generated;
}
