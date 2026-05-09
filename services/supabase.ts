// Iron Screens — Supabase Client
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
