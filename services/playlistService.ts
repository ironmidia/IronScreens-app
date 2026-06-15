// Iron Screens — Playlist Service
import { supabase } from './supabase';
import { PlaylistItem, Media, MediaGroup, MediaGroupItem, Playlist } from './models';
import { isPlaylistScheduledNow } from './scheduleService';

const PLAYLIST_SCHEDULE_FIELDS =
  'id, priority, schedule_start, schedule_end, schedule_time_start, schedule_time_end, schedule_days';

/**
 * Retorna o ID da playlist de maior prioridade ativa para o terminal.
 * Playlists sem agendamento são sempre ativas (priority=0 = padrão).
 * Se nenhuma playlist estiver ativa, retorna null.
 */
export async function fetchActivePlaylistId(terminalId: string): Promise<string | null> {
  const { data: playlists, error } = await supabase
    .from('playlists')
    .select(PLAYLIST_SCHEDULE_FIELDS)
    .eq('terminal_id', terminalId)
    .order('priority', { ascending: false });

  if (error) {
    console.warn('[PlaylistService] Erro ao buscar playlists:', error.message);
    return null;
  }

  if (!playlists || playlists.length === 0) return null;

  for (const pl of playlists as Playlist[]) {
    if (isPlaylistScheduledNow(pl)) {
      console.log(`[PlaylistService] Playlist ativa: "${pl.id}" (priority=${pl.priority})`);
      return pl.id;
    }
  }

  console.log('[PlaylistService] Nenhuma playlist ativa no momento.');
  return null;
}

export async function fetchPlaylistItems(terminalId: string): Promise<PlaylistItem[]> {
  const activeId = await fetchActivePlaylistId(terminalId);

  if (!activeId) return [];

  // ✅ hybrid_slot incluído no SELECT
  const { data, error } = await supabase
    .from('playlist_items')
    .select('id, playlist_id, media_id, group_id, item_type, position, duration_sec, hybrid_slot')
    .eq('playlist_id', activeId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data as PlaylistItem[]) || [];
}

export async function fetchMedia(mediaId: string): Promise<Media | null> {
  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('id', mediaId)
    .single();

  if (error) return null;
  return data as Media;
}

export async function fetchMediaGroup(groupId: string): Promise<MediaGroup | null> {
  const { data, error } = await supabase
    .from('media_groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error) return null;
  return data as MediaGroup;
}

export async function fetchMediaGroupItems(groupId: string): Promise<MediaGroupItem[]> {
  const { data, error } = await supabase
    .from('media_group_items')
    .select(`
      id,
      group_id,
      media_id,
      position,
      media:media_id(*)
    `)
    .eq('group_id', groupId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data as MediaGroupItem[]) || [];
}

export async function fetchAllMediaForPlaylist(mediaIds: string[]): Promise<Record<string, Media>> {
  if (mediaIds.length === 0) return {};
  const { data, error } = await supabase
    .from('media')
    .select('*')
    .in('id', mediaIds);

  if (error) return {};
  const map: Record<string, Media> = {};
  (data as Media[]).forEach((m) => { map[m.id] = m; });
  return map;
}
