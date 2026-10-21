import { config } from '../config';
import { transition } from '../domain/appointmentStates';
import { User } from '../domain/types';
import { conflict } from '../domain/errors';
import { getAppointmentForActor } from './appointmentQueries';
import { iso, minutesUntil, now } from '../utils/time';

export function checkIn(user: User, id: string) {
  const appt = getAppointmentForActor(user, id);
  if (appt.status !== 'CONFIRMED') throw conflict('INVALID_STATE', 'Only confirmed appointments can be checked in');

  const mins = minutesUntil(appt.start);
  if (mins > config.checkInOpensMinutes || mins < -config.noShowGraceMinutes) {
    throw conflict(
      'CHECKIN_WINDOW',
      `Check-in opens ${config.checkInOpensMinutes} minutes before and closes ${config.noShowGraceMinutes} minutes after your appointment`,
    );
  }

  transition(appt, 'CHECKED_IN');
  appt.checkedInAt = iso(now());
  const joinUrl = appt.type === 'TELEHEALTH' ? config.telehealthBaseUrl + appt.id : undefined;
  return { appointment: appt, joinUrl };
}
