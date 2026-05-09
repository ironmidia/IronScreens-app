// Iron Screens — Local Storage Service (AsyncStorage equivalent)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';

export async function saveTerminal(terminalId: string, orientation: string, name: string): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.TERMINAL_ID, terminalId],
    [STORAGE_KEYS.TERMINAL_ORIENTATION, orientation],
    [STORAGE_KEYS.TERMINAL_NAME, name],
  ]);
}

export async function loadTerminal(): Promise<{
  terminalId: string | null;
  orientation: string | null;
  name: string | null;
}> {
  const results = await AsyncStorage.multiGet([
    STORAGE_KEYS.TERMINAL_ID,
    STORAGE_KEYS.TERMINAL_ORIENTATION,
    STORAGE_KEYS.TERMINAL_NAME,
  ]);

  return {
    terminalId: results[0][1],
    orientation: results[1][1],
    name: results[2][1],
  };
}

export async function clearTerminal(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.TERMINAL_ID,
    STORAGE_KEYS.TERMINAL_ORIENTATION,
    STORAGE_KEYS.TERMINAL_NAME,
  ]);
}

export async function saveGroupIndices(indices: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.GROUP_INDICES, JSON.stringify(indices));
}

export async function loadGroupIndices(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.GROUP_INDICES);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
