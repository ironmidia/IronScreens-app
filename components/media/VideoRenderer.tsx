// Iron Screens — Video Renderer (expo-video)
// Timer de duração em useEffect isolado: reage imediatamente quando durationSec muda,
// inclusive sem trocar de mídia (ex: salvar playlist com novo tempo).
import React, { memo, useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoRendererProps {
  uri: string;
  durationSec?: number;
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

  // ---- Listeners de fim de vídeo (independente do timer de duração) ----
  useEffect(() => {
    endCalledRef.current = false;
    console.log('[VideoRenderer] Montando vídeo:', uri);

    const triggerEnd = () => {
      if (!endCalledRef.current) {
        endCalledRef.current = true;
        if (durationTimerRef.current) {
          clearTimeout(durationTimerRef.current);
          durationTimerRef.current = null;
        }
        console.log('[VideoRenderer] Avançando (fim natural)');
        onEndRef.current?.();
      }
    };

    let subEnd: { remove: () => void } | null = null;
    let subStatus: { remove: () => void } | null = null;

    try {
      subEnd = player.addListener('playToEnd', () => {
        console.log('[VideoRenderer] playToEnd');
        triggerEnd();
      });
    } catch (_) {}

    try {
      let started = false;
      subStatus = player.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay') started = true;
        if (status === 'idle' && started) triggerEnd();
        if (status === 'error') {
          console.error('[VideoRenderer] Erro:', uri);
          setTimeout(() => triggerEnd(), 3_000);
        }
      });
    } catch (_) {}

    return () => {
      try { subEnd?.remove(); } catch (_) {}
      try { subStatus?.remove(); } catch (_) {}
      try { player.pause(); } catch (_) {}
    };
  }, [player, uri]);

  // ---- Timer de duração máxima — useEffect isolado ----
  // Roda toda vez que durationSec muda (ex: usuário salvou nova duração no painel)
  // sem precisar trocar de mídia ou recriar o player.
  useEffect(() => {
    // Se o vídeo já avançou (endCalled), não recria timer
    if (endCalledRef.current) return;

    if (durationTimerRef.current) {
      clearTimeout(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    const sec = Number(durationSec);
    if (!sec || sec <= 0) return;

    console.log(`[VideoRenderer] Timer máximo: ${sec}s`);

    durationTimerRef.current = setTimeout(() => {
      if (!endCalledRef.current) {
        endCalledRef.current = true;
        console.log(`[VideoRenderer] Avançando por duração máxima (${sec}s)`);
        onEndRef.current?.();
      }
    }, sec * 1000);

    return () => {
      if (durationTimerRef.current) {
        clearTimeout(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [durationSec]); // <-- só depende de durationSec

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
