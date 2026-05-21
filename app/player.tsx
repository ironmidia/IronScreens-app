// Iron Screens — Fullscreen Player
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Text,
  Platform,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import useKeepAwake from '@/hooks/useKeepAwake';
import { loadTerminal, clearTerminal } from '@/services/storageService';
import { usePlayer } from '@/hooks/usePlayer';
import { useFooterBar } from '@/hooks/useFooterBar';
import { useRemoteCommands } from '@/hooks/useRemoteCommands';
import MediaRenderer from '@/components/media/MediaRenderer';
import EmptyScreen from '@/components/player/EmptyScreen';
import HiddenMenu from '@/components/player/HiddenMenu';
import ConnectionBanner from '@/components/player/ConnectionBanner';
import CrossfadeView from '@/components/player/CrossfadeView';
import FooterBar, { BAR_HEIGHT } from '@/components/player/FooterBar';
import { Colors, Typography, Spacing } from '@/constants/theme';
import { LONG_PRESS_DURATION_MS, RECONNECT_INTERVAL_MS } from '@/constants/config';
import { supabase } from '@/services/supabase';

async function applyOrientation(orientation: string) {
  if (orientation === 'vertical') {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
  } else {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  }
}

// Tipos que avançam pelo evento onVideoEnd — não usam timer externo
const VIDEO_EVENT_TYPES = ['video'];

/**
 * Captura screenshot da view raiz e faz upload para o Supabase Storage.
 * Requer react-native-view-shot instalado e linkado nativamente.
 */
