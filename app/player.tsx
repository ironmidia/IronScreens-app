// Iron Screens — Fullscreen Player
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Text,
  Platform,
  TVEventHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import useKeepAwake from '@/hooks/useKeepAwake';
import { loadTerminal, clearTerminal } from '@/services/storageService';
import { usePlayer } from '@/hooks/usePlayer';
import { useFooterBar } from '@/hooks/useFooterBar';
import MediaRenderer from '@/components/media/MediaRenderer';
import EmptyScreen from '@/components/player/EmptyScreen';
import HiddenMenu from '@/components/player/HiddenMenu';
import ConnectionBanner from '@/components/player/ConnectionBanner';
import CrossfadeView from '@/components/player/CrossfadeView';
import FooterBar, { BAR_HEIGHT } from '@/components/player/FooterBar';
import { Colors, Typography, Spacing } from '@/constants/theme';
import { LONG_PRESS_DURATION_MS, RECONNECT_INTERVAL_MS } from '@/constants/config';

async function applyOrientation(orientation: string) {
  if (orientation === 'vertical') {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
  } else {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
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

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Contador de tempo de press para controle remoto (Android TV)
  const tvLongPressCountRef = useRef(0);
  const tvLongPressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    if (!currentItem) return;
    if (currentItem.media.type === 'video') return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    const durationMs = (currentItem.durationSec || 10) * 1000;
    advanceTimerRef.current = setTimeout(() => { playerActions.advance(); }, durationMs);
    return () => { if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current); };
  }, [currentItem?.media.id, currentItem?.durationSec]);

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

  // ─── Suporte a controle remoto Android TV / Apple TV ────────────────────────
  // Botões suportados:
  //   select / playPause — inicia contagem de long press para abrir menu
  //   back              — fecha o menu se aberto
  //   up / down / left / right — ignorados (player fullscreen não navega)
  useEffect(() => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

    const tvHandler = new TVEventHandler();

    tvHandler.enable(null, (_cmp: any, evt: any) => {
      if (!evt) return;
      const { eventType } = evt;

      if (eventType === 'select' || eventType === 'playPause' || eventType === 'longSelect') {
        if (eventType === 'longSelect') {
          // long select direto — abre menu imediatamente
          setMenuVisible(true);
          return;
        }

        // Simula long press: acumula presses curtos consecutivos (500ms cada)
        if (!tvLongPressTimerRef.current) {
          tvLongPressCountRef.current = 0;
          tvLongPressTimerRef.current = setInterval(() => {
            tvLongPressCountRef.current += 1;
            // Após 5 presses consecutivos (~2.5s mantendo OK), abre menu
            if (tvLongPressCountRef.current >= 5) {
              setMenuVisible(true);
              if (tvLongPressTimerRef.current) {
                clearInterval(tvLongPressTimerRef.current);
                tvLongPressTimerRef.current = null;
              }
            }
          }, 500);
        } else {
          // Reset do timer se houver pausa entre presses
          tvLongPressCountRef.current = 0;
        }
      } else if (eventType === 'back') {
        if (menuVisible) {
          setMenuVisible(false);
        }
      } else {
        // Qualquer outro evento cancela a contagem
        if (tvLongPressTimerRef.current) {
          clearInterval(tvLongPressTimerRef.current);
          tvLongPressTimerRef.current = null;
          tvLongPressCountRef.current = 0;
        }
      }
    });

    return () => {
      tvHandler.disable();
      if (tvLongPressTimerRef.current) {
        clearInterval(tvLongPressTimerRef.current);
        tvLongPressTimerRef.current = null;
      }
    };
  }, [menuVisible]);

  const handlePressIn = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => { setMenuVisible(true); }, LONG_PRESS_DURATION_MS);
  }, []);

  const handlePressOut = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const handleVideoEnd = useCallback(() => { playerActions.advance(); }, [playerActions.advance]);

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
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        {hasNoScheduledMedia || !currentItem ? (
          <EmptyScreen />
        ) : (
          <CrossfadeView triggerKey={currentItem.media.id + currentItem.playlistItemId}>
            <MediaRenderer media={currentItem.media} onVideoEnd={handleVideoEnd} />
          </CrossfadeView>
        )}
      </View>

      {/* Touch zone cobre a tela toda menos o footer */}
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
