// Iron Screens — Footer Bar Component
import React, { useEffect, useRef, useState, useCallback } from 'react';
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
export const BAR_HEIGHT = 52;
const FONT_SIZE = 20;

interface Props {
  config: FooterBarConfig;
}

// Atualiza a cada 1 segundo para mostrar hora exata
function useClock(enabled: boolean): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const now = new Date();
      const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLabel(`${date}  ${time}`);
    };
    update();
    const id = setInterval(update, 1_000); // atualiza todo segundo
    return () => clearInterval(id);
  }, [enabled]);
  return label;
}

// Texto completo: texto principal  ·  data hora
function buildFullText(text: string, clock: string, showDatetime: boolean): string {
  if (showDatetime && clock) return `${text}     ·     ${clock}`;
  return text;
}

function ScrollTicker({
  fullText, textColor, bold, italic,
}: {
  fullText: string; textColor: string; bold: boolean; italic: boolean;
}) {
  const screenWidth = Dimensions.get('window').width;
  const translateX = useRef(new Animated.Value(screenWidth)).current;
  const isRunning = useRef(false);
  const textWidthRef = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const runLoop = useCallback((textWidth: number) => {
    if (textWidth <= 0) return;
    isRunning.current = true;
    translateX.setValue(screenWidth);

    const totalDistance = screenWidth + textWidth + 120;
    const duration = (totalDistance / TICKER_SPEED) * 1000;

    animRef.current = Animated.timing(translateX, {
      toValue: -(textWidth + 120),
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    animRef.current.start(({ finished }) => {
      if (finished && isRunning.current) runLoop(textWidth);
    });
  }, [screenWidth]);

  const stopLoop = useCallback(() => {
    isRunning.current = false;
    animRef.current?.stop();
  }, []);

  // Quando o texto muda (inclusive quando o clock muda a cada segundo),
  // não reinicia a animação — apenas atualiza o conteúdo visualmente.
  // O loop continua com a largura já medida.
  // Isso evita o "pisca" a cada segundo.
  // A largura só é re-medida via onLayout quando o componente monta.

  useEffect(() => {
    return () => { stopLoop(); };
  }, []);

  const fontWeight = bold ? ('bold' as const) : ('500' as const);
  const fontStyle  = italic ? ('italic' as const) : ('normal' as const);

  return (
    <View style={styles.tickerContainer}>
      <Animated.Text
        style={[
          styles.scrollText,
          { color: textColor, fontWeight, fontStyle, transform: [{ translateX }] },
        ]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - textWidthRef.current) > 10) {
            textWidthRef.current = w;
            stopLoop();
            runLoop(w);
          }
        }}
      >
        {fullText}
      </Animated.Text>
    </View>
  );
}

export default function FooterBar({ config }: Props) {
  const clock  = useClock(config.show_datetime);
  const bg     = config.bg_color   || '#1a1a1a';
  const tc     = config.text_color || '#ffffff';
  const bold   = !!(config as any).bold;
  const italic = !!(config as any).italic;

  const fontWeight = bold   ? ('bold'   as const) : ('500' as const);
  const fontStyle  = italic ? ('italic' as const) : ('normal' as const);

  // Ordem: texto principal  ·  data e hora
  const fullScrollText = buildFullText(config.text, clock, config.show_datetime);

  return (
    <View style={[styles.bar, { backgroundColor: bg }]}>
      {/* Logo */}
      {config.logo_url ? (
        <Image source={{ uri: config.logo_url }} style={styles.logo} resizeMode="contain" />
      ) : null}

      {config.logo_url ? (
        <View style={[styles.divider, { backgroundColor: tc, opacity: 0.25 }]} />
      ) : null}

      {/* Modo scroll: texto + data/hora rolam juntos */}
      {config.mode === 'scroll' ? (
        <ScrollTicker
          fullText={fullScrollText}
          textColor={tc}
          bold={bold}
          italic={italic}
        />
      ) : (
        // Modo fixo: lado a lado
        <>
          <Text numberOfLines={1} style={[styles.fixedText, { color: tc, fontWeight, fontStyle }]}>
            {config.text}
          </Text>
          {config.show_datetime && clock ? (
            <>
              <View style={[styles.divider, { backgroundColor: tc, opacity: 0.25 }]} />
              <Text style={[styles.clockFixed, { color: tc, fontWeight, fontStyle }]}>{clock}</Text>
            </>
          ) : null}
        </>
      )}
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
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  fixedText: {
    flex: 1,
    fontSize: FONT_SIZE,
    letterSpacing: 0.3,
  },
  clockFixed: {
    fontSize: FONT_SIZE,
    letterSpacing: 0.5,
    flexShrink: 0,
  },
});
