// Iron Screens — Data Models

export interface Terminal {
  id: string;
  name: string;
  type: 'tv_horizontal' | 'tv_vertical' | 'led_panel';
  orientation: 'horizontal' | 'vertical' | 'hybrid';
  status: 'online' | 'offline';
  device_id: string | null;
  client: string | null;
  location: string | null;
  setup_pin: string | null;
  last_heartbeat: string | null;
  pending_command: string | null;
  command_payload: Record<string, unknown> | null;
  command_sent_at: string | null;
  last_screenshot_url: string | null;
  last_screenshot_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Media {
  id: string;
  name: string;
  type: 'video' | 'image' | 'youtube' | 'external_link' | 'instagram' | 'programmatic';
  orientation: 'horizontal' | 'vertical' | 'hybrid_slot_1' | 'hybrid_slot_2';
  company: string | null;
  category: string | null;
  file_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  schedule_start: string | null;
  schedule_end: string | null;
  schedule_time_start: string | null;
  schedule_time_end: string | null;
  schedule_days: string[];
  created_at: string;
  updated_at?: string | null;
  local_file_url?: string | null;
}

export interface MediaGroup {
  id: string;
  name: string;
  description: string | null;
  rotation_mode: 'sequential' | 'round_robin' | 'random';
  created_at: string;
}

export interface MediaGroupItem {
  id: string;
  group_id: string;
  media_id: string;
  position: number;
  media?: Media;
}

export interface Playlist {
  id: string;
  terminal_id: string;
  name: string;
  created_at: string;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  media_id: string | null;
  group_id: string | null;
  item_type: 'media' | 'group';
  position: number;
  duration_sec: number;
}

export interface DisplayEvent {
  id?: string;
  media_id: string;
  terminal_id: string;
  displayed_at: string;
  duration_sec: number;
}

export interface PlaybackItem {
  playlistItemId: string;
  media: Media;
  durationSec: number;
  groupId: string | null;
  hybridSlot?: 1 | 2;
}
