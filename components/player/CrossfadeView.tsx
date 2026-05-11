// Iron Screens — Crossfade Transition Container
import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { CROSSFADE_DURATION_MS } from '@/constants/config';

interface CrossfadeViewProps {
  children: React.ReactNode;
  triggerKey: string;
}

function CrossfadeView({ children, triggerKey }: CrossfadeViewProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: CROSSFADE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [triggerKey]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      {children}
    </Animated.View>
  );
}

export default memo(CrossfadeView);
