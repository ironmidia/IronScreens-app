// Iron Screens — Local Storage Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/config';
import { PlaybackItem } from '@/services/models';

// ─── Terminal ────────────────────────────────────────────────────────────────

export async function saveTerminal(
  terminalId: string,
  orientation: string,
  name: string
): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.TERMINAL_ID,          terminalId],
    [STORAGE_KEYS.TERMINAL_ORIENTATION, orientation],
    [STORAGE_KEYS.TERMINAL_NAME,        name],
  ]);
}

export async function loadTerminal(): Promise<{
  terminalId:  string | null;
  orientation: string | null;
  name:        string | null;
}> {
  const results = await AsyncStorage.multiGet([
    STORAGE_KEYS.TERMINAL_ID,
    STORAGE_KEYS.TERMINAL_ORIENTATION,
    STORAGE_KEYS.TERMINAL_NAME,
  ]);
  return {
    terminalId:  results[0][1],
    orientation: results[1][1],
    name:        results[2][1],
  };
}

export async function clearTerminal(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.TERMINAL_ID,
    STORAGE_KEYS.TERMINAL_ORIENTATION,
    STORAGE_KEYS.TERMINAL_NAME,
  ]);
}

// ─── Group Indices ────────────────────────────────────────────────────────────

export async function saveGroupIndices(
  indices: Record<string, number>
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.GROUP_INDICES, JSON.stringify(indices));
}

export async function loadGroupIndices(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.GROUP_INDICES);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

// ─── Playlist Cache (offline fallback) ───────────────────────────────────────

/**
 * Persiste a playlist resolvida (PlaybackItem[]) para uso offline.
 * Keyed por terminalId para suportar múltiplos terminais no mesmo device.
 */
export async function savePlaylistCache(
  terminalId: string,
  items: PlaybackItem[]
): Promise<void> {
  try {
    const key = `${STORAGE_KEYS.PLAYLIST_CACHE}_${terminalId}`;
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.warn('[StorageService] Falha ao salvar cache de playlist:', e);
  }
}

/**
 * Carrega a última playlist salva localmente para um terminal.
 * Retorna [] se não houver cache ou se a leitura falhar.
 */
export async function loadPlaylistCache(
  terminalId: string
): Promise<PlaybackItem[]> {
  try {
    const key = `${STORAGE_KEYS.PLAYLIST_CACHE}_${terminalId}`;
    const raw = await AsyncStorage.getItem(key);
    if (raw) return JSON.parse(raw) as PlaybackItem[];
  } catch (e) {
    console.warn('[StorageService] Falha ao ler cache de playlist:', e);
  }
  return [];
}

/**
 * Remove o cache de playlist de um terminal (ex: ao desvincular).
 */
export async function clearPlaylistCache(
  terminalId: string
): Promise<void> {
  try {
    const key = `${STORAGE_KEYS.PLAYLIST_CACHE}_${terminalId}`;
    await AsyncStorage.removeItem(key);
  } catch {}
}
