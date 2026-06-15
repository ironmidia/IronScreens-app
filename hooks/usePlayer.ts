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
  playbackRevision: number;
  loading: boolean;
  error: string | null;
  hasNoScheduledMedia: boolean;
  isConnected: boolean;
  isOfflineCache: boolean;
  hybridSlot1Item: PlaybackItem | null;
  hybridSlot2Item: PlaybackItem | null;
}

export interface PlayerActions {
  advance: () => void;
  reload: () => Promise<void>;
}

/**
 * Resolve o slot híbrido de um item:
 * 1. Usa item.hybrid_slot se presente (campo da playlist_items — mais confiável)
 * 2. Fallback: deriva de media.orientation
 * 3. Se terminal não é híbrido ou nenhum dos dois definido: retorna undefined
 */
function resolveHybridSlot(
  itemHybridSlot: 1 | 2 | null | undefined,
  mediaOrientation: string | null | undefined,
  terminalOrientation: string,
): 1 | 2 | undefined {
  if (terminalOrientation !== "hybrid") return undefined;

  // Prioridade 1: campo hybrid_slot da playlist_items
  if (itemHybridSlot === 1 || itemHybridSlot === 2) return itemHybridSlot;

  // Prioridade 2: derivado de media.orientation
  if (mediaOrientation === "hybrid_slot_1") return 1;
  if (mediaOrientation === "hybrid_slot_2") return 2;

  return undefined;
}

/**
 * Verifica se um item é compatível com a orientação do terminal.
 * - Terminal híbrido: aceita mídias com hybrid_slot_1, hybrid_slot_2
 *   OU itens que tenham hybrid_slot definido na playlist_items.
 *   Rejeita mídias com orientation horizontal/vertical.
 * - Terminal horizontal/vertical: match exato ou null.
 */
