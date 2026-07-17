// Iron Screens — Contexto de rotação simulada
// Algumas TV boxes genéricas não conseguem girar a saída HDMI de verdade
// (o hardware/firmware fica sempre em paisagem, mesmo pedindo retrato via
// software). Quando o monitor físico está montado em pé, simulamos o
// retrato girando só o conteúdo do app dentro do frame paisagem — ver
// RotatedViewport. Este contexto avisa os componentes descendentes que a
// rotação está ativa, pra que eles troquem largura/altura "lógicas" ao
// invés de usar Dimensions/useWindowDimensions cru (que sempre reporta o
// frame físico real, sempre paisagem).
import React, { createContext, useContext } from 'react';

const RotationContext = createContext(false);

export function RotationProvider({
  rotated,
  children,
}: {
  rotated: boolean;
  children: React.ReactNode;
}) {
  return (
    <RotationContext.Provider value={rotated}>
      {children}
    </RotationContext.Provider>
  );
}

export function useIsRotated(): boolean {
  return useContext(RotationContext);
}