async function captureAndUpload(
  terminalId: string,
  viewRef: React.RefObject<any>
): Promise<string | null> {
  try {
    console.log('[Screenshot] Iniciando captura para terminal:', terminalId);

    // Verifica se a ref está disponível
    if (!viewRef.current) {
      console.warn('[Screenshot] viewRef.current é null — view ainda não montada');
      return null;
    }

    // Import dinâmico da lib
    let captureRef: any;
    try {
      const mod = await import('react-native-view-shot');
      captureRef = mod.captureRef;
    } catch (importErr) {
      console.error('[Screenshot] react-native-view-shot não disponível:', importErr);
      return null;
    }

    // Aguarda 1 frame extra para garantir que o compositor nativo renderizou a view
    await new Promise<void>(resolve => setTimeout(resolve, 300));

    console.log('[Screenshot] Capturando view...');
    const uri = await captureRef(viewRef, { format: 'jpg', quality: 0.7 });
    console.log('[Screenshot] URI capturada:', uri);

    // Lê o arquivo como blob
    const response = await fetch(uri);
    if (!response.ok) {
      console.error('[Screenshot] Falha ao ler URI capturada, status:', response.status);
      return null;
    }
    const blob = await response.blob();
    console.log('[Screenshot] Blob gerado, tamanho:', blob.size, 'bytes');

    const fileName = `${terminalId}/latest.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

    if (uploadError) {
      console.error('[Screenshot] Erro no upload Supabase Storage:', uploadError.message);
      throw uploadError;
    }

    const { data } = supabase.storage.from('screenshots').getPublicUrl(fileName);
    // Cache-bust para forçar reload da imagem no painel
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
    console.log('[Screenshot] Upload concluído. URL pública:', publicUrl);
    return publicUrl;
  } catch (e) {
    console.error('[Screenshot] Falhou com erro:', e);
    return null;
  }
}

export default function PlayerScreen() {
  useKeepAwake();

  const router = useRouter();
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [terminalOrientation, setTerminalOrientation] = useState<string>('horizontal');
  const [terminalName, setTerminalName] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [ready, setReady] = useState(false);

  // Ref para a View raiz (usada pelo screenshot)
  const rootViewRef = useRef<View>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const footerConfig = useFooterBar();
  const footerHeight = footerConfig ? BAR_HEIGHT : 0;

  useEffect(() => {
    async function init() {
      const { terminalId: tid, orientation, name } = await loadTerminal();
      if (!tid) { router.replace('/setup'); return; }
      setTerminalId(tid);
      const resolvedOrientation = orientation || 'horizontal';
      setTerminalOrientation(resolvedOrientation);
      setTerminalName(name);
      await applyOrientation(resolvedOrientation);
      setReady(true);
    }
    init();
    return () => { ScreenOrientation.unlockAsync(); };
  }, [router]);

  const [playerState, playerActions] = usePlayer(terminalId || '', terminalOrientation);
  const { currentItem, loading, hasNoScheduledMedia, isConnected } = playerState;

  const advanceRef = useRef(playerActions.advance);
  useEffect(() => { advanceRef.current = playerActions.advance; }, [playerActions.advance]);

  // Função de captura de tela — passada para o hook de comandos remotos
  const captureScreenRef = useRef<(() => Promise<string | null>) | null>(null);
  useEffect(() => {
    if (!terminalId) return;
    captureScreenRef.current = () => captureAndUpload(terminalId, rootViewRef);
    console.log('[Player] captureScreenRef registrado para terminal:', terminalId);
  }, [terminalId]);

  // Listener de comandos remotos via Realtime
  useRemoteCommands({
    terminalId,
    onReload: playerActions.reload,
    captureScreenRef,
  });

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menuVisible) { setMenuVisible(false); return true; }
      return true;
    });
    return () => sub.remove();
  }, [menuVisible]);

  // Timer de avanço — apenas para tipos que NÃO são vídeo nativo
  useEffect(() => {
    if (!currentItem) return;
    if (VIDEO_EVENT_TYPES.includes(currentItem.media.type)) return;

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);

    const durationSec = Number(currentItem.durationSec) || 15;
    const durationMs = durationSec * 1000;

    console.log(`[Player] Timer: ${currentItem.media.name} (${currentItem.media.type}) — ${durationSec}s`);

    advanceTimerRef.current = setTimeout(() => {
      advanceRef.current();
    }, durationMs);

    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, [currentItem?.media.id, currentItem?.playlistItemId, currentItem?.durationSec]);

  useEffect(() => {
    if (!hasNoScheduledMedia) return;
    const interval = setInterval(() => { playerActions.reload(); }, RECONNECT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasNoScheduledMedia]);

  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(() => { if (terminalId) playerActions.reload(); }, RECONNECT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isConnected, terminalId]);

  const handlePressIn = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => { setMenuVisible(true); }, LONG_PRESS_DURATION_MS);
  }, []);

  const handlePressOut = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const handleVideoEnd = useCallback(() => { advanceRef.current(); }, []);

  const handleChangeTerminal = useCallback(async () => {
    setMenuVisible(false);
    await clearTerminal();
    router.replace('/setup');
  }, [router]);

  const handleReload = useCallback(() => {
    setMenuVisible(false);
    playerActions.reload();
  }, [playerActions.reload]);

  if (!ready || !terminalId) {
    return <View style={styles.black}><ActivityIndicator color={Colors.Primary} size="large" /></View>;
  }

  if (loading) {
    return (
      <View style={styles.black}>
        <ActivityIndicator color={Colors.Primary} size="large" />
        <Text style={styles.loadingText}>Carregando playlist...</Text>
      </View>
    );
  }

  return (
    <View ref={rootViewRef} style={styles.root} collapsable={false}>
      <View style={StyleSheet.absoluteFill}>
        {hasNoScheduledMedia || !currentItem ? (
          <EmptyScreen />
        ) : (
          <CrossfadeView triggerKey={currentItem.media.id + currentItem.playlistItemId}>
            <MediaRenderer
              media={currentItem.media}
              durationSec={Number(currentItem.durationSec) || 15}
              onVideoEnd={handleVideoEnd}
            />
          </CrossfadeView>
        )}
      </View>

      <Pressable
        style={[styles.touchZone, { bottom: footerHeight }]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={LONG_PRESS_DURATION_MS}
      />

      {footerConfig && <FooterBar config={footerConfig} />}

      <ConnectionBanner visible={!isConnected} />

      <HiddenMenu
        visible={menuVisible}
        terminalName={terminalName}
        terminalId={terminalId}
        onClose={() => setMenuVisible(false)}
        onChangeTerminal={handleChangeTerminal}
        onReload={handleReload}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  black: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  touchZone: {
    ...StyleSheet.absoluteFillObject,
    bottom: 0,
  },
  loadingText: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
  },
});
