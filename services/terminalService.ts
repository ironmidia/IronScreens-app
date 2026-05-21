// Iron Screens — Terminal Service
import { supabase } from './supabase';
import { Terminal } from './models';

/** Tipos de comando remoto — sincronizados com o painel web */
export type RemoteCommand = 'RELOAD_PLAYLIST' | 'RESTART' | 'SCREENSHOT' | 'UPDATE';

/** Busca todos os terminais cadastrados */
export async function fetchTerminals(): Promise<Terminal[]> {
  const { data, error } = await supabase
    .from('terminals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Terminal[];
}

/** Busca um terminal pelo ID */
export async function fetchTerminalById(terminalId: string): Promise<Terminal | null> {
  const { data, error } = await supabase
    .from('terminals')
    .select('*')
    .eq('id', terminalId)
    .single();
  if (error) return null;
  return data as Terminal;
}

/** Marca o terminal como online e atualiza last_heartbeat */
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

/** Marca o terminal como offline */
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

/** Atualiza dados gerais do terminal (nome, tipo, orientação, cliente, localização) */
export async function updateTerminal(
  terminalId: string,
  fields: Partial<Pick<Terminal, 'name' | 'type' | 'orientation' | 'client' | 'location'>>
): Promise<void> {
  const { error } = await supabase
    .from('terminals')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', terminalId);
  if (error) throw error;
}

/** Envia um comando remoto para o terminal */
export async function sendRemoteCommand(
  terminalId: string,
  command: RemoteCommand,
  payload?: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from('terminals')
    .update({
      pending_command: command,
      command_payload: payload ?? null,
      command_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', terminalId);
  if (error) throw error;
}

/** Limpa o comando após execução (chamado pelo player após processar) */
export async function clearPendingCommand(terminalId: string): Promise<void> {
  const { error } = await supabase
    .from('terminals')
    .update({
      pending_command: null,
      command_payload: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', terminalId);
  if (error) throw error;
}

/** Salva a URL do último screenshot no banco */
export async function saveScreenshotUrl(
  terminalId: string,
  url: string
): Promise<void> {
  const { error } = await supabase
    .from('terminals')
    .update({
      last_screenshot_url: url,
      last_screenshot_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', terminalId);
  if (error) throw error;
}
