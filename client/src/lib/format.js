// Server timestamps are UTC "YYYY-MM-DD HH:MM:SS".
export const toDate = (s) => {
  if (s instanceof Date) return s;
  const str = String(s);
  return new Date(str.includes('T') || str.endsWith('Z') ? str : str.replace(' ', 'T') + 'Z');
};

export function timeAgo(s) {
  const d = toDate(s);
  const sec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 2) return 'Yesterday';
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const clock = (s) => toDate(s).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function chatStamp(s) {
  const d = toDate(s);
  if (d.toDateString() === new Date().toDateString()) return clock(s);
  return timeAgo(s);
}

export function dayLabel(s) {
  const d = toDate(s);
  const t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

// Activity dates are local "YYYY-MM-DD".
export function eventDate(date) {
  if (!date) return '';
  const d = new Date(`${date}T00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: Math.abs(diff) > 300 ? 'numeric' : undefined });
}

export const eventTime = (time) => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}K` : String(n));
