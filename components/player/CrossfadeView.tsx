// Iron Screens — Crossfade Transition Container
import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Dimensions } from 'react-native';
import { CROSSFADE_DURATION_MS } from '@/constants/config';

const { width, height } = Dimensions.get('window');

interface CrossfadeViewProps {
  children: React.ReactNode;
  triggerKey: string; // changes when content changes → triggers fade
}

function CrossfadeView({ children, triggerKey }: CrossfadeViewProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade out then in when key changes
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: CROSSFADE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [triggerKey]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    height,
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default memo(CrossfadeView);
