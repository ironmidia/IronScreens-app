// Iron Screens — Schedule Filter Service
import { Media } from './models';

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

export function isScheduled(media: Media): boolean {
  const now = new Date();
  const today = todayString();
  const dayAbbrev = DAY_ABBREVS[now.getDay()];

  if (media.schedule_start && today < media.schedule_start) return false;
  if (media.schedule_end && today > media.schedule_end) return false;

  // Protção: schedule_days pode vir como null do banco (não apenas [])
  const days = media.schedule_days ?? [];
  if (days.length > 0 && !days.includes(dayAbbrev)) return false;

  if (media.schedule_time_start && media.schedule_time_end) {
    const startMin = toMinutes(media.schedule_time_start);
    const endMin   = toMinutes(media.schedule_time_end);
    if (startMin === endMin) return true; // sem restrição
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (startMin < endMin) {
      if (nowMin < startMin || nowMin > endMin) return false;
    } else {
      // Janela passa pela meia-noite
      if (nowMin < startMin && nowMin > endMin) return false;
    }
  }

  return true;
}
