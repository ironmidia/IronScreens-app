// Iron Screens — Dimensões "lógicas" da janela
// Quando a rotação simulada está ativa (ver RotatedViewport), a janela do
// SO continua reportando paisagem — width/height crus do
// useWindowDimensions() não refletem o que o app está de fato desenhando.
// Este hook troca width/height quando necessário, pra qualquer componente
// que precise decidir layout com base no formato da tela (retrato vs
// paisagem) continuar funcionando corretamente.
import { useWindowDimensions } from 'react-native';
import { useIsRotated } from '@/contexts/RotationContext';

export function useLogicalWindowDimensions(): { width: number; height: number } {
  const { width, height } = useWindowDimensions();
  const rotated = useIsRotated();
  return rotated ? { width: height, height: width } : { width, height };
}
