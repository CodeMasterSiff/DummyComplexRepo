import { db, all } from '../db/store';
import { config } from '../config';
import { AppointmentStatus, Payer, Plan, Referral, Specialty } from '../domain/types';
import { newId } from '../utils/ids';
import { addDays, iso, now } from '../utils/time';

export type ReferralProblem = 'NOT_FOUND' | 'WRONG_PATIENT' | 'WRONG_SPECIALTY' | 'EXPIRED' | 'NO_VISITS_LEFT';

const RESERVING: AppointmentStatus[] = ['PENDING_REVIEW', 'CONFIRMED', 'CHECKED_IN'];

export function needsReferral(specialty: Specialty, payer: Payer, plan?: Plan) {
  if (payer !== 'INSURANCE') return false;
  if (specialty === 'DERMATOLOGY' || specialty === 'CARDIOLOGY') return true;
  if (specialty === 'PHYSIO' && plan === 'BASIC') return true;
  return false;
}

export function referralExpiry(r: Referral) {
  return addDays(new Date(r.issuedAt), config.referralValidDays);
}

export function checkReferral(
  referralId: string,
  patientId: string,
  specialty: Specialty,
  start: Date,
  ignoreAppointmentId?: string,
): ReferralProblem | null {
  const r = db.referrals.get(referralId);
  if (!r) return 'NOT_FOUND';
  if (r.patientId !== patientId) return 'WRONG_PATIENT';
  if (r.toSpecialty !== specialty) return 'WRONG_SPECIALTY';
  if (referralExpiry(r) < start) return 'EXPIRED';

  const reserved = all(db.appointments).filter(
    (a) => a.referralId === r.id && a.id !== ignoreAppointmentId && RESERVING.includes(a.status),
  ).length;
  if (r.visitsUsed + reserved >= r.visitsAllowed) return 'NO_VISITS_LEFT';
  return null;
}

export function issueReferral(input: {
  patientId: string;
  toSpecialty: Specialty;
  practitionerId: string;
  fromAppointmentId?: string;
  visitsAllowed?: number;
}) {
  const referral: Referral = {
    id: newId('ref'),
    patientId: input.patientId,
    toSpecialty: input.toSpecialty,
    issuedByPractitionerId: input.practitionerId,
    fromAppointmentId: input.fromAppointmentId,
    issuedAt: iso(now()),
    visitsAllowed: input.visitsAllowed ?? config.defaultReferralVisits,
    visitsUsed: 0,
  };
  db.referrals.set(referral.id, referral);
  return referral;
}

export function consumeVisit(referralId: string) {
  const r = db.referrals.get(referralId);
  if (r) r.visitsUsed++;
}

export function referralsFor(patientIds: string[]) {
  return all(db.referrals)
    .filter((r) => patientIds.includes(r.patientId))
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}
