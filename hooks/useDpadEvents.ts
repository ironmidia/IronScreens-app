// Iron Screens — Ponte de eventos do controle remoto (D-pad)
// Escuta o evento nativo emitido por MainActivity.kt (dispatchKeyEvent) toda
// vez que uma tecla de seta ou OK/Enter do controle físico é pressionada.
import { useEffect, useRef } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';

export type DpadKey = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SELECT';

const EVENT_NAME = 'IronScreensDpadEvent';

export function useDpadEvents(onKey: (key: DpadKey) => void, enabled = true) {
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;

  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;

    const sub = DeviceEventEmitter.addListener(EVENT_NAME, (payload: { key: DpadKey }) => {
      onKeyRef.current(payload.key);
    });

    return () => sub.remove();
  }, [enabled]);
}
