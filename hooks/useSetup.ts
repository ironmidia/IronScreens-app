// Iron Screens — Setup Hook (Terminal Selection)
import { useState, useEffect, useCallback } from 'react';
import { Terminal } from '@/services/models';
import { fetchTerminals, setTerminalOnline } from '@/services/terminalService';
import { saveTerminal, loadTerminal, clearTerminal } from '@/services/storageService';

export interface SetupState {
  terminals: Terminal[];
  loading: boolean;
  confirming: boolean;
  error: string | null;
  savedTerminalId: string | null;
}

export interface SetupActions {
  refresh: () => Promise<void>;
  selectTerminal: (terminal: Terminal) => Promise<void>;
  clearSaved: () => Promise<void>;
}

export function useSetup(): [SetupState, SetupActions] {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTerminalId, setSavedTerminalId] = useState<string | null>(null);

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
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar terminais');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectTerminal = useCallback(async (terminal: Terminal) => {
    setConfirming(true);
    setError(null);
    try {
      await saveTerminal(terminal.id, terminal.orientation, terminal.name);
      await setTerminalOnline(terminal.id);
      setSavedTerminalId(terminal.id);
    } catch (err: any) {
      setError(err.message || 'Erro ao selecionar terminal');
    } finally {
      setConfirming(false);
    }
  }, []);

  const clearSaved = useCallback(async () => {
    await clearTerminal();
    setSavedTerminalId(null);
  }, []);

  return [
    { terminals, loading, confirming, error, savedTerminalId },
    { refresh: loadData, selectTerminal, clearSaved },
  ];
}
