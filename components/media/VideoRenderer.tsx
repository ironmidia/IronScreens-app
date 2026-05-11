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

    const subEnd = player.addListener('playToEnd', () => {
      console.log('[VideoRenderer] Evento: playToEnd');
      triggerEnd();
    });

    let hasStartedPlaying = false;
    const subStatus = player.addListener('statusChange', ({ status }) => {
      console.log('[VideoRenderer] Status:', status);
      if (status === 'readyToPlay') hasStartedPlaying = true;
      if (status === 'idle' && hasStartedPlaying) triggerEnd();
      if (status === 'error') {
        console.error('[VideoRenderer] Erro ao carregar vídeo:', uri);
        setTimeout(() => triggerEnd(), 3_000);
      }
    });

    return () => {
      subEnd.remove();
      subStatus.remove();
      // O objeto nativo pode ser liberado antes do cleanup no Fabric (nova arquitetura).
      // O try/catch evita o crash "shared object already released".
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
