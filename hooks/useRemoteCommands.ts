// Iron Screens — Hook para escutar e executar comandos remotos no player
import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { supabase } from "@/services/supabase";
import { clearPendingCommand, saveScreenshotUrl } from "@/services/terminalService";

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

  useEffect(() => {
    onReloadRef.current = onReload;
  }, [onReload]);

  useEffect(() => {
    // Aguarda terminalId ser resolvido — evita inscrição prematura com null
    if (!terminalId || terminalId.trim() === "") {
      console.log("[RemoteCmd] terminalId ainda não disponível, aguardando...");
      return;
    }

    console.log("[RemoteCmd] Inscrevendo canal para terminal:", terminalId);

    // Remove qualquer canal anterior com o mesmo nome antes de criar um novo
    const channelName = `remote-cmd-${terminalId}`;
    supabase.removeAllChannels();

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "terminals",
          filter: `id=eq.${terminalId}`,
        },
        async (payload) => {
          const newRow = payload.new as any;
          const cmd = newRow?.pending_command as string | null;

          if (!cmd) return;

          console.log("[RemoteCmd] Comando recebido:", cmd);

          try {
            await clearPendingCommand(terminalId);
          } catch (e) {
            console.error("[RemoteCmd] Erro ao limpar comando pendente:", e);
          }

          switch (cmd) {
            case "RELOAD_PLAYLIST":
              onReloadRef.current();
              break;

            case "RESTART":
              if (Platform.OS !== 'web') {
                try {
                  const Updates = await import('expo-updates');
                  const update = await Updates.checkForUpdateAsync();
                  if (update.isAvailable) {
                    await Updates.fetchUpdateAsync();
                  }
                  await Updates.reloadAsync();
                } catch {
                  onReloadRef.current();
                }
              } else {
                onReloadRef.current();
              }
              break;

            case "UPDATE":
              if (Platform.OS !== 'web') {
                try {
                  const Updates = await import('expo-updates');
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
        },
      )
      .subscribe((status) => {
        console.log("[RemoteCmd] Status do canal:", status);
      });

    return () => {
      console.log("[RemoteCmd] Removendo canal para terminal:", terminalId);
      supabase.removeChannel(channel);
    };
  }, [terminalId]);

  return null;
}
