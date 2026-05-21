// Iron Screens — Hook para escutar e executar comandos remotos no player
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { supabase } from '@/services/supabase';
import { clearPendingCommand, saveScreenshotUrl } from '@/services/terminalService';

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
  useEffect(() => { onReloadRef.current = onReload; }, [onReload]);

  useEffect(() => {
    if (!terminalId) return;

    const channel = supabase
      .channel(`remote-cmd-${terminalId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'terminals',
        filter: `id=eq.${terminalId}`,
      }, async (payload) => {
        const newRow = payload.new as any;
        const cmd = newRow?.pending_command as string | null;
        if (!cmd) return;

        // Limpar o comando imediatamente para não re-executar
        await clearPendingCommand(terminalId);

        switch (cmd) {
          // RELOAD_PLAYLIST: recarrega a playlist sem reiniciar o app
          case 'RELOAD_PLAYLIST':
            onReloadRef.current();
            break;

          // RESTART: reinicia o app via expo-updates
          case 'RESTART':
            try {
              const update = await Updates.checkForUpdateAsync();
              if (update.isAvailable) {
                await Updates.fetchUpdateAsync();
              }
              await Updates.reloadAsync();
            } catch {
              // dev mode: expo-updates indisponível — apenas recarrega playlist
              onReloadRef.current();
            }
            break;

          // UPDATE: verifica e aplica OTA update via expo-updates
          case 'UPDATE':
            try {
              const update = await Updates.checkForUpdateAsync();
              if (update.isAvailable) {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              } else {
                Alert.alert('Atualização', 'Nenhuma atualização disponível no momento.');
              }
            } catch {
              Alert.alert('Atualização', 'Não foi possível verificar atualizações.');
            }
            break;

          // SCREENSHOT: captura a tela e faz upload para Supabase Storage
          case 'SCREENSHOT':
            if (captureScreenRef?.current) {
              try {
                const uri = await captureScreenRef.current();
                if (uri) {
                  await saveScreenshotUrl(terminalId, uri);
                }
              } catch (e) {
                console.warn('[RemoteCmd] Screenshot falhou:', e);
              }
            }
            break;

          default:
            console.warn('[RemoteCmd] Comando desconhecido:', cmd);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [terminalId]);
}
