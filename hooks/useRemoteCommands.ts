// Iron Screens — Hook para escutar e executar comandos remotos no player
import { useEffect, useRef } from "react";
import { Alert, AppState, Platform } from "react-native";
import { supabase } from "@/services/supabase";
import { clearPendingCommand, saveScreenshotUrl } from "@/services/terminalService";
import { getDeviceId } from "@/services/deviceService";

// ─── Fallback de confiabilidade: o Android às vezes mata/suspende o socket de
// Realtime em segundo plano, fazendo o app perder o evento do comando. Sem
// isso, o comando só some depois que o admin limpa automaticamente (5min) sem
// nunca ter sido executado. O polling + a checagem ao voltar de background
// garantem que o comando seja pego mesmo se o Realtime tiver perdido o evento.
// O caminho rápido (Realtime, já filtrado por terminal) cobre o caso comum;
// esse polling é só uma rede de segurança, por isso não precisa ser tão
// frequente — reduz o consumo de SELECTs rodando 24/7 em cada terminal.
const COMMAND_POLL_INTERVAL_MS = 120_000;

type UseRemoteCommandsOptions = {
  terminalId: string | null;
  onReload: () => void;
  /** Ref para a função que captura screenshot. Passada pelo player via captureRef */
  captureScreenRef?: React.RefObject<(() => Promise<string | null>) | null>;
};

export function useRemoteCommands({
  terminalId,
  onReload,
  captureScreenRef,
}: UseRemoteCommandsOptions) {
  const onReloadRef = useRef(onReload);
  const processingRef = useRef(false);

  useEffect(() => {
    onReloadRef.current = onReload;
  }, [onReload]);

  useEffect(() => {
    if (!terminalId || terminalId.trim() === "") {
      console.log("[RemoteCmd] terminalId ainda não disponível, aguardando...");
      return;
    }

    let localDeviceId: string | null = null;
    getDeviceId().then((id) => {
      localDeviceId = id;
    });

    const runCommand = async (cmd: string) => {
      console.log("[RemoteCmd] Executando comando:", cmd);

      switch (cmd) {
        case "RELOAD_PLAYLIST":
          console.log("[RemoteCmd] Executando RELOAD_PLAYLIST...");
          onReloadRef.current();
          break;

        case "RESTART":
          if (Platform.OS !== "web") {
            try {
              const Updates = await import("expo-updates");
              const update = await Updates.checkForUpdateAsync();
              if (update.isAvailable) await Updates.fetchUpdateAsync();
              await Updates.reloadAsync();
            } catch {
              onReloadRef.current();
            }
          } else {
            onReloadRef.current();
          }
          break;

        case "UPDATE":
          if (Platform.OS !== "web") {
            try {
              const Updates = await import("expo-updates");
              const update = await Updates.checkForUpdateAsync();
              if (update.isAvailable) {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              } else {
                Alert.alert("Atualização", "Nenhuma atualização disponível no momento.");
              }
            } catch {
              Alert.alert("Atualização", "Não foi possível verificar atualizações.");
            }
          } else {
            Alert.alert("Atualização", "Atualizações não suportadas nesta plataforma.");
          }
          break;

        case "SCREENSHOT":
          if (!captureScreenRef?.current) {
            console.warn(
              "[RemoteCmd] captureScreenRef não disponível — player ainda não montado?",
            );
            break;
          }
          try {
            console.log("[RemoteCmd] Executando captura de screenshot...");
            const uri = await captureScreenRef.current();
            if (uri) {
              await saveScreenshotUrl(terminalId, uri);
              console.log("[RemoteCmd] Screenshot salvo com sucesso:", uri);
            } else {
              console.error("[RemoteCmd] captureScreenRef retornou null — captura falhou");
              await supabase
                .from("terminals")
                .update({
                  last_screenshot_at: new Date().toISOString(),
                  last_screenshot_url: null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", terminalId);
            }
          } catch (e) {
            console.error("[RemoteCmd] Screenshot falhou com exceção:", e);
          }
          break;

        default:
          console.warn("[RemoteCmd] Comando desconhecido:", cmd);
      }
    };

    const handleIncomingCommand = async (
      cmd: string | null,
      rowDeviceId: string | null,
    ) => {
      if (!cmd) return;

      // ─── Dois aparelhos podem ter sido configurados com o mesmo terminal
      // (mesmo PIN). Ambos escutam a mesma linha, então sem essa checagem os
      // dois executam o comando ao mesmo tempo — inclusive o aparelho que já
      // estava tocando normalmente, travando sua reprodução. Só o dono atual
      // (device_id gravado no último claim) processa o comando.
      if (rowDeviceId && localDeviceId && rowDeviceId !== localDeviceId) {
        console.log(
          "[RemoteCmd] Ignorando comando — este aparelho não é mais o dono do terminal",
        );
        return;
      }

      console.log("[RemoteCmd] Comando recebido:", cmd);

      try {
        await clearPendingCommand(terminalId);
      } catch (e) {
        console.error("[RemoteCmd] Erro ao limpar comando pendente:", e);
      }

      await runCommand(cmd);
    };

    // ─── Caminho rápido: Realtime (instantâneo quando o socket está vivo) ────
    const channel = supabase
      .channel(`remote-cmd-${terminalId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "terminals",
          filter: `id=eq.${terminalId}`,
        },
        (payload) => {
          const newRow = payload.new as any;
          void handleIncomingCommand(
            newRow?.pending_command ?? null,
            newRow?.device_id ?? null,
          );
        },
      )
      .subscribe((status) => {
        console.log("[RemoteCmd] Status do canal:", status);
      });

    // ─── Rede de segurança: busca ativa do comando pendente. Cobre os casos em
    // que o Realtime perdeu o evento (app em background, socket derrubado etc).
    const checkNow = async () => {
      if (processingRef.current) return;
      processingRef.current = true;
      try {
        const { data } = await supabase
          .from("terminals")
          .select("pending_command, device_id")
          .eq("id", terminalId)
          .maybeSingle();
        await handleIncomingCommand(
          data?.pending_command ?? null,
          (data as any)?.device_id ?? null,
        );
      } catch (e) {
        console.error("[RemoteCmd] Erro ao checar comando pendente:", e);
      } finally {
        processingRef.current = false;
      }
    };

    // Checagem inicial (pequeno atraso para o captureScreenRef já estar registrado).
    const initialCheckTimer = setTimeout(checkNow, 500);

    const pollInterval = setInterval(checkNow, COMMAND_POLL_INTERVAL_MS);

    // Ao voltar do background, o socket de Realtime pode estar morto — recheca
    // na hora em vez de esperar o próximo tick do polling.
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkNow();
    });

    return () => {
      console.log("[RemoteCmd] Removendo canal para terminal:", terminalId);
      clearTimeout(initialCheckTimer);
      clearInterval(pollInterval);
      appStateSub.remove();
      supabase.removeChannel(channel);
    };
  }, [terminalId]);

  return null;
}
