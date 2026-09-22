import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(val: number, decimals = 0): string {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export interface TimeZoneOption {
  value: string;
  label: string;
  group?: string;
}

export const TIMEZONE_OPTIONS: TimeZoneOption[] = [
  { value: 'auto', label: 'Automática (detectada del dispositivo)' },
  { value: 'America/Mexico_City', label: '🇲🇽 Ciudad de México / Centro (GMT-6)' },
  { value: 'America/Monterrey', label: '🇲🇽 Monterrey (GMT-6)' },
  { value: 'America/Cancun', label: '🇲🇽 Cancún / Quintana Roo (GMT-5)' },
  { value: 'America/Tijuana', label: '🇲🇽 Tijuana / Baja California (GMT-8)' },
  { value: 'America/Hermosillo', label: '🇲🇽 Hermosillo / Sonora (GMT-7)' },
  { value: 'America/Mazatlan', label: '🇲🇽 Mazatlán / Sinaloa (GMT-7)' },
  { value: 'America/Chihuahua', label: '🇲🇽 Ciudad Juárez / Chihuahua (GMT-6)' },
  { value: 'America/Bogota', label: '🇨🇴 Bogotá / Colombia (GMT-5)' },
  { value: 'America/Lima', label: '🇵🇪 Lima / Perú (GMT-5)' },
  { value: 'America/Santiago', label: '🇨🇱 Santiago / Chile (GMT-4)' },
  { value: 'America/Argentina/Buenos_Aires', label: '🇦🇷 Buenos Aires / Argentina (GMT-3)' },
  { value: 'America/New_York', label: '🇺🇸 Nueva York / Este EE.UU. (GMT-5)' },
  { value: 'America/Chicago', label: '🇺🇸 Chicago / Central EE.UU. (GMT-6)' },
  { value: 'America/Denver', label: '🇺🇸 Denver / Montaña EE.UU. (GMT-7)' },
  { value: 'America/Los_Angeles', label: '🇺🇸 Los Ángeles / Pacífico EE.UU. (GMT-8)' },
  { value: 'Europe/Madrid', label: '🇪🇸 Madrid / España (GMT+1)' },
];

export function getSystemTimeZone(): string {
  try {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City';
    }
  } catch {
    // fallback
  }
  return 'America/Mexico_City';
}

export function getUserTimeZone(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('duo_calories_timezone');
      if (stored && stored !== 'auto') return stored;
    } catch {
      // fallback
    }
  }
  return getSystemTimeZone();
}

export function setUserTimeZone(tz: string): void {
  if (typeof window !== 'undefined') {
    try {
      if (tz === 'auto') {
        localStorage.removeItem('duo_calories_timezone');
      } else {
        localStorage.setItem('duo_calories_timezone', tz);
      }
      window.dispatchEvent(new CustomEvent('duo_calories_timezone_changed', { detail: tz }));
    } catch {
      // fallback
    }
  }
}

export function formatDateToYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateString(d: Date | string = new Date(), timeZone?: string): string {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return d;
  }
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const tz = timeZone || getUserTimeZone();
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(dateObj);
  } catch {
    return formatDateToYYYYMMDD(dateObj);
  }
}

export function shiftDateDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return formatDateToYYYYMMDD(date);
}

export function getWeekStartDate(d: Date | string = new Date()): string {
  const dateStr = getLocalDateString(d);
  const [y, m, dNum] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, dNum);
  const day = date.getDay();
  // Monday is 1, Sunday is 0
  const diff = dNum - day + (day === 0 ? -6 : 1);
  const monday = new Date(y, m - 1, diff);
  return formatDateToYYYYMMDD(monday);
}

export function getDayOfWeekName(dayIndex: number): string {
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  return days[dayIndex - 1] || 'Día';
}

export function getNextWeekStartDate(d: Date | string = new Date()): string {
  const mondayStr = getWeekStartDate(d);
  return shiftDateDays(mondayStr, 7);
}

export function getSmartMealPrepWeekStartDate(d = new Date()): string {
  const day = new Date(d).getDay();
  // On Friday (5), Saturday (6), or Sunday (0), meal prep targets next week
  if (day === 0 || day === 5 || day === 6) {
    return getNextWeekStartDate(d);
  }
  return getWeekStartDate(d);
}

export function formatWeekDateRange(mondayStr: string): string {
  const [y, m, d] = mondayStr.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} al ${end.getDate()} de ${monthNames[start.getMonth()]}`;
  }
  return `${start.getDate()} ${monthNames[start.getMonth()]} al ${end.getDate()} ${monthNames[end.getMonth()]}`;
}

