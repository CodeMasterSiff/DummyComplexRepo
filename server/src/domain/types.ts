export type Role = 'PATIENT' | 'STAFF' | 'PRACTITIONER';
export type Specialty = 'GP' | 'PHYSIO' | 'DERMATOLOGY' | 'CARDIOLOGY';
export type AppointmentType = 'FIRST_VISIT' | 'FOLLOW_UP' | 'TELEHEALTH';
export type AppointmentStatus =
  | 'HELD'
  | 'PENDING_REVIEW'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED';
export type Payer = 'INSURANCE' | 'SELF_PAY';
export type Plan = 'BASIC' | 'PLUS' | 'PREMIUM';
export type ReviewReason = 'SPECIALIST_NO_REFERRAL' | 'INSURANCE_UNVERIFIED';
export type CancelledBy = 'PATIENT' | 'CLINIC' | 'SYSTEM';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  patientId?: string;
  practitionerId?: string;
  emailVerified: boolean;
  createdAt: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface InsurancePolicy {
  provider: string;
  memberId: string;
  plan: Plan;
  validUntil: string; // YYYY-MM-DD
}

export interface Patient {
  id: string;
  fullName: string;
  dateOfBirth: string; // YYYY-MM-DD
  email?: string;
  phone?: string;
  phoneVerified: boolean;
  guardianId?: string;
  insurance?: InsurancePolicy;
  noShowCount: number;
  blockedUntil?: string;
  lastCourtesyRescheduleAt?: string;
  createdAt: string;
}

export interface DayHours {
  start: string; // HH:mm
  end: string;
  breakStart?: string;
  breakEnd?: string;
}

export interface Practitioner {
  id: string;
  name: string;
  specialty: Specialty;
  offersTelehealth: boolean;
  // 0 = Sunday
  weeklyHours: Partial<Record<number, DayHours>>;
}

export interface Closure {
  id: string;
  date: string; // YYYY-MM-DD
  practitionerId?: string;
  reason: string;
  createdAt: string;
}

export interface Quote {
  basePrice: number;
  listPrice: number;
  patientShare: number;
  insurerShare: number;
  payer: Payer;
  payerReason?: string;
  capExceeded?: boolean;
  currency: 'EUR';
}

export interface Appointment {
  id: string;
  patientId: string;
  bookedByUserId: string;
  practitionerId: string;
  specialty: Specialty;
  type: AppointmentType;
  start: string;
  end: string;
  status: AppointmentStatus;
  payer?: Payer;
  referralId?: string;
  quote?: Quote;
  holdExpiresAt?: string;
  reviewReason?: ReviewReason;
  reviewNote?: string;
  checkedInAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledBy?: CancelledBy;
  cancelReason?: string;
  rescheduledFromId?: string;
  reminder48SentAt?: string;
  reminder2hSentAt?: string;
  telehealthLinkSentAt?: string;
  notes?: string;
  createdAt: string;
}

export interface AppointmentView extends Appointment {
  practitionerName: string;
  patientName: string;
}

export interface Referral {
  id: string;
  patientId: string;
  toSpecialty: Specialty;
  issuedByPractitionerId: string;
  fromAppointmentId?: string;
  issuedAt: string;
  visitsAllowed: number;
  visitsUsed: number;
}

export interface WaitlistEntry {
  id: string;
  patientId: string;
  practitionerId?: string;
  specialty: Specialty;
  anyPractitioner: boolean;
  type: AppointmentType;
  earliest: string;
  latest: string;
  priority: 1 | 2;
  status: 'ACTIVE' | 'FULFILLED' | 'REMOVED';
  ignoredOffers: number;
  createdAt: string;
}

export interface WaitlistOffer {
  id: string;
  token: string;
  entryId: string;
  practitionerId: string;
  start: string;
  status: 'OPEN' | 'CLAIMED' | 'DECLINED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  billedPatientId: string;
  appointmentId: string;
  kind: 'VISIT' | 'LATE_CANCEL' | 'NO_SHOW';
  amount: number;
  status: 'OPEN' | 'PAID';
  createdAt: string;
}

export interface InsuranceClaim {
  id: string;
  appointmentId: string;
  provider: string;
  memberId: string;
  amount: number;
  status: 'SUBMITTED';
  createdAt: string;
}

export type NotificationTemplate =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_PENDING_REVIEW'
  | 'REVIEW_APPROVED'
  | 'REVIEW_REJECTED'
  | 'REMINDER_48H'
  | 'REMINDER_2H'
  | 'TELEHEALTH_LINK'
  | 'CANCELLED_BY_CLINIC'
  | 'LATE_CANCEL_FEE'
  | 'NO_SHOW_FEE'
  | 'ACCOUNT_BLOCKED'
  | 'WAITLIST_OFFER'
  | 'FOLLOW_UP_SUGGESTED'
  | 'REFERRAL_ISSUED'
  | 'PHONE_VERIFICATION';

export interface Notification {
  id: string;
  recipientPatientId: string;
  channel: 'SMS' | 'EMAIL';
  template: NotificationTemplate;
  payload: Record<string, unknown>;
  sentAt: string;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: string;
}

export interface EmailVerification {
  email: string;
  code: string;
  expiresAt: string;
  attempts: number;
  lastSentAt: string;
}
