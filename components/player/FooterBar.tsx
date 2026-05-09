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

const TICKER_SPEED = 80; // pixels por segundo
export const BAR_HEIGHT = 48;

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

/** Modo scroll: texto corre da direita para a esquerda em loop */
function ScrollTicker({ text, textColor, fontSize = 15 }: { text: string; textColor: string; fontSize?: number }) {
  const { width } = Dimensions.get('window');
  const translateX = useRef(new Animated.Value(width)).current;
  const textWidthRef = useRef(0);

  const startAnim = (textWidth: number) => {
    translateX.setValue(width);
    const distance = width + textWidth + 40;
    const duration = (distance / TICKER_SPEED) * 1000;
    Animated.loop(
      Animated.timing(translateX, {
        toValue: -textWidth - 40,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <Animated.Text
        numberOfLines={1}
        style={[styles.scrollText, { color: textColor, fontSize, transform: [{ translateX }] }]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          textWidthRef.current = w;
          startAnim(w);
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
        <Image
          source={{ uri: config.logo_url }}
          style={styles.logo}
          resizeMode="contain"
        />
      ) : null}

      {/* Separador vertical se tiver logo */}
      {config.logo_url ? (
        <View style={[styles.divider, { backgroundColor: tc, opacity: 0.25 }]} />
      ) : null}

      {/* Texto (scroll ou fixo) */}
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
    // Posicionamento absoluto na base da tela, sobrepondo a mídia
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
    elevation: 10, // Android
  },
  logo: {
    height: BAR_HEIGHT - 12,
    width: 70,
    flexShrink: 0,
  },
  divider: {
    width: 1,
    height: BAR_HEIGHT - 20,
    flexShrink: 0,
  },
  scrollText: {
    fontWeight: '500',
    letterSpacing: 0.3,
    position: 'absolute',
    whiteSpace: 'nowrap',
  } as any,
  fixedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  clock: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    flexShrink: 0,
  },
});
