import { Appointment, AppointmentStatus } from './types';
import { conflict } from './errors';

export const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  HELD: ['CONFIRMED', 'PENDING_REVIEW', 'EXPIRED', 'CANCELLED'],
  PENDING_REVIEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  EXPIRED: [],
};

// statuses that occupy a practitioner's time
export const BLOCKING_STATUSES: AppointmentStatus[] = ['HELD', 'PENDING_REVIEW', 'CONFIRMED', 'CHECKED_IN'];

export function canTransition(from: AppointmentStatus, to: AppointmentStatus) {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function transition(appt: Appointment, to: AppointmentStatus) {
  if (!canTransition(appt.status, to)) {
    throw conflict('INVALID_STATE', `Cannot move appointment from ${appt.status} to ${to}`);
  }
  appt.status = to;
  return appt;
}
