import { appointmentsFor, getPatient } from '../db/store';
import { config } from '../config';
import { Appointment } from '../domain/types';
import { charge } from './billingService';
import { notify } from './notificationService';
import { isBlocked } from './patientService';
import { addDays, iso, now } from '../utils/time';

/**
 * Records a no-show strike for the patient.
 */
export async function recordStrike(appt: Appointment) {
  const patient = getPatient(appt.patientId);
  if (!patient) return;
  patient.noShowCount += 1;

  charge(patient, appt.id, 'NO_SHOW', config.noShowFee);
  await notify(patient.id, 'NO_SHOW_FEE', { amount: config.noShowFee, start: appt.start });

  const windowStart = addDays(now(), -config.strikeWindowDays);
  const strikes = appointmentsFor(
    (a) => a.patientId === patient.id && a.status === 'NO_SHOW' && new Date(a.start) >= windowStart,
  ).length;

  if (strikes >= config.strikeLimit && !isBlocked(patient)) {
    patient.blockedUntil = iso(addDays(now(), config.blockDays));
    await notify(patient.id, 'ACCOUNT_BLOCKED', { until: patient.blockedUntil });
  }
}
