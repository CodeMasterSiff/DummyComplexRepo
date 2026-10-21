import { db, all, getPatient } from '../db/store';
import { FEATURES } from '../config';
import { InsurancePolicy, Patient, User } from '../domain/types';
import { badRequest, forbidden, notFound } from '../domain/errors';
import { newId, sixDigitCode } from '../utils/ids';
import { ageOn, iso, now } from '../utils/time';
import { sendSms } from '../integrations/smsProvider';

export function isBlocked(patient: Patient) {
  if (FEATURES.LEGACY_STRIKES) return patient.noShowCount >= 3;
  return !!patient.blockedUntil && new Date(patient.blockedUntil) > now();
}

export function dependentsOf(patientId: string) {
  return all(db.patients).filter((p) => p.guardianId === patientId);
}

export function householdIds(user: User) {
  if (!user.patientId) return [];
  return [user.patientId, ...dependentsOf(user.patientId).map((d) => d.id)];
}

// Resolves which patient the user is acting for. Patients can act for themselves and their
// dependents, staff and practitioners for anyone.
// TODO: dependents who turn 18 should get their own account - for now guardian keeps access
export function patientForActor(user: User, patientId?: string) {
  const id = patientId ?? user.patientId;
  if (!id) throw badRequest('PATIENT_REQUIRED');
  const patient = getPatient(id);
  if (!patient) throw notFound('Patient');
  if (user.role !== 'PATIENT') return patient;
  if (patient.id === user.patientId || patient.guardianId === user.patientId) return patient;
  throw forbidden('You cannot act for this patient');
}

export function effectivePolicy(patient: Patient): InsurancePolicy | undefined {
  if (patient.insurance) return patient.insurance;
  if (patient.guardianId) return getPatient(patient.guardianId)?.insurance;
  return undefined;
}

export function addDependent(user: User, input: { fullName: string; dateOfBirth: string }) {
  if (!user.patientId) throw forbidden();
  if (!input.fullName || !input.dateOfBirth) throw badRequest('VALIDATION', 'Name and date of birth are required');
  if (ageOn(input.dateOfBirth) >= 18) throw badRequest('DEPENDENT_TOO_OLD', 'Dependents must be under 18');

  const dependent: Patient = {
    id: newId('pat'),
    fullName: input.fullName.trim(),
    dateOfBirth: input.dateOfBirth,
    phoneVerified: false,
    guardianId: user.patientId,
    noShowCount: 0,
    createdAt: iso(now()),
  };
  db.patients.set(dependent.id, dependent);
  return dependent;
}

const PLANS = ['BASIC', 'PLUS', 'PREMIUM'];

export function setInsurance(user: User, policy: InsurancePolicy & { patientId?: string }) {
  const patient = patientForActor(user, policy.patientId);
  if (!policy.provider || !policy.memberId || !PLANS.includes(policy.plan) || !policy.validUntil) {
    throw badRequest('VALIDATION', 'provider, memberId, plan and validUntil are required');
  }
  patient.insurance = {
    provider: policy.provider,
    memberId: policy.memberId.trim().toUpperCase(),
    plan: policy.plan,
    validUntil: policy.validUntil,
  };
  return patient;
}

export async function startPhoneVerification(user: User, phone: string) {
  const patient = patientForActor(user);
  if (!/^\+?[0-9 ]{8,15}$/.test(phone ?? '')) throw badRequest('INVALID_PHONE');
  patient.phone = phone.replace(/\s/g, '');
  patient.phoneVerified = false;
  const code = sixDigitCode();
  db.phoneVerifications.set(patient.id, { phone: patient.phone, code });
  await sendSms(patient.phone, `Your MediBook code is ${code}`);
}

export function confirmPhone(user: User, code: string) {
  const patient = patientForActor(user);
  const pending = db.phoneVerifications.get(patient.id);
  if (!pending || pending.code !== code || pending.phone !== patient.phone) throw badRequest('INVALID_CODE');
  patient.phoneVerified = true;
  db.phoneVerifications.delete(patient.id);
  return patient;
}

export function searchPatients(q: string) {
  const s = (q ?? '').trim().toLowerCase();
  if (s.length < 2) return [];
  return all(db.patients)
    .filter((p) => p.fullName.toLowerCase().includes(s) || p.email?.includes(s))
    .slice(0, 20);
}
