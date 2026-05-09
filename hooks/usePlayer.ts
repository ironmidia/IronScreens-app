// Iron Screens — Player Hook (Playlist Logic)
import { useState, useEffect, useRef, useCallback } from 'react';
import { PlaybackItem, Media, MediaGroup } from '@/services/models';
import { fetchPlaylistItems, fetchAllMediaForPlaylist, fetchMediaGroupItems, fetchMediaGroup } from '@/services/playlistService';
import { isScheduled } from '@/services/scheduleService';
import { logDisplayEvent } from '@/services/displayEventService';
import { setTerminalOnline, setTerminalOffline } from '@/services/terminalService';
import { saveGroupIndices, loadGroupIndices } from '@/services/storageService';
import { supabase } from '@/services/supabase';
import { HEARTBEAT_INTERVAL_MS } from '@/constants/config';

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

  // Keep refs in sync
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const buildPlaylist = useCallback(async (): Promise<PlaybackItem[]> => {
    const rawItems = await fetchPlaylistItems(terminalId);
    if (!rawItems.length) return [];

    // Collect all direct media IDs
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
        // Filter by orientation
        if (media.orientation !== terminalOrientation) continue;
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

        // Pick one media from the group based on rotation mode and current index
        const currentGroupIndex = groupIndicesRef.current[item.group_id] ?? 0;
        let selectedItem: typeof groupItems[0] | undefined;

        const validItems = groupItems.filter(
          (gi) => gi.media && gi.media.orientation === terminalOrientation
        );
        if (!validItems.length) continue;

        if (group.rotation_mode === 'random') {
          selectedItem = validItems[Math.floor(Math.random() * validItems.length)];
        } else {
          // sequential / round_robin
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

  const loadPlaylist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await buildPlaylist();
      setPlaylist(items);
      setCurrentIndex(0);
      const anyScheduled = items.some((i) => isScheduled(i.media));
      setHasNoScheduledMedia(!anyScheduled);
      setIsConnected(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar playlist');
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [buildPlaylist]);

  // Initial load
  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  // Heartbeat — keep terminal online
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`terminal_${terminalId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlist_items' },
        () => { loadPlaylist(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'media' },
        () => { loadPlaylist(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'terminals', filter: `id=eq.${terminalId}` },
        () => { loadPlaylist(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [terminalId, loadPlaylist]);

  // Cleanup on unmount — set offline
  useEffect(() => {
    return () => {
      setTerminalOffline(terminalId).catch(() => {});
    };
  }, [terminalId]);

  // Get the currently scheduled item, searching forward from currentIndex
  const getScheduledItem = useCallback((): PlaybackItem | null => {
    const list = playlistRef.current;
    if (!list.length) return null;

    // Try up to list.length times to find a scheduled item
    for (let i = 0; i < list.length; i++) {
      const idx = (currentIndexRef.current + i) % list.length;
      if (isScheduled(list[idx].media)) {
        return list[idx];
      }
    }
    return null;
  }, []);

  const advance = useCallback(async () => {
    const list = playlistRef.current;
    if (!list.length) return;

    const current = list[currentIndexRef.current];

    // Log display event for the item we just showed
    if (current) {
      logDisplayEvent({
        media_id: current.media.id,
        terminal_id: terminalId,
        displayed_at: new Date().toISOString(),
        duration_sec: current.durationSec,
      });

      // Advance group index if from a group
      if (current.groupId) {
        const prevIdx = groupIndicesRef.current[current.groupId] ?? 0;
        groupIndicesRef.current[current.groupId] = prevIdx + 1;
        saveGroupIndices(groupIndicesRef.current).catch(() => {});
      }
    }

    const nextIndex = (currentIndexRef.current + 1) % list.length;
    setCurrentIndex(nextIndex);
    currentIndexRef.current = nextIndex;

    // Check if any upcoming media is scheduled
    const anyScheduled = list.some((i) => isScheduled(i.media));
    setHasNoScheduledMedia(!anyScheduled);
  }, [terminalId]);

  // Compute the current scheduled item
  const currentItem = (() => {
    if (!playlist.length) return null;
    // Find next scheduled item from currentIndex
    for (let i = 0; i < playlist.length; i++) {
      const idx = (currentIndex + i) % playlist.length;
      if (isScheduled(playlist[idx].media)) return playlist[idx];
    }
    return null;
  })();

  return [
    { currentItem, currentIndex, playlist, loading, error, hasNoScheduledMedia, isConnected },
    { advance, reload: loadPlaylist },
  ];
}
