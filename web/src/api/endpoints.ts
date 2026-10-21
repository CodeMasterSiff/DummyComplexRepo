import { request } from './client';
import type {
  Appointment,
  AppointmentType,
  AppointmentView,
  Closure,
  FirstAvailableSlot,
  Household,
  InsurancePolicy,
  Invoice,
  Patient,
  Payer,
  Practitioner,
  Quote,
  Referral,
  Slot,
  Specialty,
  SpecialtyInfo,
  User,
  WaitlistEntry,
  WaitlistOffer,
} from './types';

export interface SignupInput {
  fullName: string;
  dateOfBirth: string;
  email: string;
  password: string;
}

export interface HoldInput {
  patientId: string;
  practitionerId: string;
  type: AppointmentType;
  start: string;
}

export interface WaitlistInput {
  patientId: string;
  practitionerId?: string;
  specialty: Specialty;
  anyPractitioner: boolean;
  type: AppointmentType;
  earliest: string;
  latest: string;
}

export interface CompleteVisitInput {
  notes: string;
  followUpInDays?: number;
  referral?: { toSpecialty: Specialty; visitsAllowed?: number };
}

export interface WaitlistOfferDetails {
  offer: WaitlistOffer;
  practitionerName: string;
  patientName: string;
  type: AppointmentType;
}

export const authApi = {
  signup: (input: SignupInput) => request<{ user: User }>('POST', '/auth/signup', { body: input }),
  verifyEmail: (email: string, code: string) =>
    request<{ ok: boolean }>('POST', '/auth/verify-email', { body: { email, code } }),
  resendCode: (email: string) => request<{ ok: boolean }>('POST', '/auth/resend-code', { body: { email } }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('POST', '/auth/login', { body: { email, password } }),
  logout: () => request<void>('POST', '/auth/logout'),
  me: () => request<{ user: User }>('GET', '/auth/me'),
};

export const patientApi = {
  me: () => request<Household>('GET', '/patients/me'),
  // patientId targets a dependent; omit it for the account holder
  setInsurance: (policy: InsurancePolicy, patientId?: string) =>
    request<{ patient: Patient }>('PUT', '/patients/me/insurance', { body: { ...policy, patientId } }),
  addDependent: (fullName: string, dateOfBirth: string) =>
    request<{ patient: Patient }>('POST', '/patients/me/dependents', { body: { fullName, dateOfBirth } }),
  referrals: () => request<{ referrals: Referral[] }>('GET', '/patients/me/referrals'),
  invoices: () => request<{ invoices: Invoice[] }>('GET', '/patients/me/invoices'),
};

export const catalogApi = {
  specialties: () => request<{ specialties: SpecialtyInfo[] }>('GET', '/specialties'),
  practitioners: (specialty?: Specialty) =>
    request<{ practitioners: Practitioner[] }>('GET', '/practitioners', { query: { specialty } }),
  availability: (practitionerId: string, type: AppointmentType, from: string, to: string) =>
    request<{ slots: Slot[] }>('GET', '/availability', { query: { practitionerId, type, from, to } }),
  firstAvailable: (specialty: Specialty, type: AppointmentType) =>
    request<{ slot: FirstAvailableSlot | null }>('GET', '/availability/first', { query: { specialty, type } }),
};

export const appointmentApi = {
  list: () => request<{ appointments: AppointmentView[] }>('GET', '/appointments'),
  get: (id: string) => request<{ appointment: AppointmentView }>('GET', `/appointments/${id}`),
  hold: (input: HoldInput) => request<{ appointment: Appointment }>('POST', '/appointments/hold', { body: input }),
  quote: (id: string, payer: Payer, referralId?: string) =>
    request<{ quote: Quote; needsReferral: boolean }>('GET', `/appointments/${id}/quote`, {
      query: { payer, referralId },
    }),
  confirm: (id: string, payer: Payer, referralId?: string) =>
    request<{ appointment: Appointment }>('POST', `/appointments/${id}/confirm`, { body: { payer, referralId } }),
  cancel: (id: string, reason?: string) =>
    request<{ appointment: Appointment; fee: number }>('POST', `/appointments/${id}/cancel`, { body: { reason } }),
  reschedule: (id: string, start: string) =>
    request<{ appointment: Appointment; fee: number; courtesyUsed: boolean }>(
      'POST',
      `/appointments/${id}/reschedule`,
      { body: { start } },
    ),
  checkIn: (id: string) =>
    request<{ appointment: Appointment; joinUrl?: string }>('POST', `/appointments/${id}/check-in`),
};

export const waitlistApi = {
  list: () => request<{ entries: WaitlistEntry[] }>('GET', '/waitlist'),
  join: (input: WaitlistInput) => request<{ entry: WaitlistEntry }>('POST', '/waitlist', { body: input }),
  leave: (id: string) => request<void>('DELETE', `/waitlist/${id}`),
  offer: (token: string) => request<WaitlistOfferDetails>('GET', `/waitlist/offers/${encodeURIComponent(token)}`),
  claim: (token: string) =>
    request<{ appointment: Appointment }>('POST', `/waitlist/offers/${encodeURIComponent(token)}/claim`),
  decline: (token: string) =>
    request<{ ok: boolean }>('POST', `/waitlist/offers/${encodeURIComponent(token)}/decline`),
};

export const staffApi = {
  reviewQueue: () => request<{ appointments: AppointmentView[] }>('GET', '/staff/review-queue'),
  review: (id: string, decision: 'APPROVE' | 'REJECT', note?: string) =>
    request<{ appointment: Appointment }>('POST', `/staff/appointments/${id}/review`, { body: { decision, note } }),
  schedule: (date: string, practitionerId?: string) =>
    request<{ appointments: AppointmentView[] }>('GET', '/staff/schedule', { query: { date, practitionerId } }),
  searchPatients: (q: string) => request<{ patients: Patient[] }>('GET', '/staff/patients', { query: { q } }),
  hold: (input: HoldInput & { overrideBlock: boolean }) =>
    request<{ appointment: Appointment }>('POST', '/staff/appointments/hold', { body: input }),
  cancel: (id: string, reason: string) =>
    request<{ appointment: Appointment }>('POST', `/staff/appointments/${id}/cancel`, { body: { reason } }),
  checkIn: (id: string) => request<{ appointment: Appointment }>('POST', `/staff/appointments/${id}/check-in`),
  complete: (id: string, input: CompleteVisitInput) =>
    request<{ appointment: Appointment; referral?: Referral }>('POST', `/staff/appointments/${id}/complete`, {
      body: input,
    }),
  closeDay: (input: { date: string; practitionerId?: string; reason: string }) =>
    request<{ closure: Closure; cancelledCount: number }>('POST', '/staff/closures', { body: input }),
};
