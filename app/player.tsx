// Iron Screens — Fullscreen Player
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Text,
  Platform,
  BackHandler,
} from "react-native";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useKeepAwake } from "expo-keep-awake";
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
import * as FileSystem from "expo-file-system/legacy";

async function applyOrientation(orientation: string) {
  if (orientation === "vertical") {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT,
    );
  } else {
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );
  }
}

// Tipos que avançam pelo evento onVideoEnd — não usam timer externo
const VIDEO_EVENT_TYPES = ["video"];

/**
 * Captura screenshot da view raiz e faz upload para o Supabase Storage.
 * Requer react-native-view-shot instalado e linkado nativamente.
 */
async function captureAndUpload(
  terminalId: string,
  viewRef: React.RefObject<any>,
): Promise<string | null> {
  try {
    if (!viewRef.current) return null;

    await new Promise<void>((resolve) => setTimeout(resolve, 300));

    const uri = await captureRef(viewRef, { format: "jpg", quality: 0.7 });
    console.log("[Screenshot] URI capturada:", uri);

    // ✅ Lê como base64 — único método confiável no Android com Expo 54
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // ✅ Converte base64 → Uint8Array sem biblioteca externa
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

export default function PlayerScreen() {
  useKeepAwake();

  const router = useRouter();
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [terminalOrientation, setTerminalOrientation] =
    useState<string>("horizontal");
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
  const { currentItem, loading, hasNoScheduledMedia, isConnected } =
    playerState;

  const advanceRef = useRef(playerActions.advance);
  useEffect(() => {
    advanceRef.current = playerActions.advance;
  }, [playerActions.advance]);

  // Função de captura de tela — passada para o hook de comandos remotos
  const captureScreenRef = useRef<(() => Promise<string | null>) | null>(null);
  useEffect(() => {
    if (!terminalId) return;
    captureScreenRef.current = () => captureAndUpload(terminalId, rootViewRef);
    console.log(
      "[Player] captureScreenRef registrado para terminal:",
      terminalId,
    );
  }, [terminalId]);

  // ✅ DEPOIS: sobe o canal (já vai encontrar captureScreenRef preenchido)
  useRemoteCommands({
    terminalId,
    onReload: playerActions.reload,
    captureScreenRef,
  });

  // PlayerScreen.tsx — adicionar este useEffect após o useRemoteCommands
  useEffect(() => {
    if (!terminalId) return;

    async function checkPendingOnMount() {
      // Aguarda o captureScreenRef estar registrado
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { data } = await supabase
        .from("terminals")
        .select("pending_command")
        .eq("id", terminalId)
        .single();

      if (data?.pending_command === "SCREENSHOT" && captureScreenRef.current) {
        console.log(
          "[Player] Comando pendente detectado no mount:",
          data.pending_command,
        );
        // Limpa e executa
        await supabase
          .from("terminals")
          .update({ pending_command: null, pending_command_at: null })
          .eq("id", terminalId!);

        const url = await captureScreenRef.current();
        if (url) {
          await supabase
            .from("terminals")
            .update({
              last_screenshot_url: url,
              last_screenshot_at: new Date().toISOString(),
            })
            .eq("id", terminalId!);
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

  // Timer de avanço — apenas para tipos que NÃO são vídeo nativo
  // Timer de avanço — apenas para tipos que NÃO são vídeo nativo
  useEffect(() => {
    if (!currentItem) return;
    if (VIDEO_EVENT_TYPES.includes(currentItem.media.type)) return;

    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    const durationSec = Number(currentItem.durationSec) || 15;

    // Compensa o tempo percebido perdido na transição visual
    const CROSSFADE_BUFFER_MS = 400;
    const durationMs = durationSec * 1000 + CROSSFADE_BUFFER_MS;

    console.log(
      `[Player] Timer: ${currentItem.media.name} (${currentItem.media.type}) — ${durationSec}s (+${CROSSFADE_BUFFER_MS}ms de buffer)`,
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
    currentItem?.media.id,
    currentItem?.playlistItemId,
    currentItem?.durationSec,
  ]);

  useEffect(() => {
    if (!hasNoScheduledMedia) return;
    const interval = setInterval(() => {
      playerActions.reload();
    }, RECONNECT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasNoScheduledMedia]);

  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(() => {
      if (terminalId) playerActions.reload();
    }, RECONNECT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isConnected, terminalId]);

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

  const handleVideoEnd = useCallback(() => {
    advanceRef.current();
  }, []);

  const handleChangeTerminal = useCallback(async () => {
    setMenuVisible(false);
    await clearTerminal();
    router.replace("/setup");
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
    <View ref={rootViewRef} style={styles.root} collapsable={false}>
      <View style={StyleSheet.absoluteFill}>
        {hasNoScheduledMedia || !currentItem ? (
          <EmptyScreen />
        ) : (
          <CrossfadeView
            triggerKey={currentItem.media.id + currentItem.playlistItemId}
          >
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
});
