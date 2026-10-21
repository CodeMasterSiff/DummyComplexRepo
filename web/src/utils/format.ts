import type { AppointmentStatus, AppointmentType, Plan, ReviewReason, Specialty } from '../api/types';

export function formatMoney(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

// YYYY-MM-DD values are calendar dates, so render them in UTC to avoid an off-by-one day
export function formatCalendarDate(ymd: string): string {
  return new Date(`${ymd.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ageOn(dateOfBirth: string, on: Date = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = on.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export function humanize(code: string): string {
  const text = code.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  GP: 'General practice',
  PHYSIO: 'Physiotherapy',
  DERMATOLOGY: 'Dermatology',
  CARDIOLOGY: 'Cardiology',
};

export const TYPE_LABELS: Record<AppointmentType, string> = {
  FIRST_VISIT: 'First visit',
  FOLLOW_UP: 'Follow-up',
  TELEHEALTH: 'Video consultation',
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  HELD: 'On hold',
  PENDING_REVIEW: 'Awaiting review',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked in',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'Missed',
  EXPIRED: 'Expired',
};

export const PLAN_LABELS: Record<Plan, string> = {
  BASIC: 'Basic',
  PLUS: 'Plus',
  PREMIUM: 'Premium',
};

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  SPECIALIST_NO_REFERRAL: 'Specialist visit without a referral',
  INSURANCE_UNVERIFIED: 'Insurance could not be verified',
};

export const UPCOMING_STATUSES: AppointmentStatus[] = ['HELD', 'PENDING_REVIEW', 'CONFIRMED', 'CHECKED_IN'];
