// Iron Screens — Display Event Service
import { supabase } from './supabase';
import { DisplayEvent } from './models';

export async function logDisplayEvent(event: Omit<DisplayEvent, 'id'>): Promise<void> {
  try {
    const { error } = await supabase
      .from('display_events')
      .insert({
        media_id: event.media_id,
        terminal_id: event.terminal_id,
        displayed_at: event.displayed_at,
        duration_sec: event.duration_sec,
      });

    if (error) {
      console.warn('[DisplayEvent] Failed to log event:', error.message);
    }
  } catch (err) {
    console.warn('[DisplayEvent] Exception logging event:', err);
  }
}
