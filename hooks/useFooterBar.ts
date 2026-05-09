// Iron Screens — FooterBar Hook
import { useState, useEffect } from 'react';
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
    // Busca inicial com maybeSingle (não quebra se a tabela estiver vazia)
    supabase
      .from('footer_bar_settings')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setConfig(data as FooterBarConfig);
      });

    // Realtime — atualiza automaticamente quando admin muda no painél
    const channel = supabase
      .channel('footer_bar_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'footer_bar_settings' },
        (payload) => {
          if (payload.new && Object.keys(payload.new).length > 0) {
            setConfig(payload.new as FooterBarConfig);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return config?.enabled ? config : null;
}
