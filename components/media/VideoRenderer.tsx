import React, { memo, useRef, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

interface VideoRendererProps {
  uri: string;
  durationSec?: number;
  onEnd?: () => void;
}

const IDLE_RECOVERY_DELAY_MS = 900;
const ERROR_ADVANCE_DELAY_MS = 700;
const END_TOLERANCE_SEC = 0.05;

function getSafetyWatchdogMs(realDurationSec?: number) {
  if (realDurationSec && realDurationSec > 0) {
    return Math.min((realDurationSec + 10) * 1000, 300000);
  }
  return 120000;
}

function VideoRenderer({ uri, durationSec, onEnd }: VideoRendererProps) {
  const onEndRef = useRef(onEnd);
  const endCalledRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRecoveryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startedRef = useRef(false);
  const progressedRef = useRef(false);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const watchdogMsRef = useRef(0);

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
    startedRef.current = false;
    progressedRef.current = false;
    currentTimeRef.current = 0;
    durationRef.current = 0;
    watchdogMsRef.current = 0;

    console.log("[VideoRenderer] Montando v\u00eddeo:", uri);

    const clearAllTimers = () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
      if (idleRecoveryRef.current) {
        clearTimeout(idleRecoveryRef.current);
        idleRecoveryRef.current = null;
      }
    };

    const triggerEnd = () => {
      if (endCalledRef.current) return;
      endCalledRef.current = true;
      clearAllTimers();
      console.log("[VideoRenderer] Avan\u00e7ando");
      onEndRef.current?.();
    };

    const isNearEnd = () => {
      const duration = Number(durationRef.current) || 0;
      const currentTime = Number(currentTimeRef.current) || 0;
      if (!duration || duration <= 0) return false;
      return currentTime >= duration - END_TOLERANCE_SEC;
    };

    const armWatchdog = (realDurationSec?: number) => {
      if (endCalledRef.current) return;

      const timeoutMs = getSafetyWatchdogMs(realDurationSec);
      const sameTimeout = timeoutMs === watchdogMsRef.current;
      if (sameTimeout && watchdogRef.current) return;

      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }

      watchdogMsRef.current = timeoutMs;
      console.log("[VideoRenderer] Watchdog de seguran\u00e7a armado:", timeoutMs, "ms");

      watchdogRef.current = setTimeout(() => {
        console.warn("[VideoRenderer] Watchdog de seguran\u00e7a disparou, avan\u00e7ando");
        triggerEnd();
      }, timeoutMs);
    };

    const scheduleIdleRecovery = () => {
      if (endCalledRef.current || idleRecoveryRef.current) return;

      idleRecoveryRef.current = setTimeout(() => {
        idleRecoveryRef.current = null;
        if (endCalledRef.current) return;

        if (isNearEnd()) {
          console.log("[VideoRenderer] Idle detectado j\u00e1 no final; flush curto");
          setTimeout(() => {
            if (!endCalledRef.current) triggerEnd();
          }, 250);
          return;
        }

        console.warn("[VideoRenderer] Idle fora do fim; tentando recover com play()");
        try { player.play(); } catch {}

        setTimeout(() => {
          if (endCalledRef.current) return;
          const stillNoProgress = currentTimeRef.current <= 0.05;
          if (stillNoProgress) {
            console.warn("[VideoRenderer] Sem progresso ap\u00f3s recover; avan\u00e7ando");
            triggerEnd();
          }
        }, 1200);
      }, IDLE_RECOVERY_DELAY_MS);
    };

    armWatchdog();

    let subEnd: { remove: () => void } | null = null;
    let subStatus: { remove: () => void } | null = null;
    let subTime: { remove: () => void } | null = null;
    let subPlaying: { remove: () => void } | null = null;

    try {
      subEnd = player.addListener("playToEnd", () => {
        console.log("[VideoRenderer] playToEnd");
        triggerEnd();
      });
    } catch {}

    try {
      subTime = player.addListener(
        "timeUpdate",
        ({ currentTime, duration }: any) => {
          currentTimeRef.current = Number(currentTime) || 0;

          const nextDuration = Number(duration) || 0;
          const prevDuration = durationRef.current || 0;

          if (nextDuration > 0) {
            durationRef.current = nextDuration;

            if (Math.abs(nextDuration - prevDuration) > 0.2) {
              armWatchdog(nextDuration);
            }
          }

          if (currentTimeRef.current > 0.05) {
            startedRef.current = true;
            progressedRef.current = true;

            if (idleRecoveryRef.current) {
              clearTimeout(idleRecoveryRef.current);
              idleRecoveryRef.current = null;
            }
          }
        },
      );
    } catch {}

    try {
      subPlaying = player.addListener("playingChange", ({ isPlaying }: any) => {
        if (isPlaying) startedRef.current = true;
      });
    } catch {}

    try {
      subStatus = player.addListener("statusChange", ({ status }: any) => {
        console.log("[VideoRenderer] statusChange:", status);

        if (status === "readyToPlay") {
          try { player.play(); } catch {}
        }

        if (status === "idle" && (startedRef.current || progressedRef.current)) {
          console.warn("[VideoRenderer] statusChange -> idle ap\u00f3s iniciar");
          scheduleIdleRecovery();
        }

        if (status === "error") {
          console.error("[VideoRenderer] Erro:", uri);
          setTimeout(() => triggerEnd(), ERROR_ADVANCE_DELAY_MS);
        }
      });
    } catch {}

    return () => {
      clearAllTimers();
      try { subEnd?.remove(); } catch {}
      try { subStatus?.remove(); } catch {}
      try { subTime?.remove(); } catch {}
      try { subPlaying?.remove(); } catch {}
      try { player.pause(); } catch {}
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
  video: { flex: 1, backgroundColor: "#000" },
});

export default memo(VideoRenderer);
