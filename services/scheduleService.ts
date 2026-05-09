// Iron Screens — Schedule Filter Service
import { Media } from './models';

// O banco salva os dias em formato abreviado: 'sun','mon','tue','wed','thu','fri','sat'
const DAY_ABBREVS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function toMinutes(timeStr: string): number {
  // timeStr format: "HH:MM:SS" ou "HH:MM"
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
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
  // Usa abreviação de 3 letras igual ao banco: 'sun','mon'...
  const dayAbbrev = DAY_ABBREVS[now.getDay()];

  // Verifica intervalo de datas
  if (media.schedule_start && today < media.schedule_start) {
    return false;
  }
  if (media.schedule_end && today > media.schedule_end) {
    return false;
  }

  // Verifica dias da semana
  if (media.schedule_days && media.schedule_days.length > 0) {
    if (!media.schedule_days.includes(dayAbbrev)) {
      return false;
    }
  }

  // Verifica janela de horário
  // Se start == end ou ambos ausentes, considera sem restrição de horário (exibe 24h)
  if (media.schedule_time_start && media.schedule_time_end) {
    const startMinutes = toMinutes(media.schedule_time_start);
    const endMinutes = toMinutes(media.schedule_time_end);

    // start == end => sem restrição (exibe o dia todo)
    if (startMinutes === endMinutes) {
      return true;
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (startMinutes < endMinutes) {
      // Janela normal: ex. 08:00 - 22:00
      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        return false;
      }
    } else {
      // Janela que cruza meia-noite: ex. 22:00 - 04:00
      if (currentMinutes < startMinutes && currentMinutes > endMinutes) {
        return false;
      }
    }
  }

  return true;
}
