import type { InsurancePolicy, Patient, Referral, Specialty } from '../api/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_VALIDITY_DAYS = 90;

const VALIDITY_DAYS: Partial<Record<Specialty, number>> = {
  CARDIOLOGY: 30,
};

export function referralValidUntil(referral: Referral): Date {
  const days = VALIDITY_DAYS[referral.toSpecialty] ?? DEFAULT_VALIDITY_DAYS;
  return new Date(new Date(referral.issuedAt).getTime() + days * DAY_MS);
}

export function isReferralExpired(referral: Referral, onDate: Date = new Date()): boolean {
  return onDate.getTime() > referralValidUntil(referral).getTime();
}

export function visitsLeft(referral: Referral): number {
  return Math.max(0, referral.visitsAllowed - referral.visitsUsed);
}

export function isReferralUsable(referral: Referral, specialty: Specialty, onDate: Date = new Date()): boolean {
  return (
    referral.toSpecialty === specialty &&
    !isReferralExpired(referral, onDate) &&
    referral.visitsUsed < referral.visitsAllowed
  );
}

// Dependents without their own policy are covered by the guardian's.
export function coveringPolicy(patient: Patient, guardian?: Patient): InsurancePolicy | undefined {
  if (patient.insurance) return patient.insurance;
  if (patient.guardianId && guardian && guardian.id === patient.guardianId) return guardian.insurance;
  return undefined;
}

export function needsReferralStep(specialty: Specialty, policy?: InsurancePolicy): boolean {
  if (!policy) return false;
  if (specialty === 'DERMATOLOGY' || specialty === 'CARDIOLOGY') return true;
  return specialty === 'PHYSIO' && policy.plan === 'BASIC';
}
