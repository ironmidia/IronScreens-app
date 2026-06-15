import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Text,
  Platform,
  BackHandler,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
// ⚠️ NÃO importe expo-keep-awake diretamente — só suporta iOS/Android e quebra o bundle web.
// Use sempre o hook local que tem variantes .native.ts e .web.ts.
import { useKeepAwake } from "@/hooks/useKeepAwake";
import { loadTerminal, clearTerminal } from "@/services/storageService";
import { usePlayer } from "@/hooks/usePlayer";
import { useFooterBar } from "@/hooks/useFooterBar";
import { useRemoteCommands } from "@/hooks/useRemoteCommands";
import MediaRenderer from "@/components/media/MediaRenderer";
import EmptyScreen from "@/components/player/EmptyScreen";
import HiddenMenu from "@/components/player/HiddenMenu";
import ConnectionBanner from "@/components/player/ConnectionBanner";
import CrossfadeView from "@/components/player/CrossfadeView";
import FooterBar, { BAR_HEIGHT } from "@/components/player/FooterBar";
import { Colors, Typography, Spacing } from "@/constants/theme";
import {
  LONG_PRESS_DURATION_MS,
  RECONNECT_INTERVAL_MS,
} from "@/constants/config";
import { supabase } from "@/services/supabase";
import { captureRef } from "react-native-view-shot";
import { PlaybackItem } from "@/services/models";

async function applyOrientation(orientation: string) {
  if (orientation === "vertical" || orientation === "hybrid") {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT,
    );
  } else {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );
  }
}

// Tipos de mídia que controlam o próprio avanço via onVideoEnd
// (não usam timer baseado em durationSec)
// Inclui youtube e instagram pois eles disparam onVideoEnd quando o vídeo termina
const VIDEO_EVENT_TYPES = ["video", "youtube", "instagram"];

