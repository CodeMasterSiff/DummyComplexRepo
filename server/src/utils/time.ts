const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const now = () => new Date();
export const iso = (d: Date) => d.toISOString();

export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * MIN);
export const addHours = (d: Date, h: number) => new Date(d.getTime() + h * HOUR);
export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY);

export const minutesUntil = (d: Date | string, from = now()) => (new Date(d).getTime() - from.getTime()) / MIN;
export const hoursUntil = (d: Date | string, from = now()) => minutesUntil(d, from) / 60;
export const daysSince = (d: Date | string, from = now()) => (from.getTime() - new Date(d).getTime()) / DAY;

export const dateKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

export function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// "09:30" on the given UTC day
export function atTime(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m));
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

export function ageOn(dateOfBirth: string, on: Date = now()) {
  const dob = new Date(dateOfBirth);
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}
