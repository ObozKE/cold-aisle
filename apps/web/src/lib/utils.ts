export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Formats a Date or ISO string in Africa/Nairobi (EAT, UTC+3)
 */
export function formatEAT(dateInput?: string | Date | null): string {
  if (!dateInput) return '--:--:-- EAT';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '--:--:-- EAT';

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Nairobi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d) + ' EAT';
  } catch {
    return '--:--:-- EAT';
  }
}

/**
 * Full date + time formatted in Africa/Nairobi
 */
export function formatEATDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '—';

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Nairobi',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d) + ' EAT';
  } catch {
    return '—';
  }
}
