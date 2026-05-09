// Iron Screens — Playlist Service
import { supabase } from './supabase';
import { PlaylistItem, Media, MediaGroup, MediaGroupItem } from './models';

export async function fetchPlaylistItems(terminalId: string): Promise<PlaylistItem[]> {
  // First get playlist IDs for this terminal
  const { data: playlists, error: plErr } = await supabase
    .from('playlists')
    .select('id')
    .eq('terminal_id', terminalId);

  if (plErr) throw plErr;
  if (!playlists || playlists.length === 0) return [];

  const playlistIds = playlists.map((p: any) => p.id);

  const { data, error } = await supabase
    .from('playlist_items')
    .select('id, playlist_id, media_id, group_id, item_type, position, duration_sec')
    .in('playlist_id', playlistIds)
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
