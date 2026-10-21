// Patients can cancel free of charge up to 48 hours before the appointment, after that the
// late cancellation fee applies. Clinic cancellations are always free and the patient gets
// priority on the waitlist.
import { db, appointmentsFor, getPatient, getPractitioner } from '../db/store';
import { config } from '../config';
import { transition } from '../domain/appointmentStates';
import { Appointment, AppointmentStatus, CancelledBy, User } from '../domain/types';
import { badRequest, conflict, notFound } from '../domain/errors';
import { getAppointmentForActor } from './appointmentQueries';
import { assertBookable } from './availabilityService';
import { charge } from './billingService';
import { notify } from './notificationService';
import { enrollPriority, releaseSlot } from './waitlistService';
import { newId } from '../utils/ids';
import { dateKey, daysSince, hoursUntil, iso, now } from '../utils/time';

const CANCELLABLE: AppointmentStatus[] = ['HELD', 'PENDING_REVIEW', 'CONFIRMED'];

export function lateCancelFee(appt: Appointment) {
  const share = appt.quote?.patientShare ?? 0;
  return Math.max(config.lateCancelMinFee, Math.round(share * 0.5));
}

const isLate = (appt: Appointment) => hoursUntil(appt.start) < config.lateCancelHours;

function markCancelled(appt: Appointment, by: CancelledBy, reason: string) {
  transition(appt, 'CANCELLED');
  appt.cancelledAt = iso(now());
  appt.cancelledBy = by;
  appt.cancelReason = reason;
}

export async function cancelByPatient(user: User, id: string, reason?: string) {
  const appt = getAppointmentForActor(user, id);
  if (!CANCELLABLE.includes(appt.status)) throw conflict('NOT_CANCELLABLE', 'This appointment can no longer be cancelled');

  const wasActive = appt.status !== 'HELD';
  let fee = 0;
  if (appt.status === 'CONFIRMED' && appt.type !== 'TELEHEALTH' && isLate(appt)) {
    fee = lateCancelFee(appt);
  }

  markCancelled(appt, 'PATIENT', reason || 'PATIENT_REQUEST');
  if (fee > 0) {
    charge(getPatient(appt.patientId)!, appt.id, 'LATE_CANCEL', fee);
    await notify(appt.patientId, 'LATE_CANCEL_FEE', { amount: fee, start: appt.start });
  }
  if (wasActive) await releaseSlot(appt);
  return { appointment: appt, fee };
}

export async function cancelByClinic(id: string, reason?: string) {
  const appt = db.appointments.get(id);
  if (!appt) throw notFound('Appointment');
  if (!CANCELLABLE.includes(appt.status)) throw conflict('NOT_CANCELLABLE', 'This appointment can no longer be cancelled');

  markCancelled(appt, 'CLINIC', reason || 'CLINIC_CANCELLED');
  enrollPriority(appt);
  await notify(appt.patientId, 'CANCELLED_BY_CLINIC', { start: appt.start, reason });
  await releaseSlot(appt);
  return appt;
}

export async function closeDay(input: { date: string; practitionerId?: string; reason: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '')) throw badRequest('VALIDATION', 'date must be YYYY-MM-DD');
  if (input.practitionerId && !getPractitioner(input.practitionerId)) throw notFound('Practitioner');

  const closure = {
    id: newId('cls'),
    date: input.date,
    practitionerId: input.practitionerId || undefined,
    reason: input.reason || 'Closed',
    createdAt: iso(now()),
  };
  db.closures.set(closure.id, closure);

  const affected = appointmentsFor(
    (a) =>
      dateKey(a.start) === input.date &&
      (!closure.practitionerId || a.practitionerId === closure.practitionerId) &&
      CANCELLABLE.includes(a.status),
  );
  for (const appt of affected) await cancelByClinic(appt.id, closure.reason);
  return { closure, cancelledCount: affected.length };
}

export async function reschedule(user: User, id: string, newStartIso: string) {
  const old = getAppointmentForActor(user, id);
  if (old.status !== 'CONFIRMED') throw conflict('NOT_RESCHEDULABLE', 'Only confirmed appointments can be rescheduled');

  const patient = getPatient(old.patientId)!;
  const pr = getPractitioner(old.practitionerId)!;
  const newStart = new Date(newStartIso);
  const end = assertBookable(pr, old.type, newStart, old.id);

  let fee = 0;
  let courtesyUsed = false;
  if (isLate(old)) {
    const last = patient.lastCourtesyRescheduleAt;
    if (!last || daysSince(last) > config.courtesyRescheduleDays) {
      courtesyUsed = true;
      patient.lastCourtesyRescheduleAt = iso(now());
    } else {
      fee = lateCancelFee(old);
    }
  }

  const appt: Appointment = {
    ...old,
    id: newId('apt'),
    start: iso(newStart),
    end: iso(end),
    status: 'CONFIRMED',
    bookedByUserId: user.id,
    rescheduledFromId: old.id,
    reminder48SentAt: undefined,
    reminder2hSentAt: undefined,
    telehealthLinkSentAt: undefined,
    createdAt: iso(now()),
  };
  db.appointments.set(appt.id, appt);
  markCancelled(old, 'PATIENT', 'RESCHEDULED');

  if (fee > 0) {
    charge(patient, old.id, 'LATE_CANCEL', fee);
    await notify(patient.id, 'LATE_CANCEL_FEE', { amount: fee, start: old.start });
  }
  await notify(patient.id, 'BOOKING_CONFIRMED', { start: appt.start, practitioner: pr.name });
  await releaseSlot(old);
  return { appointment: appt, fee, courtesyUsed };
}
