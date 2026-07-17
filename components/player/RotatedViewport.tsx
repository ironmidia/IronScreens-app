// Iron Screens — Viewport com rotação simulada
// Gira o conteúdo do app 90° dentro do frame físico (que fica sempre travado
// em paisagem no nível do sistema — ver applyOrientation em app/player.tsx).
// Usado quando o monitor está fisicamente montado em pé mas a TV box não
// consegue rotacionar a saída HDMI de verdade.
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { RotationProvider } from '@/contexts/RotationContext';

interface RotatedViewportProps {
  rotate: boolean;
  children: React.ReactNode;
  /** Troque pra -90 se o conteúdo aparecer de cabeça pra baixo no monitor físico */
  degrees?: 90 | -90;
}

export default function RotatedViewport({
  rotate,
  children,
  degrees = 90,
}: RotatedViewportProps) {
  const { width, height } = useWindowDimensions();

  if (!rotate) {
    return (
      <RotationProvider rotated={false}>
        <View style={styles.fill}>{children}</View>
      </RotationProvider>
    );
  }

  // O bloco interno nasce com largura/altura trocadas (comporta-se como uma
  // tela retrato) e depois é girado — a rotação em torno do próprio centro
  // faz a "pegada" visual pós-rotação bater exatamente com o frame físico
  // (paisagem), sem sobra nem corte.
  return (
    <RotationProvider rotated>
      <View style={[styles.outer, { width, height }]}>
        <View
          style={[
            styles.inner,
            {
              width: height,
              height: width,
              transform: [{ rotate: `${degrees}deg` }],
            },
          ]}
        >
          {children}
        </View>
      </View>
    </RotationProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  outer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  inner: {
    overflow: 'hidden',
  },
});
