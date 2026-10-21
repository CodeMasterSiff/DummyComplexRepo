import { db, getPractitioner } from '../db/store';
import { config } from '../config';
import { transition } from '../domain/appointmentStates';
import { Referral, Specialty, User } from '../domain/types';
import { conflict, forbidden, notFound } from '../domain/errors';
import { billVisit } from './billingService';
import { consumeVisit, issueReferral } from './referralService';
import { notify } from './notificationService';
import { addDays, dateKey, iso, now } from '../utils/time';

export async function completeAppointment(
  user: User,
  id: string,
  input: { notes?: string; followUpInDays?: number; referral?: { toSpecialty: Specialty; visitsAllowed?: number } },
) {
  if (user.role !== 'PRACTITIONER' || !user.practitionerId) throw forbidden('Only practitioners can complete appointments');
  const appt = db.appointments.get(id);
  if (!appt) throw notFound('Appointment');
  if (appt.practitionerId !== user.practitionerId) throw forbidden('This is not your appointment');
  if (appt.status !== 'CHECKED_IN') throw conflict('NOT_CHECKED_IN', 'The patient has not checked in');

  transition(appt, 'COMPLETED');
  appt.completedAt = iso(now());
  appt.notes = input.notes;

  billVisit(appt);
  if (appt.referralId) consumeVisit(appt.referralId);

  const pr = getPractitioner(appt.practitionerId)!;
  let referral: Referral | undefined;
  if (input.referral?.toSpecialty && pr.specialty === 'GP') {
    referral = issueReferral({
      patientId: appt.patientId,
      toSpecialty: input.referral.toSpecialty,
      practitionerId: pr.id,
      fromAppointmentId: appt.id,
      visitsAllowed: input.referral.visitsAllowed,
    });
    await notify(appt.patientId, 'REFERRAL_ISSUED', {
      specialty: referral.toSpecialty,
      validDays: config.referralValidDays,
    });
  }

  if (input.followUpInDays && input.followUpInDays > 0) {
    await notify(appt.patientId, 'FOLLOW_UP_SUGGESTED', {
      practitioner: pr.name,
      suggestedDate: dateKey(addDays(now(), input.followUpInDays)),
    });
  }

  return { appointment: appt, referral };
}
