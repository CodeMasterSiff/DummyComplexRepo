import { db, all, getPractitioner } from '../db/store';
import { config } from '../config';
import { BLOCKING_STATUSES } from '../domain/appointmentStates';
import { AppointmentType, Practitioner, Specialty } from '../domain/types';
import { badRequest, conflict, notFound } from '../domain/errors';
import { addDays, addMinutes, atTime, dateKey, minutesUntil, now, overlaps, startOfDayUTC } from '../utils/time';

const SLOT_MINUTES: Record<AppointmentType, number> = {
  FIRST_VISIT: 30,
  FOLLOW_UP: 15,
  TELEHEALTH: 20,
};

export function slotLength(specialty: Specialty, type: AppointmentType) {
  if (specialty === 'PHYSIO') return 45;
  return SLOT_MINUTES[type];
}

function leadMinutes(type: AppointmentType) {
  return type === 'TELEHEALTH' ? config.telehealthMinLeadMinutes : config.minLeadMinutes;
}

function isClosed(practitionerId: string, day: Date) {
  const key = dateKey(day);
  return all(db.closures).some((c) => c.date === key && (!c.practitionerId || c.practitionerId === practitionerId));
}

function busyIntervals(practitionerId: string, ignoreAppointmentId?: string) {
  return all(db.appointments)
    .filter(
      (a) => a.practitionerId === practitionerId && a.id !== ignoreAppointmentId && BLOCKING_STATUSES.includes(a.status),
    )
    .map((a) => [new Date(a.start), new Date(a.end)] as const);
}

export function isSlotFree(practitionerId: string, start: Date, end: Date, ignoreAppointmentId?: string) {
  return !busyIntervals(practitionerId, ignoreAppointmentId).some(([s, e]) => overlaps(start, end, s, e));
}

export function listSlots(practitionerId: string, type: AppointmentType, from: Date, to: Date) {
  const pr = getPractitioner(practitionerId);
  if (!pr) throw notFound('Practitioner');
  if (type === 'TELEHEALTH' && !pr.offersTelehealth) return [];

  const len = slotLength(pr.specialty, type);
  const horizon = addDays(now(), config.bookingHorizonDays);
  const busy = busyIntervals(pr.id);
  const slots: { start: string; end: string }[] = [];

  for (let day = startOfDayUTC(from); day <= to && day <= horizon; day = addDays(day, 1)) {
    const hours = pr.weeklyHours[day.getUTCDay()];
    if (!hours || isClosed(pr.id, day)) continue;
    const dayEnd = atTime(day, hours.end);

    for (let s = atTime(day, hours.start); addMinutes(s, len) <= dayEnd; s = addMinutes(s, len)) {
      const e = addMinutes(s, len);
      if (s > horizon) break;
      if (minutesUntil(s) < leadMinutes(type)) continue;
      if (hours.breakStart && hours.breakEnd && overlaps(s, e, atTime(day, hours.breakStart), atTime(day, hours.breakEnd))) {
        continue;
      }
      if (busy.some(([bs, be]) => overlaps(s, e, bs, be))) continue;
      slots.push({ start: s.toISOString(), end: e.toISOString() });
    }
  }
  return slots;
}

export function firstAvailable(specialty: Specialty, type: AppointmentType) {
  const practitioners = all(db.practitioners).filter(
    (p) => p.specialty === specialty && (type !== 'TELEHEALTH' || p.offersTelehealth),
  );
  let best: { practitionerId: string; start: string; end: string } | null = null;

  for (const pr of practitioners) {
    // a week at a time so we don't build 60 days of slots for everyone
    for (let w = 0; w * 7 < config.bookingHorizonDays; w++) {
      const from = addDays(now(), w * 7);
      const slots = listSlots(pr.id, type, from, addDays(from, 6));
      if (slots.length) {
        if (!best || slots[0].start < best.start) best = { practitionerId: pr.id, ...slots[0] };
        break;
      }
    }
  }
  return best;
}

// Throws if the slot can't be booked, returns the end time otherwise
export function assertBookable(pr: Practitioner, type: AppointmentType, start: Date, ignoreAppointmentId?: string) {
  if (isNaN(start.getTime())) throw badRequest('INVALID_START');
  if (type === 'TELEHEALTH' && !pr.offersTelehealth) {
    throw badRequest('TELEHEALTH_NOT_OFFERED', `${pr.name} does not offer video consultations`);
  }
  const end = addMinutes(start, slotLength(pr.specialty, type));

  if (minutesUntil(start) < leadMinutes(type)) {
    throw badRequest('SLOT_TOO_SOON', 'This time is too close to book online, please call the clinic');
  }
  if (start > addDays(now(), config.bookingHorizonDays)) {
    throw badRequest('BEYOND_HORIZON', `Appointments can be booked up to ${config.bookingHorizonDays} days ahead`);
  }

  const day = startOfDayUTC(start);
  const hours = pr.weeklyHours[start.getUTCDay()];
  if (!hours || start < atTime(day, hours.start) || end > atTime(day, hours.end)) {
    throw badRequest('OUTSIDE_HOURS', 'Outside working hours');
  }
  if (hours.breakStart && hours.breakEnd && overlaps(start, end, atTime(day, hours.breakStart), atTime(day, hours.breakEnd))) {
    throw badRequest('OUTSIDE_HOURS', 'Outside working hours');
  }
  if (isClosed(pr.id, day)) throw conflict('CLINIC_CLOSED', 'The clinic is closed on this day');
  if (!isSlotFree(pr.id, start, end, ignoreAppointmentId)) {
    throw conflict('SLOT_TAKEN', 'Sorry, this time was just taken');
  }
  return end;
}
