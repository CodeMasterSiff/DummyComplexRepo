import { db, all } from '../db/store';
import { InsurancePolicy, Patient, Payer, Plan, Specialty } from '../domain/types';
import { effectivePolicy } from './patientService';
import { startOfDayUTC } from '../utils/time';

const PLAN_ANNUAL_CAP: Record<Plan, number> = {
  BASIC: 6,
  PLUS: 12,
  PREMIUM: Infinity,
};

const PLAN_COVERS: Record<Plan, Specialty[]> = {
  BASIC: ['GP', 'PHYSIO', 'CARDIOLOGY'],
  PLUS: ['GP', 'PHYSIO', 'DERMATOLOGY', 'CARDIOLOGY'],
  PREMIUM: ['GP', 'PHYSIO', 'DERMATOLOGY', 'CARDIOLOGY'],
};

export interface PayerDecision {
  payer: Payer;
  policy?: InsurancePolicy;
  reason?: string;
  capExceeded?: boolean;
}

export function insuredVisitsInYear(patientId: string, year: number, ignoreAppointmentId?: string) {
  return all(db.appointments).filter(
    (a) =>
      a.patientId === patientId &&
      a.id !== ignoreAppointmentId &&
      a.payer === 'INSURANCE' &&
      ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(a.status) &&
      new Date(a.start).getUTCFullYear() === year,
  ).length;
}

export function resolvePayer(
  patient: Patient,
  requested: Payer,
  specialty: Specialty,
  start: Date,
  appointmentId?: string,
): PayerDecision {
  if (requested === 'SELF_PAY') return { payer: 'SELF_PAY' };

  const policy = effectivePolicy(patient);
  if (!policy) return { payer: 'SELF_PAY', reason: 'NO_POLICY' };
  if (new Date(policy.validUntil) < startOfDayUTC(start)) return { payer: 'SELF_PAY', reason: 'POLICY_EXPIRED' };
  if (!PLAN_COVERS[policy.plan].includes(specialty)) return { payer: 'SELF_PAY', reason: 'NOT_COVERED' };

  const used = insuredVisitsInYear(patient.id, start.getUTCFullYear(), appointmentId);
  if (used >= PLAN_ANNUAL_CAP[policy.plan]) {
    return { payer: 'SELF_PAY', policy, reason: 'ANNUAL_CAP_REACHED', capExceeded: true };
  }
  return { payer: 'INSURANCE', policy };
}
