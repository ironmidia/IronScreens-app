// Iron Screens — Fullscreen Player
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Text,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
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

const { width, height } = Dimensions.get('window');

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

  // Footer bar config (null = desativado)
  const footerConfig = useFooterBar();
  const footerHeight = footerConfig ? BAR_HEIGHT : 0;

  // Load saved terminal on mount
  useEffect(() => {
    async function init() {
      const { terminalId: tid, orientation, name } = await loadTerminal();
      if (!tid) { router.replace('/setup'); return; }
      setTerminalId(tid);
      setTerminalOrientation(orientation || 'horizontal');
      setTerminalName(name);
      setReady(true);
    }
    init();
  }, [router]);

  const [playerState, playerActions] = usePlayer(terminalId || '', terminalOrientation);
  const { currentItem, loading, hasNoScheduledMedia, isConnected } = playerState;

  // Auto-advance timer para não-vídeos
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
      {/*
        TouchZone ocupa a tela MENOS a altura da faixa de rodapé.
        Isso garante que o press longo não seja acidentalmente
        ativado ao tocar na faixa.
      */}
      <Pressable
        style={[styles.touchZone, { height: height - footerHeight }]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={LONG_PRESS_DURATION_MS}
      >
        {hasNoScheduledMedia || !currentItem ? (
          <EmptyScreen />
        ) : (
          <CrossfadeView triggerKey={currentItem.media.id + currentItem.playlistItemId}>
            <MediaRenderer media={currentItem.media} onVideoEnd={handleVideoEnd} />
          </CrossfadeView>
        )}
      </Pressable>

      {/* Nota de Rodapé — renderizada apenas se habilitada no painel */}
      {footerConfig && <FooterBar config={footerConfig} />}

      {/* Connection Banner (flutuante, acima de tudo) */}
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
    width,
    height,
    backgroundColor: '#000',
    flexDirection: 'column',
    justifyContent: 'flex-end', // faixa fica na base
  },
  black: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  touchZone: {
    width,
    flex: 1, // ocupa o espaço acima da faixa
  },
  loadingText: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
  },
});
