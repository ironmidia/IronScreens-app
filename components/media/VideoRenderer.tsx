// Iron Screens — Video Renderer (expo-video)
import React, { memo, useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoRendererProps {
  uri: string;
  onEnd?: () => void;
}

function VideoRenderer({ uri, onEnd }: VideoRendererProps) {
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  const endCalledRef = useRef(false);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    endCalledRef.current = false;
    console.log('[VideoRenderer] Iniciando vídeo:', uri);

    const triggerEnd = () => {
      if (!endCalledRef.current) {
        endCalledRef.current = true;
        console.log('[VideoRenderer] Vídeo encerrado, avançando...');
        onEndRef.current?.();
      }
    };

    // Listeners podem falhar se o player já foi liberado (Fabric/nova arquitetura)
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
        console.log('[VideoRenderer] Status:', status);
        if (status === 'readyToPlay') hasStartedPlaying = true;
        if (status === 'idle' && hasStartedPlaying) triggerEnd();
        if (status === 'error') {
          console.error('[VideoRenderer] Erro ao carregar vídeo:', uri);
          setTimeout(() => triggerEnd(), 3_000);
        }
      });
    } catch (_) {}

    return () => {
      // Cada operação isolada em try/catch:
      // o objeto nativo pode ser liberado antes do cleanup no Fabric.
      try { subEnd?.remove(); } catch (_) {}
      try { subStatus?.remove(); } catch (_) {}
      try { player.pause(); } catch (_) {}
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
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
});

export default memo(VideoRenderer);
