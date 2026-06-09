// Iron Screens - Configuration

export const APP_VERSION = '1.0.0';

export const HEARTBEAT_INTERVAL_MS      = 60_000;  // 60 segundos
export const RECONNECT_INTERVAL_MS      = 10_000;  // 10 segundos
export const PLAYLIST_POLL_INTERVAL_MS  = 60 * 60 * 1000;  // 30 minutos
export const LONG_PRESS_DURATION_MS     = 5_000;   // 5 segundos
export const CROSSFADE_DURATION_MS      = 300;

export const STORAGE_KEYS = {
  TERMINAL_ID: 'iron_screens_terminal_id',
  TERMINAL_ORIENTATION: 'iron_screens_terminal_orientation',
  TERMINAL_NAME: 'iron_screens_terminal_name',
  GROUP_INDICES: 'iron_screens_group_indices',
  PLAYLIST_CACHE: (terminalId: string) => `iron_screens_playlist_cache_${terminalId}`,
};
