import { useState, useEffect, useRef, useCallback } from "react";
import * as Network from "expo-network";
import { PlaybackItem, Media, MediaGroupItem } from "@/services/models";
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
  fetchTerminalOwnerDeviceId,
} from "@/services/terminalService";
import { getDeviceId } from "@/services/deviceService";
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
  cycleTick: number;
  loading: boolean;
  error: string | null;
  hasNoScheduledMedia: boolean;
  isConnected: boolean;
  isOfflineCache: boolean;
  hybridSlot1Item: PlaybackItem | null;
  hybridSlot2Item: PlaybackItem | null;
  /** true quando outro aparelho reivindicou este terminal (mesmo PIN usado em 2 telas) */
  isKicked: boolean;
}

export interface PlayerActions {
  advance: () => void;
  reload: () => Promise<void>;
}

function selectGroupItem(
  validItems: MediaGroupItem[],
  rotationMode: string,
  rotationIndex: number,
): MediaGroupItem | null {
  if (!validItems.length) return null;
  if (rotationMode === "random") {
    return validItems[Math.floor(Math.random() * validItems.length)];
  }
  return validItems[rotationIndex % validItems.length];
}

function orientationMatch(
  mediaOrientation: string | null | undefined,
  terminalOrientation: string,
): boolean {
  if (!mediaOrientation) return true;
  if (terminalOrientation === "hybrid") {
    return (
      mediaOrientation === "hybrid_slot_1" ||
      mediaOrientation === "hybrid_slot_2"
    );
  }
  return mediaOrientation === terminalOrientation;
}

