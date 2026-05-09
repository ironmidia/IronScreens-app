// Iron Screens — Fullscreen Player
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Text,
  AppState,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { loadTerminal, clearTerminal } from '@/services/storageService';
import { usePlayer } from '@/hooks/usePlayer';
import MediaRenderer from '@/components/media/MediaRenderer';
import EmptyScreen from '@/components/player/EmptyScreen';
import HiddenMenu from '@/components/player/HiddenMenu';
import ConnectionBanner from '@/components/player/ConnectionBanner';
import CrossfadeView from '@/components/player/CrossfadeView';
import { Colors, Typography, Spacing } from '@/constants/theme';
import { LONG_PRESS_DURATION_MS, RECONNECT_INTERVAL_MS } from '@/constants/config';

const { width, height } = Dimensions.get('window');

export default function PlayerScreen() {
  useKeepAwake(); // Keep screen on

  const router = useRouter();
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [terminalOrientation, setTerminalOrientation] = useState<string>('horizontal');
  const [terminalName, setTerminalName] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [ready, setReady] = useState(false);

  // Long press detection
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef(0);

  // Timer for advancing non-video media
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved terminal on mount
  useEffect(() => {
    async function init() {
      const { terminalId: tid, orientation, name } = await loadTerminal();
      if (!tid) {
        router.replace('/setup');
        return;
      }
      setTerminalId(tid);
      setTerminalOrientation(orientation || 'horizontal');
      setTerminalName(name);
      setReady(true);
    }
    init();
  }, [router]);

  // Player hook — only when ready
  const [playerState, playerActions] = usePlayer(
    terminalId || '',
    terminalOrientation
  );

  const { currentItem, loading, error, hasNoScheduledMedia, isConnected } = playerState;

  // ─── Auto-advance timer for images, WebViews, and programmatic ───
  useEffect(() => {
    if (!currentItem) return;
    if (currentItem.media.type === 'video') return; // video uses onEnd callback

    // Clear any previous timer
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
    }

    const durationMs = (currentItem.durationSec || 10) * 1000;
    advanceTimerRef.current = setTimeout(() => {
      playerActions.advance();
    }, durationMs);

    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, [currentItem?.media.id, currentItem?.durationSec]);

  // Re-check schedule every minute when in "no scheduled media" state
  useEffect(() => {
    if (!hasNoScheduledMedia) return;
    const interval = setInterval(() => {
      playerActions.reload();
    }, RECONNECT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasNoScheduledMedia]);

  // Reconnect polling when offline
  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(() => {
      if (terminalId) playerActions.reload();
    }, RECONNECT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isConnected, terminalId]);

  // Long press handlers
  const handlePressIn = useCallback(() => {
    pressStartRef.current = Date.now();
    longPressTimerRef.current = setTimeout(() => {
      setMenuVisible(true);
    }, LONG_PRESS_DURATION_MS);
  }, []);

  const handlePressOut = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleVideoEnd = useCallback(() => {
    playerActions.advance();
  }, [playerActions.advance]);

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
    return (
      <View style={styles.black}>
        <ActivityIndicator color={Colors.Primary} size="large" />
      </View>
    );
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
      {/* Long press touch zone */}
      <Pressable
        style={styles.touchZone}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={LONG_PRESS_DURATION_MS}
      >
        {/* Player content */}
        {hasNoScheduledMedia || !currentItem ? (
          <EmptyScreen />
        ) : (
          <CrossfadeView triggerKey={currentItem.media.id + currentItem.playlistItemId}>
            <MediaRenderer
              media={currentItem.media}
              onVideoEnd={handleVideoEnd}
            />
          </CrossfadeView>
        )}
      </Pressable>

      {/* Connection Banner */}
      <ConnectionBanner visible={!isConnected} />

      {/* Hidden Menu */}
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
  },
  black: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  touchZone: {
    flex: 1,
    width,
    height,
  },
  loadingText: {
    color: Colors.TextMuted,
    fontSize: Typography.sizes.sm,
    marginTop: Spacing.sm,
  },
});
