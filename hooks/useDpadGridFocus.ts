// Iron Screens — Navegação em grade por controle remoto (D-pad)
// Gerencia qual célula está em foco numa grade de linhas com larguras
// variáveis (ex: linha "Voltar" com 1 item, linhas de teclado com 6, linha de
// ações com 2) e traduz eventos de seta/OK em movimento de foco + seleção.
import { useCallback, useState } from 'react';
import { useDpadEvents, DpadKey } from './useDpadEvents';

export interface DpadGridFocus {
  row: number;
  col: number;
  isFocused: (row: number, col: number) => boolean;
}

/**
 * @param layout Quantidade de colunas de cada linha, ex: [1, 6, 6, 6, 2]
 * @param onSelect Chamado com (row, col) quando o usuário aperta OK/Enter
 * @param enabled Só processa eventos quando true (ex: passo ativo da tela)
 */
export function useDpadGridFocus(
  layout: number[],
  onSelect: (row: number, col: number) => void,
  enabled = true,
): DpadGridFocus {
  const [row, setRow] = useState(0);
  const [col, setCol] = useState(0);

  const handleKey = useCallback(
    (key: DpadKey) => {
      if (!layout.length) return;

      if (key === 'SELECT') {
        onSelect(row, col);
        return;
      }

      setRow((prevRow) => {
        let nextRow = prevRow;
        if (key === 'UP' && prevRow > 0) nextRow = prevRow - 1;
        if (key === 'DOWN' && prevRow < layout.length - 1) nextRow = prevRow + 1;

        if (nextRow !== prevRow) {
          setCol((prevCol) => Math.min(prevCol, Math.max(0, layout[nextRow] - 1)));
        }
        return nextRow;
      });

      if (key === 'LEFT') {
        setCol((prevCol) => Math.max(0, prevCol - 1));
      }
      if (key === 'RIGHT') {
        setCol((prevCol) => Math.min(Math.max(0, layout[row] - 1), prevCol + 1));
      }
    },
    [layout, row, col, onSelect],
  );

  useDpadEvents(handleKey, enabled);

  const isFocused = useCallback((r: number, c: number) => r === row && c === col, [row, col]);

  return { row, col, isFocused };
}
