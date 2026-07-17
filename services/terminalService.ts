// Iron Screens — Terminal Service
import { supabase } from "./supabase";
import { Terminal } from "./models";

/** Tipos de comando remoto — sincronizados com o painel web */
export type RemoteCommand =
  | "RELOAD_PLAYLIST"
  | "RESTART"
  | "SCREENSHOT"
  | "UPDATE";

/** Busca todos os terminais cadastrados */
export async function fetchTerminals(): Promise<Terminal[]> {
  const { data, error } = await supabase
    .from("terminals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Terminal[];
}

/** Busca um terminal pelo ID */
export async function fetchTerminalById(
  terminalId: string,
): Promise<Terminal | null> {
  const { data, error } = await supabase
    .from("terminals")
    .select("*")
    .eq("id", terminalId)
    .single();

  if (error) return null;
  return data as Terminal;
}

/** Marca o terminal como online e atualiza last_heartbeat */
export async function setTerminalOnline(terminalId: string): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("terminals")
    .update({
      status: "online",
      last_heartbeat: now,
      updated_at: now,
    })
    .eq("id", terminalId);

  if (error) throw error;
}

/**
 * Reivindica o terminal para este dispositivo (grava device_id). Chamado só
 * na configuração (setup), nunca no heartbeat — senão dois aparelhos
 * alternando heartbeat mascarariam o conflito de posse um do outro.
 */
export async function claimTerminal(
  terminalId: string,
  deviceId: string,
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("terminals")
    .update({
      device_id: deviceId,
      status: "online",
      last_heartbeat: now,
      updated_at: now,
    })
    .eq("id", terminalId);

  if (error) throw error;
}

/**
 * Retorna o device_id atualmente dono do terminal (null = nunca reivindicado
 * por essa versão do app, ou terminal inexistente).
 */
export async function fetchTerminalOwnerDeviceId(
  terminalId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("terminals")
    .select("device_id")
    .eq("id", terminalId)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { device_id: string | null }).device_id ?? null;
}

/** Marca o terminal como offline */
export async function setTerminalOffline(terminalId: string): Promise<void> {
  const { error } = await supabase
    .from("terminals")
    .update({
      status: "offline",
      updated_at: new Date().toISOString(),
    })
    .eq("id", terminalId);

  if (error) throw error;
}

/** Atualiza dados gerais do terminal (nome, tipo, orientação, cliente, localização) */
export async function updateTerminal(
  terminalId: string,
  fields: Partial<
    Pick<Terminal, "name" | "type" | "orientation" | "client" | "location">
  >,
): Promise<void> {
  const { error } = await supabase
    .from("terminals")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", terminalId);

  if (error) throw error;
}

/** Envia um comando remoto para o terminal */
export async function sendRemoteCommand(
  terminalId: string,
  command: RemoteCommand,
  payload?: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("terminals")
    .update({
      pending_command: command,
      pending_command_payload: payload ?? null,
      pending_command_at: now,
      updated_at: now,
    })
    .eq("id", terminalId);

  if (error) throw error;
}

/** Limpa o comando após execução (chamado pelo player após processar) */
export async function clearPendingCommand(terminalId: string): Promise<void> {
  const { error } = await supabase
    .from("terminals")
    .update({
      pending_command: null,
      pending_command_payload: null,
      pending_command_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", terminalId);

  if (error) {
    console.error(
      "[terminalService] Erro ao limpar pending_command:",
      error.message,
    );
    throw error;
  }
}

/**
 * Salva a screenshot:
 * 1) adiciona no histórico em terminal_screenshots
 * 2) atualiza o último screenshot em terminals
 */
export async function saveScreenshotUrl(
  terminalId: string,
  url: string,
): Promise<void> {
  const now = new Date().toISOString();

  const { error: historyError } = await supabase
    .from("terminal_screenshots")
    .insert(
      {
        terminal_id: terminalId,
        image_url: url,
        created_at: now,
      },
    );

  if (historyError) {
    console.error(
      "[terminalService] Erro ao salvar screenshot no histórico:",
      historyError.message,
    );
    throw historyError;
  }

  const { error } = await supabase
    .from("terminals")
    .update({
      last_screenshot_url: url,
      last_screenshot_at: now,
      updated_at: now,
    })
    .eq("id", terminalId);

  if (error) {
    console.error(
      "[terminalService] Erro ao atualizar último screenshot:",
      error.message,
    );
    throw error;
  }
}
