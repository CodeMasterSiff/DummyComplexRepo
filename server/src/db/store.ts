import {
  Appointment,
  Closure,
  EmailVerification,
  InsuranceClaim,
  Invoice,
  Notification,
  Patient,
  Practitioner,
  Referral,
  Session,
  User,
  WaitlistEntry,
  WaitlistOffer,
} from '../domain/types';

// In-memory store. Everything is lost on restart, seed.ts rebuilds it.
export const db = {
  users: new Map<string, User>(),
  patients: new Map<string, Patient>(),
  practitioners: new Map<string, Practitioner>(),
  closures: new Map<string, Closure>(),
  appointments: new Map<string, Appointment>(),
  referrals: new Map<string, Referral>(),
  waitlist: new Map<string, WaitlistEntry>(),
  offers: new Map<string, WaitlistOffer>(),
  invoices: new Map<string, Invoice>(),
  claims: new Map<string, InsuranceClaim>(),
  notifications: [] as Notification[],
  sessions: new Map<string, Session>(),
  emailVerifications: new Map<string, EmailVerification>(),
  phoneVerifications: new Map<string, { phone: string; code: string }>(),
};

export const all = <T>(m: Map<string, T>) => Array.from(m.values());

export function findUserByEmail(email: string) {
  const e = email.trim().toLowerCase();
  return all(db.users).find((u) => u.email === e);
}

export function getPatient(id: string) {
  return db.patients.get(id);
}

export function getPractitioner(id: string) {
  return db.practitioners.get(id);
}

export function appointmentsFor(filter: (a: Appointment) => boolean) {
  return all(db.appointments).filter(filter);
}
