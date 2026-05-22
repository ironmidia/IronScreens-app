// Iron Screens — Player Hook
import { useState, useEffect, useRef, useCallback } from "react";
import * as Network from "expo-network";
import { PlaybackItem, Media } from "@/services/models";
import {
  fetchPlaylistItems,
  fetchAllMediaForPlaylist,
  fetchMediaGroupItems,
  fetchMediaGroup,
} from "@/services/playlistService";
import { isScheduled } from "@/services/scheduleService";
import { logDisplayEvent } from "@/services/displayEventService";
import {
  setTerminalOnline,
  setTerminalOffline,
} from "@/services/terminalService";
import {
  saveGroupIndices,
  loadGroupIndices,
  savePlaylistCache,
  loadPlaylistCache,
} from "@/services/storageService";
import { supabase } from "@/services/supabase";
import {
  HEARTBEAT_INTERVAL_MS,
  PLAYLIST_POLL_INTERVAL_MS,
} from "@/constants/config";
import { syncPlaylistMediaCache } from "@/services/mediaCacheService";

export interface PlayerState {
  currentItem: PlaybackItem | null;
  currentIndex: number;
  playlist: PlaybackItem[];
  loading: boolean;
  error: string | null;
  hasNoScheduledMedia: boolean;
  isConnected: boolean;
  isOfflineCache: boolean;
}

export interface PlayerActions {
  advance: () => void;
  reload: () => Promise<void>;
}

function orientationMatch(
  mediaOrientation: string | null | undefined,
  terminalOrientation: string,
): boolean {
  if (!mediaOrientation) return true;
  return mediaOrientation === terminalOrientation;
}

async function isInternetAvailable(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return !!state.isConnected && !!state.isInternetReachable;
  } catch {
    return false;
  }
}