async function isInternetAvailable(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    if (!state.isConnected) return false;
    if (state.isInternetReachable === false) return false;
    return true;
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

// ─── FIX: resolve o item atual a partir de um índice e lista, nunca retorna null
// se houver qualquer item válido na lista. Percorre circularmente a partir do
// índice fornecido até encontrar um item com isScheduled=true.
// Isso evita o frame de currentItem=null que causava a tela preta.
function resolveItem(
  list: PlaybackItem[],
  startIndex: number,
): PlaybackItem | null {
  if (!list.length) return null;
  for (let i = 0; i < list.length; i++) {
    const idx = (startIndex + i) % list.length;
    if (isScheduled(list[idx].media)) return list[idx];
  }
  return null;
}

export function usePlayer(
  terminalId: string,
  terminalOrientation: string,
): [PlayerState, PlayerActions] {
  const [playlist, setPlaylist] = useState<PlaybackItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackRevision, setPlaybackRevision] = useState(0);
  // ─── Incrementado a cada advance(), independente de índice/item mudarem.
  // Garante remount do MediaRenderer mesmo em playlists de 1 item só, onde
  // currentIndex/currentItem nunca mudam de valor entre ciclos (sem isso o
  // VideoRenderer nunca reiniciava o vídeo após o fim).
  const [cycleTick, setCycleTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasNoScheduledMedia, setHasNoScheduledMedia] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isOfflineCache, setIsOfflineCache] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const localDeviceIdRef = useRef<string | null>(null);

  // ─── FIX: currentItem agora é estado gerenciado, não calculado inline no render.
  // Isso garante que nunca haja um frame com null entre dois itens válidos.
  const [currentItem, setCurrentItem] = useState<PlaybackItem | null>(null);

  const [slot1Playlist, setSlot1Playlist] = useState<PlaybackItem[]>([]);
  const [slot2Playlist, setSlot2Playlist] = useState<PlaybackItem[]>([]);
  const [slot1Index, setSlot1Index] = useState(0);
  const [slot2Index, setSlot2Index] = useState(0);
  const [slot1Revision, setSlot1Revision] = useState(0);
  const [slot2Revision, setSlot2Revision] = useState(0);

  // ─── FIX: hybridSlot items também viram estado gerenciado pelo mesmo motivo
  const [hybridSlot1Item, setHybridSlot1Item] = useState<PlaybackItem | null>(null);
  const [hybridSlot2Item, setHybridSlot2Item] = useState<PlaybackItem | null>(null);

  const groupIndicesRef = useRef<Record<string, number>>({});
  const groupMetaRef = useRef<
    Record<string, { validItems: MediaGroupItem[]; rotationMode: string }>
  >({});
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

  // ─── FIX: sempre que playlist ou currentIndex mudam, recalcula currentItem
  // de forma síncrona para que o estado seja atualizado em batch junto com
  // setPlaylist/setCurrentIndex, sem abrir janela de null entre renders.
  useEffect(() => {
    if (terminalOrientation === "hybrid") return;
    const list = playlistRef.current;
    const item = resolveItem(list, currentIndexRef.current);
    setCurrentItem(item);
  }, [playlist, currentIndex, terminalOrientation]);

  // ─── FIX: recalcula hybrid items quando slots mudam
  useEffect(() => {
    if (terminalOrientation !== "hybrid") return;
    setHybridSlot1Item(resolveItem(slot1Ref.current, slot1IndexRef.current));
  }, [slot1Playlist, slot1Index, terminalOrientation]);

  useEffect(() => {
    if (terminalOrientation !== "hybrid") return;
    setHybridSlot2Item(resolveItem(slot2Ref.current, slot2IndexRef.current));
  }, [slot2Playlist, slot2Index, terminalOrientation]);

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
        if (!orientationMatch(media.orientation, terminalOrientation)) continue;
        if (!isScheduled(media)) continue;

        const hybridSlot: 1 | 2 | undefined =
          media.orientation === "hybrid_slot_1"
            ? 1
            : media.orientation === "hybrid_slot_2"
            ? 2
            : undefined;

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
            orientationMatch((gi.media as Media).orientation, terminalOrientation) &&
            isScheduled(gi.media as Media),
        );

        if (!validItems.length) continue;

        groupMetaRef.current[item.group_id] = {
          validItems,
          rotationMode: group.rotation_mode,
        };

        const selectedItem = selectGroupItem(
          validItems,
          group.rotation_mode,
          currentGroupIndex,
        );

        if (!selectedItem?.media) continue;

        const m = selectedItem.media as Media;
        const hybridSlot: 1 | 2 | undefined =
          m.orientation === "hybrid_slot_1"
            ? 1
            : m.orientation === "hybrid_slot_2"
            ? 2
            : undefined;

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
              (i) =>
                i.playlistItemId === slot1Ref.current[prev]?.playlistItemId,
            );
            const next = found >= 0 ? found : 0;
            slot1IndexRef.current = next;
            return next;
          });
          setSlot2Index((prev) => {
            const found = s2.findIndex(
              (i) =>
                i.playlistItemId === slot2Ref.current[prev]?.playlistItemId,
            );
            const next = found >= 0 ? found : 0;
            slot2IndexRef.current = next;
            return next;
          });
          setSlot1Revision((r) => r + 1);
          setSlot2Revision((r) => r + 1);
        } else {
          // ─── FIX: atualiza playlistRef ANTES de chamar setPlaylist para que
          // o useEffect de currentItem já leia a lista nova quando executar.
          playlistRef.current = items;
          setPlaylist(items);
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
          console.log("[Player] Playlist idêntica; ignorando reaplicacão de estado");
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
    getDeviceId().then((id) => { localDeviceIdRef.current = id; });
  }, []);

  useEffect(() => {
    const heartbeat = setInterval(async () => {
      try {
        await setTerminalOnline(terminalId);
        setIsConnected(true);
        if (isOfflineCache) loadPlaylist();

        // ─── Detecta se outro aparelho reivindicou este terminal (mesmo PIN
        // usado em duas telas). Sem isso os dois ficam brigando pelos mesmos
        // comandos remotos e heartbeats, travando a reprodução de ambos.
        const localId = localDeviceIdRef.current;
        if (localId) {
          const ownerId = await fetchTerminalOwnerDeviceId(terminalId);
          if (ownerId && ownerId !== localId) {
            setIsKicked(true);
          }
        }
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
    let workingList = list;

    if (current) {
      logDisplayEvent({
        media_id: current.media.id,
        terminal_id: terminalId,
        displayed_at: new Date().toISOString(),
        duration_sec: current.durationSec,
      });

      if (current.groupId) {
        const groupId = current.groupId;
        const nextGroupIndex = (groupIndicesRef.current[groupId] ?? 0) + 1;
        groupIndicesRef.current[groupId] = nextGroupIndex;
        saveGroupIndices(groupIndicesRef.current).catch(() => {});

        // ─── Reavalia localmente a mídia do grupo a cada volta do loop,
        // em vez de esperar o próximo rebuild (poll/realtime) para trocar.
        const meta = groupMetaRef.current[groupId];
        const selected = meta
          ? selectGroupItem(meta.validItems, meta.rotationMode, nextGroupIndex)
          : null;

        if (selected?.media) {
          const m = selected.media as Media;
          const hybridSlot: 1 | 2 | undefined =
            m.orientation === "hybrid_slot_1"
              ? 1
              : m.orientation === "hybrid_slot_2"
              ? 2
              : undefined;

          workingList = list.map((entry) =>
            entry.groupId === groupId
              ? { ...entry, media: m, hybridSlot }
              : entry,
          );
          playlistRef.current = workingList;
          setPlaylist(workingList);
        }
      }
    }

    const nextIndex = (currentIndexRef.current + 1) % workingList.length;

    // ─── FIX: resolve o próximo item ANTES de atualizar o estado.
    // Assim o setCurrentItem e setCurrentIndex disparam no mesmo batch
    // do React, sem nenhum frame intermediário com item=null.
    const nextItem = resolveItem(workingList, nextIndex);
    currentIndexRef.current = nextIndex;

    // Atualiza item e índice de forma síncrona no mesmo ciclo de render
    setCurrentItem(nextItem);
    setCurrentIndex(nextIndex);
    setCycleTick((t) => t + 1);
  }, [terminalId]);

  const advanceSlot1 = useCallback(() => {
    const list = slot1Ref.current;
    if (!list.length) return;
    const next = (slot1IndexRef.current + 1) % list.length;
    slot1IndexRef.current = next;
    // ─── FIX: atualiza o item do slot junto com o índice
    setHybridSlot1Item(resolveItem(list, next));
    setSlot1Index(next);
    setSlot1Revision((r) => r + 1);
  }, []);

  const advanceSlot2 = useCallback(() => {
    const list = slot2Ref.current;
    if (!list.length) return;
    const next = (slot2IndexRef.current + 1) % list.length;
    slot2IndexRef.current = next;
    // ─── FIX: atualiza o item do slot junto com o índice
    setHybridSlot2Item(resolveItem(list, next));
    setSlot2Index(next);
    setSlot2Revision((r) => r + 1);
  }, []);

  return [
    {
      currentItem,
      currentIndex,
      playlist,
      playbackRevision,
      cycleTick,
      loading,
      error,
      hasNoScheduledMedia,
      isConnected,
      isOfflineCache,
      hybridSlot1Item,
      hybridSlot2Item,
      isKicked,
    },
    {
      advance,
      reload: loadPlaylist,
      advanceSlot1,
      advanceSlot2,
    } as any,
  ];
}