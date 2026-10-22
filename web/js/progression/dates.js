/** Local calendar day as "YYYY-MM-DD" (the player's own midnight, not UTC). */
export function dateKey(date = new Date()) {
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days from key `a` to key `b` (positive when b is later). */
export function daysBetween(a, b) {
  const toUtc = (key) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export function addDays(key, days) {
  const [year, month, day] = key.split('-').map(Number);
  return dateKey(new Date(year, month - 1, day + days));
}
