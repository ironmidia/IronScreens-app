// Iron Screens — Terminal Service
import { supabase } from './supabase';

/** Marca o terminal como online E atualiza last_heartbeat */
export async function setTerminalOnline(terminalId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('terminals')
    .update({
      status: 'online',
      last_heartbeat: now,
      updated_at: now,
    })
    .eq('id', terminalId);
  if (error) throw error;
}

/** Marca o terminal como offline (sem alterar last_heartbeat) */
export async function setTerminalOffline(terminalId: string): Promise<void> {
  const { error } = await supabase
    .from('terminals')
    .update({
      status: 'offline',
      updated_at: new Date().toISOString(),
    })
    .eq('id', terminalId);
  if (error) throw error;
}
