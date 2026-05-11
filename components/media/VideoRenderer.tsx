// Iron Screens — Video Renderer (expo-video)
// Avança ao fim natural do vídeo OU quando o durationSec configurado for atingido.
import React, { memo, useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoRendererProps {
  uri: string;
  durationSec?: number; // tempo máximo configurado no sistema
  onEnd?: () => void;
}

function VideoRenderer({ uri, durationSec, onEnd }: VideoRendererProps) {
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  const endCalledRef = useRef(false);
  const durationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    endCalledRef.current = false;

    const triggerEnd = () => {
      if (!endCalledRef.current) {
        endCalledRef.current = true;
        console.log('[VideoRenderer] Avançando...');
        // Cancela o timer de duração se o vídeo terminou antes
        if (durationTimerRef.current) {
          clearTimeout(durationTimerRef.current);
          durationTimerRef.current = null;
        }
        onEndRef.current?.();
      }
    };

    // Timer de duração máxima — respeita o duration_sec configurado no sistema
    // Garante que o vídeo não fica mais tempo que o configurado, independente do tamanho real
    if (durationSec && durationSec > 0) {
      const ms = Number(durationSec) * 1000;
      console.log(`[VideoRenderer] Timer de duração máxima: ${durationSec}s`);
      durationTimerRef.current = setTimeout(() => {
        console.log('[VideoRenderer] Duração máxima atingida, avançando...');
        triggerEnd();
      }, ms);
    }

    let subEnd: { remove: () => void } | null = null;
    let subStatus: { remove: () => void } | null = null;

    try {
      subEnd = player.addListener('playToEnd', () => {
        console.log('[VideoRenderer] Evento: playToEnd');
        triggerEnd();
      });
    } catch (_) {}

    try {
      let hasStartedPlaying = false;
      subStatus = player.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay') hasStartedPlaying = true;
        if (status === 'idle' && hasStartedPlaying) triggerEnd();
        if (status === 'error') {
          console.error('[VideoRenderer] Erro ao carregar vídeo:', uri);
          setTimeout(() => triggerEnd(), 3_000);
        }
      });
    } catch (_) {}

    return () => {
      if (durationTimerRef.current) {
        clearTimeout(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      try { subEnd?.remove(); } catch (_) {}
      try { subStatus?.remove(); } catch (_) {}
      try { player.pause(); } catch (_) {}
    };
  }, [player, uri, durationSec]);

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
});

export default memo(VideoRenderer);
