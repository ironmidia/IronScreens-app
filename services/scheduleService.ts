// Iron Screens — Schedule Filter Service
import { Media, Playlist } from './models';

const DAY_ABBREVS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function toMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Lógica genérica de agendamento — funciona para Media e Playlist.
 * Recebe um objeto com os campos de schedule opcionais.
 */
export function isScheduledNow(item: {
  schedule_start?: string | null;
  schedule_end?: string | null;
  schedule_time_start?: string | null;
  schedule_time_end?: string | null;
  schedule_days?: string[] | null;
}, label = 'item'): boolean {
  const now = new Date();
  const today = todayString();
  const dayAbbrev = DAY_ABBREVS[now.getDay()];

  if (item.schedule_start && today < item.schedule_start) {
    console.log(`[Schedule] "${label}" BLOQUEADO: hoje=${today} < start=${item.schedule_start}`);
    return false;
  }
  if (item.schedule_end && today > item.schedule_end) {
    console.log(`[Schedule] "${label}" BLOQUEADO: hoje=${today} > end=${item.schedule_end}`);
    return false;
  }

  const days = item.schedule_days ?? [];
  if (days.length > 0 && !days.includes(dayAbbrev)) {
    console.log(`[Schedule] "${label}" BLOQUEADO: dia=${dayAbbrev} não está em ${JSON.stringify(days)}`);
    return false;
  }

  if (item.schedule_time_start && item.schedule_time_end) {
    const startMin = toMinutes(item.schedule_time_start);
    const endMin   = toMinutes(item.schedule_time_end);
    if (startMin === endMin) return true;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (startMin < endMin) {
      if (nowMin < startMin || nowMin > endMin) {
        console.log(`[Schedule] "${label}" BLOQUEADO: hora=${nowMin}min fora de [${startMin}-${endMin}]`);
        return false;
      }
    } else {
      // janela noturna (ex: 22:00 → 02:00)
      if (nowMin < startMin && nowMin > endMin) {
        console.log(`[Schedule] "${label}" BLOQUEADO: hora=${nowMin}min fora de janela noturna [${startMin}-${endMin}]`);
        return false;
      }
    }
  }

  console.log(`[Schedule] "${label}" OK: hoje=${today} dia=${dayAbbrev}`);
  return true;
}

/** Compatibilidade retroativa — mantém API anterior para Media */
export function isScheduled(media: Media): boolean {
  return isScheduledNow(media, media.name);
}

/** Retorna true se a playlist estiver ativa agora (sem agendamento = sempre ativa) */
export function isPlaylistScheduledNow(playlist: Playlist): boolean {
  // Playlist sem nenhum agendamento definido = sempre ativa
  const hasSchedule =
    playlist.schedule_start ||
    playlist.schedule_end ||
    (playlist.schedule_days && playlist.schedule_days.length > 0) ||
    playlist.schedule_time_start;

  if (!hasSchedule) return true;
  return isScheduledNow(playlist, playlist.name ?? 'playlist');
}
