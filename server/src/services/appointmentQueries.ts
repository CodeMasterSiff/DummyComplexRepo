import { db, all, getPatient, getPractitioner } from '../db/store';
import { Appointment, AppointmentView, User } from '../domain/types';
import { notFound } from '../domain/errors';
import { householdIds, patientForActor } from './patientService';
import { dateKey } from '../utils/time';

export function toView(a: Appointment): AppointmentView {
  return {
    ...a,
    practitionerName: getPractitioner(a.practitionerId)?.name ?? 'Unknown',
    patientName: getPatient(a.patientId)?.fullName ?? 'Unknown',
  };
}

export function getAppointmentForActor(user: User, id: string) {
  const appt = db.appointments.get(id);
  if (!appt) throw notFound('Appointment');
  patientForActor(user, appt.patientId); // access check
  return appt;
}

export function householdAppointments(user: User) {
  const ids = householdIds(user);
  return all(db.appointments)
    .filter((a) => ids.includes(a.patientId) && a.status !== 'EXPIRED')
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(toView);
}

export function scheduleFor(date: string, practitionerId?: string) {
  return all(db.appointments)
    .filter(
      (a) =>
        dateKey(a.start) === date &&
        (!practitionerId || a.practitionerId === practitionerId) &&
        a.status !== 'EXPIRED' &&
        a.status !== 'HELD',
    )
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(toView);
}

export function reviewQueue() {
  return all(db.appointments)
    .filter((a) => a.status === 'PENDING_REVIEW')
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(toView);
}