function orientationMatch(
  mediaOrientation: string | null | undefined,
  terminalOrientation: string,
  itemHybridSlot?: 1 | 2 | null,
): boolean {
  if (terminalOrientation === "hybrid") {
    // Aceita se hybrid_slot está definido diretamente no item
    if (itemHybridSlot === 1 || itemHybridSlot === 2) return true;
    // Aceita se a mídia é explicitamente de slot híbrido
    if (mediaOrientation === "hybrid_slot_1" || mediaOrientation === "hybrid_slot_2") return true;
    // Aceita mídias sem orientação definida (null/undefined) — rende para ambos os slots via hybrid_slot
    if (!mediaOrientation) return true;
    // Rejeita mídias explicitamente horizontal ou vertical
    return false;
  }
  // Orientação normal: match exato ou null
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

function buildPlaylistSignature(items: PlaybackItem[]): string {
  return JSON.stringify(
    items.map((item) => [
      item.playlistItemId,
      item.media.id,
      item.media.updated_at ?? null,
      item.durationSec ?? null,
      item.groupId ?? null,
      item.media.local_file_url ?? null,
      item.hybridSlot ?? null,
    ]),
  );
}

export function usePlayer(
  terminalId: string,
  terminalOrientation: string,
): [PlayerState, PlayerActions] {
  const [playlist, setPlaylist] = useState<PlaybackItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNoScheduledMedia, setHasNoScheduledMedia] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isOfflineCache, setIsOfflineCache] = useState(false);

  const [slot1Playlist, setSlot1Playlist] = useState<PlaybackItem[]>([]);
  const [slot2Playlist, setSlot2Playlist] = useState<PlaybackItem[]>([]);
  const [slot1Index, setSlot1Index] = useState(0);
  const [slot2Index, setSlot2Index] = useState(0);
  const [slot1Revision, setSlot1Revision] = useState(0);
  const [slot2Revision, setSlot2Revision] = useState(0);

  const groupIndicesRef = useRef<Record<string, number>>({});
  const playlistRef = useRef<PlaybackItem[]>([]);
  const currentIndexRef = useRef(0);
  const playlistSignatureRef = useRef("");
  const loadInFlightRef = useRef(false);

  const slot1Ref = useRef<PlaybackItem[]>([]);
  const slot2Ref = useRef<PlaybackItem[]>([]);
  const slot1IndexRef = useRef(0);
  const slot2IndexRef = useRef(0);

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { slot1Ref.current = slot1Playlist; }, [slot1Playlist]);
  useEffect(() => { slot2Ref.current = slot2Playlist; }, [slot2Playlist]);
  useEffect(() => { slot1IndexRef.current = slot1Index; }, [slot1Index]);
  useEffect(() => { slot2IndexRef.current = slot2Index; }, [slot2Index]);

  const buildPlaylist = useCallback(async (): Promise<PlaybackItem[]> => {
    const rawItems = await fetchPlaylistItems(terminalId);

    if (!rawItems.length) {
      console.log("[Player] Nenhum item de playlist para o terminal:", terminalId);
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

        // ✅ Passa hybrid_slot do item para orientationMatch
        if (!orientationMatch(media.orientation, terminalOrientation, item.hybrid_slot)) continue;
        if (!isScheduled(media)) continue;

        // ✅ Resolve slot com prioridade: item.hybrid_slot > media.orientation
        const hybridSlot = resolveHybridSlot(item.hybrid_slot, media.orientation, terminalOrientation);

        console.log(
          `[Player] Item aceito: ${media.name} | orientation=${media.orientation} | item.hybrid_slot=${item.hybrid_slot} | resolvedSlot=${hybridSlot ?? 'N/A'}`,
        );

        expanded.push({
          playlistItemId: item.id,
          media,
          durationSec: item.duration_sec,
          groupId: null,
          hybridSlot,
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
            orientationMatch((gi.media as Media).orientation, terminalOrientation, item.hybrid_slot) &&
            isScheduled(gi.media as Media),
        );

        if (!validItems.length) continue;

        let selectedItem: (typeof validItems)[number];

        if (group.rotation_mode === "random") {
          selectedItem = validItems[Math.floor(Math.random() * validItems.length)];
        } else {
          selectedItem = validItems[currentGroupIndex % validItems.length];
        }

        if (!selectedItem?.media) continue;

        const m = selectedItem.media as Media;
        const hybridSlot = resolveHybridSlot(item.hybrid_slot, m.orientation, terminalOrientation);

        expanded.push({
          playlistItemId: item.id,
          media: m,
          durationSec: item.duration_sec,
          groupId: item.group_id,
          hybridSlot,
        });
      }
    }

    console.log("[Player] Playlist final:", expanded.length, "itens");
    if (terminalOrientation === "hybrid") {
      const s1 = expanded.filter((i) => i.hybridSlot === 1);
      const s2 = expanded.filter((i) => i.hybridSlot === 2);
      console.log(`[Player] Híbrido — Slot 1: ${s1.length} itens | Slot 2: ${s2.length} itens`);
    }
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
          media: { ...item.media, local_file_url: localUri },
        };
      });
    },
    [],
  );

  const applyPlaylistState = useCallback(
    (items: PlaybackItem[], offline: boolean, changed: boolean) => {
      if (changed) {
        if (terminalOrientation === "hybrid") {
          const s1 = items.filter((i) => i.hybridSlot === 1);
          const s2 = items.filter((i) => i.hybridSlot === 2);
          setSlot1Playlist(s1);
          setSlot2Playlist(s2);
          slot1Ref.current = s1;
          slot2Ref.current = s2;
          setSlot1Index((prev) => {
            const found = s1.findIndex(
              (i) => i.playlistItemId === slot1Ref.current[prev]?.playlistItemId,
            );
            const next = found >= 0 ? found : 0;
            slot1IndexRef.current = next;
            return next;
          });
          setSlot2Index((prev) => {
            const found = s2.findIndex(
              (i) => i.playlistItemId === slot2Ref.current[prev]?.playlistItemId,
            );
            const next = found >= 0 ? found : 0;
            slot2IndexRef.current = next;
            return next;
          });
          setSlot1Revision((r) => r + 1);
          setSlot2Revision((r) => r + 1);
        } else {
          setPlaylist(items);
          playlistRef.current = items;
          setCurrentIndex((prev) => {
            const prevItem = playlistRef.current[prev];
            if (!prevItem) { currentIndexRef.current = 0; return 0; }
            const foundIndex = items.findIndex(
              (item) =>
                item.playlistItemId === prevItem.playlistItemId &&
                item.media.id === prevItem.media.id,
            );
            const next = foundIndex >= 0 ? foundIndex : 0;
            currentIndexRef.current = next;
            return next;
          });
          setPlaybackRevision((rev) => rev + 1);
        }
      }

      setHasNoScheduledMedia(!items.some((i) => isScheduled(i.media)));
      setIsOfflineCache(offline);
      setError(null);
    },
    [terminalOrientation],
  );

  const loadPlaylist = useCallback(
    async (isInitialLoad = false) => {
      if (!terminalId) return;
      if (loadInFlightRef.current) return;

      loadInFlightRef.current = true;

      if (isInitialLoad) setLoading(true);
      setError(null);

      try {
        const online = await isInternetAvailable();
        if (!online) throw new Error("Sem internet para sincronizar.");

        const built = await buildPlaylist();
        const hydrated = await hydrateWithLocalCache(built);

        await savePlaylistCache(terminalId, hydrated);

        const nextSignature = buildPlaylistSignature(hydrated);
        const changed = nextSignature !== playlistSignatureRef.current;

        if (changed) {
          playlistSignatureRef.current = nextSignature;
          console.log("[Player] Mudança real na playlist detectada; aplicando estado");
        } else {
          console.log("[Player] Playlist idêntica; ignorando reaplicação de estado");
        }

        applyPlaylistState(hydrated, false, changed);
        setIsConnected(true);
      } catch (err: any) {
        console.warn("[Player] Falha ao carregar online:", err?.message);
        setIsConnected(false);

        const cached = await loadPlaylistCache(terminalId);

        if (cached.length > 0) {
          console.log("[Player] Usando cache offline:", cached.length, "itens");
          const nextSignature = buildPlaylistSignature(cached);
          const changed = nextSignature !== playlistSignatureRef.current;
          if (changed) playlistSignatureRef.current = nextSignature;
          applyPlaylistState(cached, true, changed);
        } else {
          setError(err?.message || "Sem conexão e sem cache disponível.");
          setIsOfflineCache(false);
        }
      } finally {
        loadInFlightRef.current = false;
        if (isInitialLoad) setLoading(false);
      }
    },
    [terminalId, buildPlaylist, hydrateWithLocalCache, applyPlaylistState],
  );

  useEffect(() => { loadPlaylist(true); }, [loadPlaylist]);

  useEffect(() => {
    const heartbeat = setInterval(async () => {
      try {
        await setTerminalOnline(terminalId);
        setIsConnected(true);
        if (isOfflineCache) loadPlaylist();
      } catch {
        setIsConnected(false);
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(heartbeat);
  }, [terminalId, isOfflineCache, loadPlaylist]);

  useEffect(() => {
    const poll = setInterval(() => { loadPlaylist(); }, PLAYLIST_POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [loadPlaylist]);

  useEffect(() => {
    const channel = supabase
      .channel(`terminal_${terminalId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "playlist_items" }, () => loadPlaylist())
      .on("postgres_changes", { event: "*", schema: "public", table: "media" }, () => loadPlaylist())
      .on("postgres_changes", { event: "*", schema: "public", table: "media_group_items" }, () => loadPlaylist())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "terminals", filter: `id=eq.${terminalId}` }, () => loadPlaylist())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [terminalId, loadPlaylist]);

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
    setHasNoScheduledMedia(!list.some((i) => isScheduled(i.media)));
  }, [terminalId]);

  const advanceSlot1 = useCallback(() => {
    const list = slot1Ref.current;
    if (!list.length) return;
    const next = (slot1IndexRef.current + 1) % list.length;
    slot1IndexRef.current = next;
    setSlot1Index(next);
    setSlot1Revision((r) => r + 1);
  }, []);

  const advanceSlot2 = useCallback(() => {
    const list = slot2Ref.current;
    if (!list.length) return;
    const next = (slot2IndexRef.current + 1) % list.length;
    slot2IndexRef.current = next;
    setSlot2Index(next);
    setSlot2Revision((r) => r + 1);
  }, []);

  const currentItem = (() => {
    if (terminalOrientation === "hybrid") return null;
    const list = playlistRef.current.length ? playlistRef.current : playlist;
    if (!list.length) return null;
    for (let i = 0; i < list.length; i++) {
      const idx = (currentIndexRef.current + i) % list.length;
      if (isScheduled(list[idx].media)) return list[idx];
    }
    return null;
  })();

  const hybridSlot1Item = (() => {
    if (terminalOrientation !== "hybrid") return null;
    const list = slot1Ref.current.length ? slot1Ref.current : slot1Playlist;
    if (!list.length) return null;
    for (let i = 0; i < list.length; i++) {
      const idx = (slot1IndexRef.current + i) % list.length;
      if (isScheduled(list[idx].media)) return list[idx];
    }
    return null;
  })();

  const hybridSlot2Item = (() => {
    if (terminalOrientation !== "hybrid") return null;
    const list = slot2Ref.current.length ? slot2Ref.current : slot2Playlist;
    if (!list.length) return null;
    for (let i = 0; i < list.length; i++) {
      const idx = (slot2IndexRef.current + i) % list.length;
      if (isScheduled(list[idx].media)) return list[idx];
    }
    return null;
  })();

  return [
    {
      currentItem,
      currentIndex,
      playlist,
      playbackRevision,
      loading,
      error,
      hasNoScheduledMedia,
      isConnected,
      isOfflineCache,
      hybridSlot1Item,
      hybridSlot2Item,
    },
    {
      advance,
      reload: loadPlaylist,
      advanceSlot1,
      advanceSlot2,
    } as any,
  ];
}
