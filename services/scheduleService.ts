// Iron Screens — Schedule Filter Service
import { Media } from './models';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function toMinutes(timeStr: string): number {
  // timeStr format: "HH:MM:SS" or "HH:MM"
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

function dateStringToComparable(dateStr: string): string {
  // dateStr: "YYYY-MM-DD" — directly comparable
  return dateStr;
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
  const dayName = DAY_NAMES[now.getDay()];

  // Check date range
  if (media.schedule_start && today < dateStringToComparable(media.schedule_start)) {
    return false;
  }
  if (media.schedule_end && today > dateStringToComparable(media.schedule_end)) {
    return false;
  }

  // Check days of week
  if (media.schedule_days && media.schedule_days.length > 0) {
    if (!media.schedule_days.includes(dayName)) {
      return false;
    }
  }

  // Check time range
  if (media.schedule_time_start && media.schedule_time_end) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = toMinutes(media.schedule_time_start);
    const endMinutes = toMinutes(media.schedule_time_end);

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return false;
    }
  }

  return true;
}
