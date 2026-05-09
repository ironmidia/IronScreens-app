// Iron Screens — Supabase Configuration
export const SUPABASE_URL = 'https://qfqolsrnneerccagrunm.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmcW9sc3JubmVlcmNjYWdydW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMjUwOTEsImV4cCI6MjA5MzcwMTA5MX0.n-Z8j6KmnG-DmKVe_Qu2A256GtPPNk_bK8DWDVuItmA';

export const APP_VERSION = '1.0.0';
export const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds
export const RECONNECT_INTERVAL_MS = 10_000; // 10 seconds
export const LONG_PRESS_DURATION_MS = 5_000;  // 5 seconds
export const CROSSFADE_DURATION_MS = 300;

export const STORAGE_KEYS = {
  TERMINAL_ID: 'iron_screens_terminal_id',
  TERMINAL_ORIENTATION: 'iron_screens_terminal_orientation',
  TERMINAL_NAME: 'iron_screens_terminal_name',
  GROUP_INDICES: 'iron_screens_group_indices',
};
