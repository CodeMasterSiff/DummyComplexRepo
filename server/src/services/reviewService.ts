import { db } from '../db/store';
import { transition } from '../domain/appointmentStates';
import { badRequest, conflict, notFound } from '../domain/errors';
import { notify } from './notificationService';
import { releaseSlot } from './waitlistService';
import { iso, now } from '../utils/time';

export async function reviewAppointment(id: string, decision: 'APPROVE' | 'REJECT', note?: string) {
  const appt = db.appointments.get(id);
  if (!appt) throw notFound('Appointment');
  if (appt.status !== 'PENDING_REVIEW') throw conflict('INVALID_STATE', 'Appointment is not awaiting review');
  if (decision !== 'APPROVE' && decision !== 'REJECT') throw badRequest('VALIDATION', 'decision must be APPROVE or REJECT');

  appt.reviewNote = note;
  if (decision === 'APPROVE') {
    transition(appt, 'CONFIRMED');
    await notify(appt.patientId, 'REVIEW_APPROVED', { start: appt.start });
  } else {
    transition(appt, 'CANCELLED');
    appt.cancelledAt = iso(now());
    appt.cancelledBy = 'CLINIC';
    appt.cancelReason = 'REVIEW_REJECTED';
    await notify(appt.patientId, 'REVIEW_REJECTED', { start: appt.start, note });
    await releaseSlot(appt);
  }
  return appt;
}
