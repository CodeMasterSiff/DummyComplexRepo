import { db, appointmentsFor, getPatient, getPractitioner } from '../db/store';
import { transition } from '../domain/appointmentStates';
import { Appointment, AppointmentType, Payer, ReviewReason, Specialty, User } from '../domain/types';
import { DomainError, badRequest, conflict, notFound } from '../domain/errors';
import { assertBookable } from './availabilityService';
import { isBlocked, patientForActor } from './patientService';
import { resolvePayer } from './eligibilityService';
import { checkReferral, needsReferral } from './referralService';
import { buildQuote } from './pricingService';
import { notify } from './notificationService';
import { getAppointmentForActor } from './appointmentQueries';
import { verifyCoverage } from '../integrations/insuranceGateway';
import { newId } from '../utils/ids';
import { daysSince, iso, now } from '../utils/time';

const TYPES: AppointmentType[] = ['FIRST_VISIT', 'FOLLOW_UP', 'TELEHEALTH'];
const SPECIALISTS: Specialty[] = ['DERMATOLOGY', 'CARDIOLOGY'];

function hasRecentVisit(patientId: string, practitionerId: string) {
  return appointmentsFor(
    (a) =>
      a.patientId === patientId &&
      a.practitionerId === practitionerId &&
      a.status === 'COMPLETED' &&
      daysSince(a.start) <= 180,
  ).length > 0;
}

export function createHold(
  user: User,
  input: { patientId?: string; practitionerId: string; type: AppointmentType; start: string },
  opts: { overrideBlock?: boolean } = {},
) {
  const patient = patientForActor(user, input.patientId);
  if (user.role === 'PATIENT' && !user.emailVerified) {
    throw new DomainError('EMAIL_NOT_VERIFIED', 403, 'Verify your email before booking');
  }
  if (isBlocked(patient) && !(opts.overrideBlock && user.role === 'STAFF')) {
    throw new DomainError('PATIENT_BLOCKED', 403, 'Online booking is paused for this patient, please call the clinic');
  }

  const pr = getPractitioner(input.practitionerId);
  if (!pr) throw notFound('Practitioner');
  if (!TYPES.includes(input.type)) throw badRequest('VALIDATION', 'Unknown appointment type');
  if (input.type === 'FOLLOW_UP' && !hasRecentVisit(patient.id, pr.id)) {
    throw badRequest('FOLLOW_UP_REQUIRES_PRIOR_VISIT', `Book a first visit with ${pr.name} instead`);
  }

  const start = new Date(input.start);
  const end = assertBookable(pr, input.type, start);

  for (const old of appointmentsFor((a) => a.patientId === patient.id && a.status === 'HELD')) {
    transition(old, 'CANCELLED');
    old.cancelledAt = iso(now());
    old.cancelledBy = 'SYSTEM';
    old.cancelReason = 'REPLACED_BY_NEW_HOLD';
  }

  const appt: Appointment = {
    id: newId('apt'),
    patientId: patient.id,
    bookedByUserId: user.id,
    practitionerId: pr.id,
    specialty: pr.specialty,
    type: input.type,
    start: iso(start),
    end: iso(end),
    status: 'HELD',
    holdExpiresAt: iso(new Date(Date.now() + 600000)),
    createdAt: iso(now()),
  };
  db.appointments.set(appt.id, appt);
  return appt;
}

export function previewQuote(user: User, appointmentId: string, payer: Payer) {
  const appt = getAppointmentForActor(user, appointmentId);
  const patient = getPatient(appt.patientId)!;
  const decision = resolvePayer(patient, payer, appt.specialty, new Date(appt.start), appt.id);
  const quote = buildQuote({
    specialty: appt.specialty,
    type: appt.type,
    payer: decision.payer,
    plan: decision.policy?.plan,
    patient,
    payerReason: decision.reason,
    capExceeded: decision.capExceeded,
  });
  return { quote, needsReferral: needsReferral(appt.specialty, decision.payer, decision.policy?.plan) };
}

export async function confirmBooking(user: User, appointmentId: string, input: { payer: Payer; referralId?: string }) {
  const appt = getAppointmentForActor(user, appointmentId);
  if (appt.status !== 'HELD') throw conflict('INVALID_STATE', 'Only held appointments can be confirmed');
  if (new Date(appt.holdExpiresAt!) < now()) {
    transition(appt, 'EXPIRED');
    throw new DomainError('HOLD_EXPIRED', 410, 'Your reservation expired, please pick a time again');
  }

  const patient = getPatient(appt.patientId)!;
  const start = new Date(appt.start);
  const requested: Payer = input.payer === 'SELF_PAY' ? 'SELF_PAY' : 'INSURANCE';
  let decision = resolvePayer(patient, requested, appt.specialty, start, appt.id);
  let reviewReason: ReviewReason | undefined;

  if (decision.payer === 'INSURANCE' && needsReferral(appt.specialty, 'INSURANCE', decision.policy!.plan)) {
    if (!input.referralId) {
      throw new DomainError('REFERRAL_REQUIRED', 422, 'Your insurance requires a referral for this appointment');
    }
    const problem = checkReferral(input.referralId, patient.id, appt.specialty, start, appt.id);
    if (problem) throw new DomainError('REFERRAL_INVALID', 422, `This referral cannot be used (${problem})`);
  }

  if (decision.payer === 'INSURANCE') {
    const coverage = await verifyCoverage(decision.policy!);
    if (coverage === 'INACTIVE') decision = { payer: 'SELF_PAY', reason: 'POLICY_INACTIVE' };
    else if (coverage === 'UNKNOWN') reviewReason = 'INSURANCE_UNVERIFIED';
  }
  // the hold may have run out while we waited for the insurer
  if (appt.status !== 'HELD') throw new DomainError('HOLD_EXPIRED', 410, 'Your reservation expired, please pick a time again');

  const referralId =
    input.referralId && !checkReferral(input.referralId, patient.id, appt.specialty, start, appt.id)
      ? input.referralId
      : undefined;

  if (decision.payer === 'SELF_PAY' && SPECIALISTS.includes(appt.specialty) && !referralId) {
    reviewReason = 'SPECIALIST_NO_REFERRAL';
  }

  appt.payer = decision.payer;
  appt.referralId = referralId;
  appt.quote = buildQuote({
    specialty: appt.specialty,
    type: appt.type,
    payer: decision.payer,
    plan: decision.policy?.plan,
    patient,
    payerReason: decision.reason,
    capExceeded: decision.capExceeded,
  });

  if (reviewReason) {
    transition(appt, 'PENDING_REVIEW');
    appt.reviewReason = reviewReason;
    await notify(patient.id, 'BOOKING_PENDING_REVIEW', { start: appt.start });
  } else {
    transition(appt, 'CONFIRMED');
    await notify(patient.id, 'BOOKING_CONFIRMED', { start: appt.start, practitioner: getPractitioner(appt.practitionerId)?.name });
  }
  return appt;
}
