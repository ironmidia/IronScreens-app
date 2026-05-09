// Iron Screens — Terminal Service
import { supabase } from './supabase';
import { Terminal } from './models';

export async function fetchTerminals(): Promise<Terminal[]> {
  const { data, error } = await supabase
    .from('terminals')
    .select('id, name, type, orientation, status, client, location, device_id, created_at, updated_at')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data as Terminal[]) || [];
}

export async function setTerminalOnline(terminalId: string): Promise<void> {
  const { error } = await supabase
    .from('terminals')
    .update({ status: 'online', updated_at: new Date().toISOString() })
    .eq('id', terminalId);

  if (error) throw error;
}

export async function setTerminalOffline(terminalId: string): Promise<void> {
  const { error } = await supabase
    .from('terminals')
    .update({ status: 'offline', updated_at: new Date().toISOString() })
    .eq('id', terminalId);

  if (error) throw error;
}

export async function fetchTerminalById(terminalId: string): Promise<Terminal | null> {
  const { data, error } = await supabase
    .from('terminals')
    .select('*')
    .eq('id', terminalId)
    .single();

  if (error) return null;
  return data as Terminal;
}