async function captureAndUpload(
  terminalId: string,
  viewRef: React.RefObject<any>,
): Promise<string | null> {
  try {
    if (!viewRef.current) return null;

    await new Promise((resolve) => setTimeout(resolve, 300));

    const base64 = await captureRef(viewRef, {
      format: "jpg",
      quality: 0.7,
      result: "base64",
    });

    if (!base64) return null;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const fileName = `${terminalId}/latest.jpg`;
    const { error } = await supabase.storage
      .from("screenshots")
      .upload(fileName, bytes, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("screenshots")
      .getPublicUrl(fileName);

    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
    console.log("[Screenshot] Upload concluído:", publicUrl);
    return publicUrl;
  } catch (e) {
    console.error("[Screenshot] Falhou:", e);
    return null;
  }
}

interface HybridSlotProps {
  item: PlaybackItem | null;
  revision: number;
  slotIndex: number;
  onVideoEnd: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
}

function HybridSlot({
  item,
  revision,
  slotIndex,
  onVideoEnd,
  onPressIn,
  onPressOut,
}: HybridSlotProps) {
  return (
    <Pressable
      style={styles.hybridSlot}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      {!item ? (
        <EmptyScreen />
      ) : (
        <CrossfadeView
          triggerKey={`slot${slotIndex}:${revision}:${item.playlistItemId}:${item.media.id}`}
        >
          <MediaRenderer
            key={`slot${slotIndex}:${revision}:${item.playlistItemId}:${item.media.id}`}
            media={item.media}
            durationSec={item.durationSec}
            onVideoEnd={onVideoEnd}
          />
        </CrossfadeView>
      )}
    </Pressable>
  );
}

export default function PlayerScreen() {
  useKeepAwake();

  const router = useRouter();
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [terminalOrientation, setTerminalOrientation] = useState("horizontal");
  const [terminalName, setTerminalName] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [ready, setReady] = useState(false);

  const rootViewRef = useRef<View | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slot1TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slot2TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [slot1Revision, setSlot1Revision] = useState(0);
  const [slot2Revision, setSlot2Revision] = useState(0);

  const footerConfig = useFooterBar();
  const footerHeight = footerConfig ? BAR_HEIGHT : 0;

  useEffect(() => {
    async function init() {
      const { terminalId: tid, orientation, name } = await loadTerminal();
      if (!tid) {
        router.replace("/setup");
        return;
      }

      setTerminalId(tid);
      const resolvedOrientation = orientation || "horizontal";
      setTerminalOrientation(resolvedOrientation);
      setTerminalName(name);
      await applyOrientation(resolvedOrientation);
      setReady(true);
    }

    init();

    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, [router]);

  const [playerState, playerActions] = usePlayer(
    terminalId || "",
    terminalOrientation,
  );

  const {
    currentItem,
    currentIndex,
    playbackRevision,
    loading,
    hasNoScheduledMedia,
    isConnected,
    hybridSlot1Item,
    hybridSlot2Item,
  } = playerState;

  // FIX: mantém o último item válido em cache para evitar tela preta
  // durante a transição entre itens (quando currentItem é null por 1 frame).
  const lastItemRef = useRef<PlaybackItem | null>(null);
  if (currentItem) lastItemRef.current = currentItem;
  const displayItem = currentItem ?? lastItemRef.current;

  const advanceRef = useRef(playerActions.advance);
  useEffect(() => { advanceRef.current = playerActions.advance; }, [playerActions.advance]);

  const advanceSlot1Ref = useRef((playerActions as any).advanceSlot1 as () => void);
  const advanceSlot2Ref = useRef((playerActions as any).advanceSlot2 as () => void);
  useEffect(() => { advanceSlot1Ref.current = (playerActions as any).advanceSlot1; }, [playerActions]);
  useEffect(() => { advanceSlot2Ref.current = (playerActions as any).advanceSlot2; }, [playerActions]);

  const captureScreenRef = useRef<(() => Promise<string | null>) | null>(null);

  useEffect(() => {
    if (!terminalId) return;
    captureScreenRef.current = () => captureAndUpload(terminalId, rootViewRef);
    console.log("[Player] captureScreenRef registrado para terminal:", terminalId);
  }, [terminalId]);

  useRemoteCommands({
    terminalId,
    onReload: playerActions.reload,
    captureScreenRef,
  });

  useEffect(() => {
    if (!terminalId) return;

    async function checkPendingOnMount() {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { data } = await supabase
        .from("terminals")
        .select("pending_command")
        .eq("id", terminalId)
        .single();

      if (data?.pending_command === "SCREENSHOT" && captureScreenRef.current) {
        console.log("[Player] Comando pendente detectado no mount:", data.pending_command);

        await supabase
          .from("terminals")
          .update({ pending_command: null, pending_command_at: null })
          .eq("id", terminalId);

        const url = await captureScreenRef.current();
        if (url) {
          await supabase
            .from("terminals")
            .update({
              last_screenshot_url: url,
              last_screenshot_at: new Date().toISOString(),
            })
            .eq("id", terminalId);
        }
      }
    }

    checkPendingOnMount();
  }, [terminalId]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (menuVisible) {
        setMenuVisible(false);
        return true;
      }
      return true;
    });

    return () => sub.remove();
  }, [menuVisible]);

  // ── Timer para modo normal (não híbrido) ──────────────────────────────────
  // Só arma timer para mídias que NÃO são do tipo video/youtube/instagram,
  // pois esses tipos disparam onVideoEnd autonomamente quando o vídeo termina.
  useEffect(() => {
    if (terminalOrientation === "hybrid") return;
    if (!currentItem) return;
    if (VIDEO_EVENT_TYPES.includes(currentItem.media.type)) return;

    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    const durationSec = Number(currentItem.durationSec) || 15;
    const CROSSFADE_BUFFER_MS = 400;
    const durationMs = durationSec * 1000 + CROSSFADE_BUFFER_MS;

    console.log(
      `[Player] Timer: ${currentItem.media.name} (${currentItem.media.type}) — ${durationSec}s`,
    );

    advanceTimerRef.current = setTimeout(() => {
      advanceRef.current();
    }, durationMs);

    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, [
    terminalOrientation,
    currentItem?.media.id,
    currentItem?.playlistItemId,
    currentItem?.durationSec,
    playbackRevision,
  ]);

  // ── Timer Slot 1 (híbrido) ────────────────────────────────────────────────
  useEffect(() => {
    if (terminalOrientation !== "hybrid") return;
    if (!hybridSlot1Item) return;
    if (VIDEO_EVENT_TYPES.includes(hybridSlot1Item.media.type)) return;

    if (slot1TimerRef.current) {
      clearTimeout(slot1TimerRef.current);
      slot1TimerRef.current = null;
    }

    const durationMs = (Number(hybridSlot1Item.durationSec) || 15) * 1000 + 400;
    slot1TimerRef.current = setTimeout(() => {
      advanceSlot1Ref.current();
      setSlot1Revision((r) => r + 1);
    }, durationMs);

    return () => {
      if (slot1TimerRef.current) {
        clearTimeout(slot1TimerRef.current);
        slot1TimerRef.current = null;
      }
    };
  }, [
    terminalOrientation,
    hybridSlot1Item?.media.id,
    hybridSlot1Item?.playlistItemId,
    hybridSlot1Item?.durationSec,
  ]);

  // ── Timer Slot 2 (híbrido) ────────────────────────────────────────────────
  useEffect(() => {
    if (terminalOrientation !== "hybrid") return;
    if (!hybridSlot2Item) return;
    if (VIDEO_EVENT_TYPES.includes(hybridSlot2Item.media.type)) return;

    if (slot2TimerRef.current) {
      clearTimeout(slot2TimerRef.current);
      slot2TimerRef.current = null;
    }

    const durationMs = (Number(hybridSlot2Item.durationSec) || 15) * 1000 + 400;
    slot2TimerRef.current = setTimeout(() => {
      advanceSlot2Ref.current();
      setSlot2Revision((r) => r + 1);
    }, durationMs);

    return () => {
      if (slot2TimerRef.current) {
        clearTimeout(slot2TimerRef.current);
        slot2TimerRef.current = null;
      }
    };
  }, [
    terminalOrientation,
    hybridSlot2Item?.media.id,
    hybridSlot2Item?.playlistItemId,
    hybridSlot2Item?.durationSec,
  ]);

  useEffect(() => {
    if (!hasNoScheduledMedia) return;
    const interval = setInterval(() => { playerActions.reload(); }, RECONNECT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasNoScheduledMedia, playerActions]);

  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(() => {
      if (terminalId) playerActions.reload();
    }, RECONNECT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isConnected, terminalId, playerActions]);

  const handlePressIn = useCallback(() => {
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

  const handleVideoEnd = useCallback(() => { advanceRef.current(); }, []);
  const handleSlot1VideoEnd = useCallback(() => {
    advanceSlot1Ref.current();
    setSlot1Revision((r) => r + 1);
  }, []);
  const handleSlot2VideoEnd = useCallback(() => {
    advanceSlot2Ref.current();
    setSlot2Revision((r) => r + 1);
  }, []);

  const handleChangeTerminal = useCallback(async () => {
    setMenuVisible(false);
    await clearTerminal();
    router.replace("/setup");
  }, [router]);

  const handleReload = useCallback(() => {
    setMenuVisible(false);
    playerActions.reload();
  }, [playerActions]);

  if (!ready || !terminalId) {
    return <View style={styles.root} />;
  }

  if (loading) {
    return (
      <View style={styles.black}>
        <ActivityIndicator size="large" color={Colors.Primary} />
        <Text style={styles.loadingText}>Carregando playlist...</Text>
      </View>
    );
  }

  if (terminalOrientation === "hybrid") {
    const screenHeight = Dimensions.get("window").height;
    const contentHeight = screenHeight - footerHeight;
    const slotHeight = Math.floor(contentHeight / 2);

    return (
      <View ref={rootViewRef} style={styles.root}>
        <ConnectionBanner visible={!isConnected} />

        <View style={[styles.hybridSlotAbsolute, { top: 0, height: slotHeight }]}>
          <HybridSlot
            item={hybridSlot1Item}
            revision={slot1Revision}
            slotIndex={1}
            onVideoEnd={handleSlot1VideoEnd}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          />
        </View>

        <View style={[styles.hybridDivider, { top: slotHeight }]} />

        <View
          style={[
            styles.hybridSlotAbsolute,
            { top: slotHeight + 2, height: slotHeight - 2 },
          ]}
        >
          <HybridSlot
            item={hybridSlot2Item}
            revision={slot2Revision}
            slotIndex={2}
            onVideoEnd={handleSlot2VideoEnd}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          />
        </View>

        {footerConfig && <FooterBar config={footerConfig} />}

        <HiddenMenu
          visible={menuVisible}
          terminalName={terminalName || "Terminal"}
          terminalId={terminalId}
          onClose={() => setMenuVisible(false)}
          onChangeTerminal={handleChangeTerminal}
          onReload={handleReload}
        />
      </View>
    );
  }

  return (
    <View ref={rootViewRef} style={styles.root}>
      <ConnectionBanner visible={!isConnected} />

      <Pressable
        style={[styles.touchZone, { bottom: footerHeight }]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* FIX: usa displayItem (currentItem ?? lastItemRef) para evitar tela preta
            durante a transição entre itens. O spinner só aparece no primeiro load,
            antes de qualquer item ter sido exibido. */}
        {hasNoScheduledMedia ? (
          <EmptyScreen />
        ) : !displayItem ? (
          <ActivityIndicator size="large" color={Colors.Primary} />
        ) : (
          <CrossfadeView
            triggerKey={`${playbackRevision}:${displayItem.playlistItemId}:${displayItem.media.id}:${currentIndex}`}
          >
            <MediaRenderer
              key={`${playbackRevision}:${displayItem.playlistItemId}:${displayItem.media.id}:${currentIndex}`}
              media={displayItem.media}
              durationSec={displayItem.durationSec}
              onVideoEnd={handleVideoEnd}
            />
          </CrossfadeView>
        )}
      </Pressable>

      {footerConfig && <FooterBar config={footerConfig} />}

      <HiddenMenu
        visible={menuVisible}
        terminalName={terminalName || "Terminal"}
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
    backgroundColor: "#000",
  },
  black: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
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
  hybridSlotAbsolute: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  hybridSlot: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  hybridDivider: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#111",
  },
});
