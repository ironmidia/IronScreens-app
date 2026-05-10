// Iron Screens — Player Hook (Playlist Logic)
import { useState, useEffect, useRef, useCallback } from 'react';
import { PlaybackItem, Media, MediaGroup } from '@/services/models';
import { fetchPlaylistItems, fetchAllMediaForPlaylist, fetchMediaGroupItems, fetchMediaGroup } from '@/services/playlistService';
import { isScheduled } from '@/services/scheduleService';
import { logDisplayEvent } from '@/services/displayEventService';
import { setTerminalOnline, setTerminalOffline } from '@/services/terminalService';
import { saveGroupIndices, loadGroupIndices } from '@/services/storageService';
import { supabase } from '@/services/supabase';
import { HEARTBEAT_INTERVAL_MS, PLAYLIST_POLL_INTERVAL_MS } from '@/constants/config';

export interface PlayerState {
  currentItem: PlaybackItem | null;
  currentIndex: number;
  playlist: PlaybackItem[];
  loading: boolean;
  error: string | null;
  hasNoScheduledMedia: boolean;
  isConnected: boolean;
}

export interface PlayerActions {
  advance: () => void;
  reload: () => Promise<void>;
}

function orientationMatch(
  mediaOrientation: string | null | undefined,
  terminalOrientation: string
): boolean {
  if (!mediaOrientation) return true;
  return mediaOrientation === terminalOrientation;
}

export function usePlayer(terminalId: string, terminalOrientation: string): [PlayerState, PlayerActions] {
  const [playlist, setPlaylist] = useState<PlaybackItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNoScheduledMedia, setHasNoScheduledMedia] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  const groupIndicesRef = useRef<Record<string, number>>({});
  const playlistRef = useRef<PlaybackItem[]>([]);
  const currentIndexRef = useRef(0);

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const buildPlaylist = useCallback(async (): Promise<PlaybackItem[]> => {
    const rawItems = await fetchPlaylistItems(terminalId);
    if (!rawItems.length) return [];

    const directMediaIds = rawItems
      .filter((i) => i.item_type === 'media' && i.media_id)
      .map((i) => i.media_id as string);

    const mediaMap = await fetchAllMediaForPlaylist(directMediaIds);
    const storedIndices = await loadGroupIndices();
    groupIndicesRef.current = storedIndices;

    const expanded: PlaybackItem[] = [];

    for (const item of rawItems) {
      if (item.item_type === 'media' && item.media_id) {
        const media = mediaMap[item.media_id];
        if (!media) continue;
        if (!orientationMatch(media.orientation, terminalOrientation)) continue;
        expanded.push({
          playlistItemId: item.id,
          media,
          durationSec: item.duration_sec,
          groupId: null,
        });
      } else if (item.item_type === 'group' && item.group_id) {
        const [group, groupItems] = await Promise.all([
          fetchMediaGroup(item.group_id),
          fetchMediaGroupItems(item.group_id),
        ]);
        if (!group || !groupItems.length) continue;

        const currentGroupIndex = groupIndicesRef.current[item.group_id] ?? 0;
        let selectedItem: typeof groupItems[0] | undefined;

        const validItems = groupItems.filter(
          (gi) => gi.media && orientationMatch((gi.media as any).orientation, terminalOrientation)
        );
        if (!validItems.length) continue;

        if (group.rotation_mode === 'random') {
          selectedItem = validItems[Math.floor(Math.random() * validItems.length)];
        } else {
          selectedItem = validItems[currentGroupIndex % validItems.length];
        }

        if (!selectedItem?.media) continue;

        expanded.push({
          playlistItemId: item.id,
          media: selectedItem.media as Media,
          durationSec: item.duration_sec,
          groupId: item.group_id,
        });
      }
    }

    return expanded;
  }, [terminalId, terminalOrientation]);

  // Carregamento inicial
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await buildPlaylist();
        setPlaylist(items);
        setCurrentIndex(0);
        currentIndexRef.current = 0;
        const anyScheduled = items.some((i) => isScheduled(i.media));
        setHasNoScheduledMedia(!anyScheduled);
        setIsConnected(true);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar playlist');
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId, terminalOrientation]);

  // loadPlaylist — mantém índice atual (usado por realtime, polling e reload manual)
  const loadPlaylist = useCallback(async () => {
    setError(null);
    try {
      const items = await buildPlaylist();
      setPlaylist(items);
      setCurrentIndex((prev) => {
        const nextIdx = prev < items.length ? prev : 0;
        currentIndexRef.current = nextIdx;
        return nextIdx;
      });
      const anyScheduled = items.some((i) => isScheduled(i.media));
      setHasNoScheduledMedia(!anyScheduled);
      setIsConnected(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar playlist');
      setIsConnected(false);
    }
  }, [buildPlaylist]);

  // Heartbeat — mantém terminal online
  useEffect(() => {
    const heartbeat = setInterval(async () => {
      try {
        await setTerminalOnline(terminalId);
        setIsConnected(true);
      } catch {
        setIsConnected(false);
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(heartbeat);
  }, [terminalId]);

  // Polling periódico de playlist — garante sincronização mesmo se o Realtime falhar
  useEffect(() => {
    const poll = setInterval(() => { loadPlaylist(); }, PLAYLIST_POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [loadPlaylist]);

  // Realtime subscription — recarrega playlist em alterações
  useEffect(() => {
    const channel = supabase
      .channel(`terminal_${terminalId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist_items' }, () => { loadPlaylist(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media' }, () => { loadPlaylist(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'media_group_items' }, () => { loadPlaylist(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'terminals', filter: `id=eq.${terminalId}` }, () => { loadPlaylist(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [terminalId, loadPlaylist]);

  // Cleanup ao desmontar — marca offline
  useEffect(() => {
    return () => { setTerminalOffline(terminalId).catch(() => {}); };
  }, [terminalId]);

  const advance = useCallback(async () => {
    const list = playlistRef.current;
    if (!list.length) return;

    const current = list[currentIndexRef.current];

    if (current) {
      logDisplayEvent({
        media_id: current.media.id,
        terminal_id: terminalId,
        displayed_at: new Date().toISOString(),
        duration_sec: current.durationSec,
      });

      if (current.groupId) {
        const prevIdx = groupIndicesRef.current[current.groupId] ?? 0;
        groupIndicesRef.current[current.groupId] = prevIdx + 1;
        saveGroupIndices(groupIndicesRef.current).catch(() => {});
      }
    }

    const nextIndex = (currentIndexRef.current + 1) % list.length;
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);

    const anyScheduled = list.some((i) => isScheduled(i.media));
    setHasNoScheduledMedia(!anyScheduled);
  }, [terminalId]);

  const currentItem = (() => {
    const list = playlistRef.current.length ? playlistRef.current : playlist;
    if (!list.length) return null;
    for (let i = 0; i < list.length; i++) {
      const idx = (currentIndexRef.current + i) % list.length;
      if (isScheduled(list[idx].media)) return list[idx];
    }
    return null;
  })();

  return [
    { currentItem, currentIndex, playlist, loading, error, hasNoScheduledMedia, isConnected },
    { advance, reload: loadPlaylist },
  ];
}
