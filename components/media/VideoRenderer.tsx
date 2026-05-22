import React, { memo, useRef, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

interface VideoRendererProps {
  uri: string;
  durationSec?: number;
  onEnd?: () => void;
}

function VideoRenderer({ uri, onEnd }: VideoRendererProps) {
  const onEndRef = useRef(onEnd);
  const endCalledRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    endCalledRef.current = false;
    console.log("[VideoRenderer] Montando vídeo:", uri);

    const triggerEnd = () => {
      if (!endCalledRef.current) {
        endCalledRef.current = true;

        if (watchdogRef.current) {
          clearTimeout(watchdogRef.current);
          watchdogRef.current = null;
        }

        console.log("[VideoRenderer] Avançando");
        onEndRef.current?.();
      }
    };

    watchdogRef.current = setTimeout(() => {
      console.warn("[VideoRenderer] Watchdog disparou, avançando por segurança");
      triggerEnd();
    }, 120000);

    let subEnd: { remove: () => void } | null = null;
    let subStatus: { remove: () => void } | null = null;

    try {
      subEnd = player.addListener("playToEnd", () => {
        console.log("[VideoRenderer] playToEnd");
        triggerEnd();
      });
    } catch {}

    try {
      let started = false;

      subStatus = player.addListener("statusChange", ({ status }: any) => {
        if (status === "readyToPlay") started = true;

        if (status === "idle" && started) {
          console.log("[VideoRenderer] statusChange -> idle após iniciar");
          triggerEnd();
        }

        if (status === "error") {
          console.error("[VideoRenderer] Erro:", uri);
          setTimeout(() => triggerEnd(), 1500);
        }
      });
    } catch {}

    return () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }

      try {
        subEnd?.remove();
      } catch {}

      try {
        subStatus?.remove();
      } catch {}

      try {
        player.pause();
      } catch {}
    };
  }, [player, uri]);

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  video: { flex: 1 },
});

export default memo(VideoRenderer);