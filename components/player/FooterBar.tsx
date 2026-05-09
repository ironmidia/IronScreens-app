// Iron Screens — Footer Bar Component
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
} from 'react-native';
import type { FooterBarConfig } from '@/hooks/useFooterBar';

const TICKER_SPEED = 100; // pixels por segundo
export const BAR_HEIGHT = 56;
const FONT_SIZE = 22;

interface Props {
  config: FooterBarConfig;
}

function useClock(enabled: boolean): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const now = new Date();
      const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setLabel(`${date} ${time}`);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [enabled]);
  return label;
}

function ScrollTicker({ text, textColor }: { text: string; textColor: string }) {
  const screenWidth = Dimensions.get('window').width;
  const translateX = useRef(new Animated.Value(screenWidth)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const textWidthRef = useRef(0);

  const startLoop = (textWidth: number) => {
    // Para qualquer animação anterior
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }

    // Reseta para fora da tela à direita
    translateX.setValue(screenWidth);

    const totalDistance = screenWidth + textWidth + 80;
    const duration = (totalDistance / TICKER_SPEED) * 1000;

    // Usa sequence para garantir reset antes de cada loop
    const runOnce = Animated.timing(translateX, {
      toValue: -(textWidth + 80),
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    animRef.current = Animated.loop(runOnce, { iterations: -1 });
    animRef.current.start();
  };

  // Reinicia loop se o texto mudar
  useEffect(() => {
    if (textWidthRef.current > 0) {
      startLoop(textWidthRef.current);
    }
  }, [text]);

  useEffect(() => {
    return () => {
      if (animRef.current) animRef.current.stop();
    };
  }, []);

  return (
    <View style={styles.tickerContainer}>
      <Animated.Text
        numberOfLines={1}
        style={[styles.scrollText, { color: textColor, transform: [{ translateX }] }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && w !== textWidthRef.current) {
            textWidthRef.current = w;
            startLoop(w);
          }
        }}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

export default function FooterBar({ config }: Props) {
  const clock = useClock(config.show_datetime);
  const bg = config.bg_color || '#1a1a1a';
  const tc = config.text_color || '#ffffff';

  return (
    <View style={[styles.bar, { backgroundColor: bg }]}>
      {/* Logo */}
      {config.logo_url ? (
        <Image source={{ uri: config.logo_url }} style={styles.logo} resizeMode="contain" />
      ) : null}

      {config.logo_url ? (
        <View style={[styles.divider, { backgroundColor: tc, opacity: 0.25 }]} />
      ) : null}

      {/* Texto scroll ou fixo */}
      {config.mode === 'scroll' ? (
        <ScrollTicker text={config.text} textColor={tc} />
      ) : (
        <Text numberOfLines={1} style={[styles.fixedText, { color: tc }]}>
          {config.text}
        </Text>
      )}

      {/* Data e hora */}
      {config.show_datetime && clock ? (
        <>
          <View style={[styles.divider, { backgroundColor: tc, opacity: 0.25 }]} />
          <Text style={[styles.clock, { color: tc }]}>{clock}</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    zIndex: 50,
    elevation: 10,
  },
  logo: {
    height: BAR_HEIGHT - 12,
    width: 80,
    flexShrink: 0,
  },
  divider: {
    width: 1,
    height: BAR_HEIGHT - 20,
    flexShrink: 0,
  },
  tickerContainer: {
    flex: 1,
    height: BAR_HEIGHT,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  scrollText: {
    fontSize: FONT_SIZE,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  fixedText: {
    flex: 1,
    fontSize: FONT_SIZE,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  clock: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
});
