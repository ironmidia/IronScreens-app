// Iron Screens — Video Renderer (expo-video)
import React, { memo, useRef, useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoRendererProps {
  uri: string;
  onEnd?: () => void;
}

const { width, height } = Dimensions.get('window');

function VideoRenderer({ uri, onEnd }: VideoRendererProps) {
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  // Guard: ensure onEnd is called at most once per playback cycle
  const endCalledRef = useRef(false);

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
        onEndRef.current?.();
      }
    };

    // Primary: expo-video native event (fires on most devices)
    const subEnd = player.addListener('playToEnd', () => {
      triggerEnd();
    });

    // Fallback: statusChange to 'idle' after video has started playing
    // Catches Android devices where playToEnd doesn't fire reliably
    let hasStartedPlaying = false;
    const subStatus = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') {
        hasStartedPlaying = true;
      }
      if (status === 'idle' && hasStartedPlaying) {
        triggerEnd();
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
