// Iron Screens — Video Renderer (expo-video)
// Vídeo avança somente no fim natural ou em erro.
// Não corta vídeo por durationSec configurado.

import React, { memo, useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoRendererProps {
  uri: string;
  durationSec?: number;
  onEnd?: () => void;
}

function VideoRenderer({ uri, onEnd }: VideoRendererProps) {
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const endCalledRef = useRef(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    endCalledRef.current = false;
    console.log('[VideoRenderer] Montando vídeo:', uri);

    const triggerEnd = () => {
      if (!endCalledRef.current) {
        endCalledRef.current = true;
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

        if (status === 'idle' && started) {
          console.log('[VideoRenderer] statusChange -> idle após iniciar');
          triggerEnd();
        }

        if (status === 'error') {
          console.error('[VideoRenderer] Erro:', uri);
          setTimeout(() => triggerEnd(), 3000);
        }
      });
    } catch (_) {}

    return () => {
      try {
        subEnd?.remove();
      } catch (_) {}

      try {
        subStatus?.remove();
      } catch (_) {}

      try {
        player.pause();
      } catch (_) {}
    };
  }, [player, uri]);

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