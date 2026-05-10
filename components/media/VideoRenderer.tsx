// Iron Screens — Video Renderer (expo-video)
import React, { memo, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoRendererProps {
  uri: string;
  onEnd?: () => void;
}

const { width, height } = Dimensions.get('window');

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
      if (status === 'readyToPlay') {
        hasStartedPlaying = true;
      }
      if (status === 'idle' && hasStartedPlaying) {
        triggerEnd();
      }
      // Detecta erro de carregamento
      if (status === 'error') {
        console.error('[VideoRenderer] Erro ao carregar vídeo:', uri);
        // Avança playlist após 3s para não travar
        setTimeout(() => triggerEnd(), 3_000);
      }
    });

    return () => {
      subEnd.remove();
      subStatus.remove();
      player.pause();
    };
  }, [player, uri]);

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width,
    height,
    backgroundColor: '#000',
  },
});

export default memo(VideoRenderer);
