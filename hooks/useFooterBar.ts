// Iron Screens — FooterBar Hook
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/services/supabase';

export interface FooterBarConfig {
  id: string;
  enabled: boolean;
  text: string;
  mode: 'scroll' | 'fixed';
  bg_color: string;
  text_color: string;
  show_datetime: boolean;
  logo_url: string | null;
}

export function useFooterBar(): FooterBarConfig | null {
  const [config, setConfig] = useState<FooterBarConfig | null>(null);

  useEffect(() => {
    // Busca inicial
    supabase
      .from('footer_bar_settings')
      .select('*')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setConfig(data as FooterBarConfig);
      });

    // Realtime — atualiza automaticamente quando admin muda no painel
    const channel = supabase
      .channel('footer_bar_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'footer_bar_settings' },
        (payload) => {
          if (payload.new) setConfig(payload.new as FooterBarConfig);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return config?.enabled ? config : null;
}
