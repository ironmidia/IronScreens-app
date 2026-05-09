// Iron Screens — Video Renderer (expo-video)
import React, { memo, useCallback } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface VideoRendererProps {
  uri: string;
  onEnd?: () => void;
}

const { width, height } = Dimensions.get('window');

function VideoRenderer({ uri, onEnd }: VideoRendererProps) {
  const onEndRef = React.useRef(onEnd);
  React.useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });

  // Listen for playback end
  React.useEffect(() => {
    const sub = player.addListener('playToEnd', () => {
      onEndRef.current?.();
    });
    return () => {
      sub.remove();
      player.pause();
    };
  }, [player]);

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
