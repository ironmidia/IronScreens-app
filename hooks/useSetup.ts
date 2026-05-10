// Iron Screens — Setup Hook (Terminal Selection + PIN Validation)
import { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal } from '@/services/models';
import { fetchTerminals, setTerminalOnline, setTerminalOffline } from '@/services/terminalService';
import { saveTerminal, loadTerminal, clearTerminal } from '@/services/storageService';
import { HEARTBEAT_INTERVAL_MS } from '@/constants/config';

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30;

export type SetupStep = 'select' | 'pin';

export interface SetupState {
  step: SetupStep;
  terminals: Terminal[];
  selectedTerminal: Terminal | null;
  loading: boolean;
  confirming: boolean;
  error: string | null;
  savedTerminalId: string | null;
  pinValue: string;
  pinError: string | null;
  pinAttempts: number;
  lockedOut: boolean;
  lockoutSecondsLeft: number;
}

export interface SetupActions {
  refresh: () => Promise<void>;
  selectTerminal: (terminal: Terminal) => void;
  backToSelect: () => void;
  onPinChange: (value: string) => void;
  confirmPin: () => Promise<void>;
  clearSaved: () => Promise<void>;
}

export function useSetup(): [SetupState, SetupActions] {
  const [step, setStep] = useState<SetupStep>('select');
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTerminalId, setSavedTerminalId] = useState<string | null>(null);

  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Terminal ativo para heartbeat enquanto estiver na tela de setup
  const heartbeatTerminalRef = useRef<string | null>(null);

  const clearLockout = useCallback(() => {
    if (lockoutTimer.current) {
      clearInterval(lockoutTimer.current);
      lockoutTimer.current = null;
    }
  }, []);

  const startLockout = useCallback(() => {
    setLockedOut(true);
    setLockoutSecondsLeft(LOCKOUT_SECONDS);
    let remaining = LOCKOUT_SECONDS;
    lockoutTimer.current = setInterval(() => {
      remaining -= 1;
      setLockoutSecondsLeft(remaining);
      if (remaining <= 0) {
        clearLockout();
        setLockedOut(false);
        setPinAttempts(0);
        setPinError(null);
      }
    }, 1000);
  }, [clearLockout]);

  useEffect(() => () => clearLockout(), [clearLockout]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, stored] = await Promise.all([
        fetchTerminals(),
        loadTerminal(),
      ]);
      setTerminals(list);
      setSavedTerminalId(stored.terminalId);
      // Registra terminal já salvo para heartbeat contínuo
      if (stored.terminalId) {
        heartbeatTerminalRef.current = stored.terminalId;
        // Marca online imediatamente ao carregar
        try { await setTerminalOnline(stored.terminalId); } catch { /* ignora */ }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar terminais');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Heartbeat contínuo enquanto o app estiver na tela de setup
  // Mantém o terminal online mesmo sem estar no player
  useEffect(() => {
    const interval = setInterval(async () => {
      const tid = heartbeatTerminalRef.current;
      if (tid) {
        try { await setTerminalOnline(tid); } catch { /* ignora falha de rede */ }
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const selectTerminal = useCallback((terminal: Terminal) => {
    setSelectedTerminal(terminal);
    setPinValue('');
    setPinError(null);
    setPinAttempts(0);
    setLockedOut(false);
    clearLockout();
    setStep('pin');
  }, [clearLockout]);

  const backToSelect = useCallback(() => {
    setStep('select');
    setSelectedTerminal(null);
    setPinValue('');
    setPinError(null);
    clearLockout();
    setLockedOut(false);
  }, [clearLockout]);

  const onPinChange = useCallback((value: string) => {
    if (lockedOut) return;
    const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 5);
    setPinValue(clean);
    setPinError(null);
  }, [lockedOut]);

  const confirmPin = useCallback(async () => {
    if (!selectedTerminal || lockedOut) return;

    const expectedPin = selectedTerminal.setup_pin;

    if (!expectedPin) {
      setConfirming(true);
      try {
        await saveTerminal(selectedTerminal.id, selectedTerminal.orientation, selectedTerminal.name);
        await setTerminalOnline(selectedTerminal.id);
        heartbeatTerminalRef.current = selectedTerminal.id;
        setSavedTerminalId(selectedTerminal.id);
      } catch (err: any) {
        setError(err.message || 'Erro ao configurar terminal');
      } finally {
        setConfirming(false);
      }
      return;
    }

    if (pinValue.length !== 5) {
      setPinError('O PIN deve ter 5 caracteres.');
      return;
    }

    if (pinValue.toUpperCase() !== expectedPin.toUpperCase()) {
      const newAttempts = pinAttempts + 1;
      setPinAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setPinError(`PIN incorreto. Aguarde ${LOCKOUT_SECONDS} segundos.`);
        startLockout();
      } else {
        setPinError(`PIN incorreto. ${MAX_ATTEMPTS - newAttempts} tentativa(s) restante(s).`);
      }
      setPinValue('');
      return;
    }

    // PIN correto
    setPinError(null);
    setConfirming(true);
    try {
      await saveTerminal(selectedTerminal.id, selectedTerminal.orientation, selectedTerminal.name);
      await setTerminalOnline(selectedTerminal.id);
      heartbeatTerminalRef.current = selectedTerminal.id;
      setSavedTerminalId(selectedTerminal.id);
    } catch (err: any) {
      setError(err.message || 'Erro ao configurar terminal');
    } finally {
      setConfirming(false);
    }
  }, [selectedTerminal, pinValue, pinAttempts, lockedOut, startLockout]);

  // Limpa o terminal salvo e marca offline
  const clearSaved = useCallback(async () => {
    const oldId = heartbeatTerminalRef.current;
    await clearTerminal();
    heartbeatTerminalRef.current = null;
    setSavedTerminalId(null);
    if (oldId) {
      try { await setTerminalOffline(oldId); } catch { /* ignora */ }
    }
  }, []);

  return [
    {
      step,
      terminals,
      selectedTerminal,
      loading,
      confirming,
      error,
      savedTerminalId,
      pinValue,
      pinError,
      pinAttempts,
      lockedOut,
      lockoutSecondsLeft,
    },
    { refresh: loadData, selectTerminal, backToSelect, onPinChange, confirmPin, clearSaved },
  ];
}