export function usePlayer(
  terminalId: string,
  terminalOrientation: string,
): [PlayerState, PlayerActions] {
  const [playlist, setPlaylist] = useState<PlaybackItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNoScheduledMedia, setHasNoScheduledMedia] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isOfflineCache, setIsOfflineCache] = useState(false);

  const groupIndicesRef = useRef<Record<string, number>>({});
  const playlistRef = useRef<PlaybackItem[]>([]);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const buildPlaylist = useCallback(async (): Promise<PlaybackItem[]> => {
    const rawItems = await fetchPlaylistItems(terminalId);

    if (!rawItems.length) {
      console.log(
        "[Player] Nenhum item de playlist para o terminal:",
        terminalId,
      );
      return [];
    }

    const directMediaIds = rawItems
      .filter((i) => i.item_type === "media" && i.media_id)
      .map((i) => i.media_id as string);

    const mediaMap = await fetchAllMediaForPlaylist(directMediaIds);
    const storedIndices = await loadGroupIndices();
    groupIndicesRef.current = storedIndices;

    const expanded: PlaybackItem[] = [];

    for (const item of rawItems) {
      if (item.item_type === "media" && item.media_id) {
        const media = mediaMap[item.media_id];
        if (!media) continue;
        if (!orientationMatch(media.orientation, terminalOrientation)) continue;
        if (!isScheduled(media)) continue;

        expanded.push({
          playlistItemId: item.id,
          media,
          durationSec: item.duration_sec,
          groupId: null,
        });
        continue;
      }

      if (item.item_type === "group" && item.group_id) {
        const [group, groupItems] = await Promise.all([
          fetchMediaGroup(item.group_id),
          fetchMediaGroupItems(item.group_id),
        ]);

        if (!group || !groupItems.length) continue;

        const currentGroupIndex = groupIndicesRef.current[item.group_id] ?? 0;

        const validItems = groupItems.filter(
          (gi) =>
            gi.media &&
            orientationMatch(
              (gi.media as Media).orientation,
              terminalOrientation,
            ) &&
            isScheduled(gi.media as Media),
        );

        if (!validItems.length) continue;

        let selectedItem: (typeof validItems)[number];

        if (group.rotation_mode === "random") {
          selectedItem =
            validItems[Math.floor(Math.random() * validItems.length)];
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

    console.log("[Player] Playlist final:", expanded.length, "itens");
    return expanded;
  }, [terminalId, terminalOrientation]);

  const hydrateWithLocalCache = useCallback(
    async (items: PlaybackItem[]): Promise<PlaybackItem[]> => {
      if (!items.length) return [];

      const localMap = await syncPlaylistMediaCache(
        items.map((item) => ({
          playlistItemId: item.playlistItemId,
          media: {
            id: item.media.id,
            type: item.media.type,
            file_url: item.media.file_url,
            updated_at: item.media.updated_at ?? null,
          },
        })),
      );

      return items.map((item) => {
        const key = `${item.playlistItemId}:${item.media.id}`;
        const localUri = localMap[key] || null;

        return {
          ...item,
          media: {
            ...item.media,
            local_file_url: localUri,
          },
        };
      });
    },
    [],
  );

  const applyPlaylistState = useCallback(
    (items: PlaybackItem[], offline: boolean) => {
      const previousCurrent =
        playlistRef.current[currentIndexRef.current] ?? null;

      setPlaylist(items);

      let nextIndex = 0;

      if (previousCurrent && items.length > 0) {
        const sameItemIndex = items.findIndex(
          (i) => i.playlistItemId === previousCurrent.playlistItemId,
        );

        if (sameItemIndex >= 0) {
          nextIndex = sameItemIndex;
        } else {
          nextIndex = Math.min(currentIndexRef.current, items.length - 1);
        }
      }

      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);

      setHasNoScheduledMedia(items.length === 0);
      setIsOfflineCache(offline);
      setError(null);
    },
    [],
  );

  const loadPlaylist = useCallback(
    async (isInitialLoad = false) => {
      if (!terminalId) return;

      if (isInitialLoad) setLoading(true);
      setError(null);

      try {
        const online = await isInternetAvailable();

        if (!online) {
          throw new Error("Sem internet para sincronizar.");
        }

        const built = await buildPlaylist();
        const hydrated = await hydrateWithLocalCache(built);

        await savePlaylistCache(terminalId, hydrated);

        applyPlaylistState(hydrated, false);
        setIsConnected(true);
      } catch (err: any) {
        console.warn("[Player] Falha ao carregar online:", err?.message);
        setIsConnected(false);

        const cached = await loadPlaylistCache(terminalId);

        if (cached.length > 0) {
          console.log("[Player] Usando cache offline:", cached.length, "itens");
          applyPlaylistState(cached, true);
        } else {
          setError(err?.message || "Sem conexão e sem cache disponível.");
          setIsOfflineCache(false);
        }
      } finally {
        if (isInitialLoad) setLoading(false);
      }
    },
    [terminalId, buildPlaylist, hydrateWithLocalCache, applyPlaylistState],
  );

  useEffect(() => {
    loadPlaylist(true);
  }, [loadPlaylist]);

  useEffect(() => {
    const heartbeat = setInterval(async () => {
      try {
        await setTerminalOnline(terminalId);
        setIsConnected(true);

        if (isOfflineCache) {
          loadPlaylist();
        }
      } catch {
        setIsConnected(false);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(heartbeat);
  }, [terminalId, isOfflineCache, loadPlaylist]);

  useEffect(() => {
    const poll = setInterval(() => {
      loadPlaylist();
    }, PLAYLIST_POLL_INTERVAL_MS);

    return () => clearInterval(poll);
  }, [loadPlaylist]);

  useEffect(() => {
    const channel = supabase
      .channel(`terminal_${terminalId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "playlist_items" },
        () => loadPlaylist(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "media" },
        () => loadPlaylist(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "media_group_items" },
        () => loadPlaylist(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "terminals",
          filter: `id=eq.${terminalId}`,
        },
        () => loadPlaylist(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [terminalId, loadPlaylist]);

  useEffect(() => {
    return () => {
      setTerminalOffline(terminalId).catch(() => {});
    };
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
    setHasNoScheduledMedia(!list.some((i) => isScheduled(i.media)));
  }, [terminalId]);

  const currentItem = (() => {
    const list = playlistRef.current.length ? playlistRef.current : playlist;
    if (!list.length) return null;
    return list[currentIndexRef.current] ?? list[0] ?? null;
  })();

  return [
    {
      currentItem,
      currentIndex,
      playlist,
      loading,
      error,
      hasNoScheduledMedia,
      isConnected,
      isOfflineCache,
    },
    {
      advance,
      reload: loadPlaylist,
    },
  ];
}
