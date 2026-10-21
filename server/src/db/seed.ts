import { db, all } from './store';
import {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  DayHours,
  InsurancePolicy,
  Patient,
  Payer,
  Plan,
  Practitioner,
  Quote,
  Role,
  User,
} from '../domain/types';
import { hashPassword } from '../services/authService';
import { listSlots, slotLength } from '../services/availabilityService';
import { buildQuote } from '../services/pricingService';
import { billVisit, charge } from '../services/billingService';
import { addDays, addMinutes, atTime, hoursUntil, iso, now, startOfDayUTC } from '../utils/time';

const DEMO_PASSWORD = 'medibook-demo';

const weekdays = (days: number[], hours: DayHours) => Object.fromEntries(days.map((d) => [d, hours]));

const PRACTITIONERS: Practitioner[] = [
  {
    id: 'pr_okafor',
    name: 'Dr. Amara Okafor',
    specialty: 'GP',
    offersTelehealth: true,
    weeklyHours: weekdays([1, 2, 3, 4, 5], { start: '08:00', end: '16:00', breakStart: '12:00', breakEnd: '12:30' }),
  },
  {
    id: 'pr_lund',
    name: 'Dr. Henrik Lund',
    specialty: 'GP',
    offersTelehealth: false,
    weeklyHours: weekdays([1, 3, 5], { start: '09:00', end: '17:00', breakStart: '12:30', breakEnd: '13:00' }),
  },
  {
    id: 'pr_brandt',
    name: 'Sofie Brandt',
    specialty: 'PHYSIO',
    offersTelehealth: false,
    weeklyHours: weekdays([1, 2, 3, 4], { start: '08:00', end: '15:00' }),
  },
  {
    id: 'pr_ruiz',
    name: 'Dr. Mateo Ruiz',
    specialty: 'DERMATOLOGY',
    offersTelehealth: true,
    weeklyHours: weekdays([2, 4], { start: '09:00', end: '15:00' }),
  },
  {
    id: 'pr_holm',
    name: 'Dr. Ingrid Holm',
    specialty: 'CARDIOLOGY',
    offersTelehealth: false,
    weeklyHours: weekdays([1, 3], { start: '10:00', end: '16:00' }),
  },
];

export function seed() {
  const t = now();
  const today = startOfDayUTC(t);
  const year = t.getUTCFullYear();
  const passwordHash = hashPassword(DEMO_PASSWORD);
  let seq = 0;

  for (const p of PRACTITIONERS) db.practitioners.set(p.id, p);

  db.closures.set('cls_xmas', { id: 'cls_xmas', date: `${year}-12-24`, reason: 'Christmas Eve', createdAt: iso(t) });
  db.closures.set('cls_xmas2', { id: 'cls_xmas2', date: `${year}-12-25`, reason: 'Christmas Day', createdAt: iso(t) });

  const dob = (yearsAgo: number, mmdd: string) => `${year - yearsAgo}-${mmdd}`;
  const policy = (memberId: string, plan: Plan): InsurancePolicy => ({
    provider: 'Example Health Mutual',
    memberId,
    plan,
    validUntil: `${year + 1}-12-31`,
  });

  const patient = (id: string, fullName: string, dateOfBirth: string, extra: Partial<Patient> = {}) => {
    const p: Patient = { id, fullName, dateOfBirth, phoneVerified: false, noShowCount: 0, createdAt: iso(addDays(t, -400)), ...extra };
    db.patients.set(id, p);
    return p;
  };
  const user = (id: string, email: string, role: Role, extra: Partial<User> = {}) => {
    db.users.set(id, { id, email, passwordHash, role, emailVerified: true, createdAt: iso(addDays(t, -400)), ...extra });
  };

  const alice = patient('pat_alice', 'Alice Moreau', dob(34, '04-09'), {
    email: 'alice@example.com',
    phone: '+4520112233',
    phoneVerified: true,
    insurance: policy('EHM-448812', 'PLUS'),
  });
  const bob = patient('pat_bob', 'Bob Jensen', dob(52, '09-30'), {
    email: 'bob@example.com',
    phone: '+4520445566',
    noShowCount: 3,
  });
  const carol = patient('pat_carol', 'Carol Nguyen', dob(41, '01-22'), {
    email: 'carol@example.com',
    phone: '+4520778899',
    phoneVerified: true,
    insurance: policy('EHM-201733', 'BASIC'),
  });
  const dana = patient('pat_dana', 'Dana Nguyen', dob(9, '03-14'), { guardianId: carol.id });
  patient('pat_leo', 'Leo Nguyen', dob(18, '12-28'), { guardianId: carol.id });
  const dave = patient('pat_dave', 'Dave Patel', dob(29, '07-03'), {
    email: 'dave@example.com',
    phone: '+4520990011',
    phoneVerified: true,
    insurance: policy('TMO-559201', 'PREMIUM'),
  });
  const erin = patient('pat_erin', 'Erin Walsh', dob(23, '11-11'), { email: 'erin@example.com', createdAt: iso(addDays(t, -1)) });

  user('usr_alice', 'alice@example.com', 'PATIENT', { patientId: alice.id });
  user('usr_bob', 'bob@example.com', 'PATIENT', { patientId: bob.id });
  user('usr_carol', 'carol@example.com', 'PATIENT', { patientId: carol.id });
  user('usr_dave', 'dave@example.com', 'PATIENT', { patientId: dave.id });
  user('usr_erin', 'erin@example.com', 'PATIENT', { patientId: erin.id, emailVerified: false });
  user('usr_frontdesk', 'frontdesk@northside.example', 'STAFF');
  user('usr_okafor', 'okafor@northside.example', 'PRACTITIONER', { practitionerId: 'pr_okafor' });
  user('usr_ruiz', 'ruiz@northside.example', 'PRACTITIONER', { practitionerId: 'pr_ruiz' });

  const bookerFor = (p: Patient) =>
    all(db.users).find((u) => u.patientId === (p.guardianId ?? p.id))?.id ?? 'usr_frontdesk';

  const appt = (a: {
    patient: Patient;
    practitionerId: string;
    type: AppointmentType;
    start: Date;
    status: AppointmentStatus;
    payer?: Payer;
    quote?: Partial<Quote>;
    extra?: Partial<Appointment>;
  }) => {
    const pr = db.practitioners.get(a.practitionerId)!;
    const payer = a.payer ?? 'SELF_PAY';
    const pol = a.patient.insurance ?? (a.patient.guardianId ? db.patients.get(a.patient.guardianId)?.insurance : undefined);
    const quote = buildQuote({
      specialty: pr.specialty,
      type: a.type,
      payer,
      plan: payer === 'INSURANCE' ? pol?.plan : undefined,
      patient: a.patient,
    });
    const appointment: Appointment = {
      id: `apt_seed${++seq}`,
      patientId: a.patient.id,
      bookedByUserId: bookerFor(a.patient),
      practitionerId: pr.id,
      specialty: pr.specialty,
      type: a.type,
      start: iso(a.start),
      end: iso(addMinutes(a.start, slotLength(pr.specialty, a.type))),
      status: a.status,
      payer,
      quote: { ...quote, ...a.quote },
      createdAt: iso(addDays(a.start, -7)),
      ...a.extra,
    };
    if (a.status === 'COMPLETED') {
      appointment.checkedInAt = iso(addMinutes(a.start, -5));
      appointment.completedAt = iso(addMinutes(a.start, 25));
    }
    db.appointments.set(appointment.id, appointment);
    if (a.status === 'COMPLETED') billVisit(appointment);
    return appointment;
  };

  const nextSlot = (practitionerId: string, type: AppointmentType, afterDays: number) => {
    const from = addDays(t, afterDays);
    const slots = listSlots(practitionerId, type, from, addDays(from, 14)).filter((s) => new Date(s.start) >= from);
    return new Date(slots[0].start);
  };
  const daysAgoAt = (days: number, hhmm: string) => atTime(addDays(today, -days), hhmm);

  // --- Alice: referrals from two GP visits, follow-up coming up
  const aliceGp = appt({ patient: alice, practitionerId: 'pr_okafor', type: 'FIRST_VISIT', start: daysAgoAt(20, '09:00'), status: 'COMPLETED', payer: 'INSURANCE' });
  const aliceLund = appt({ patient: alice, practitionerId: 'pr_lund', type: 'FIRST_VISIT', start: daysAgoAt(45, '10:00'), status: 'COMPLETED', payer: 'INSURANCE' });
  db.referrals.set('ref_alice_derm', {
    id: 'ref_alice_derm',
    patientId: alice.id,
    toSpecialty: 'DERMATOLOGY',
    issuedByPractitionerId: 'pr_okafor',
    fromAppointmentId: aliceGp.id,
    issuedAt: aliceGp.completedAt!,
    visitsAllowed: 3,
    visitsUsed: 0,
  });
  db.referrals.set('ref_alice_cardio', {
    id: 'ref_alice_cardio',
    patientId: alice.id,
    toSpecialty: 'CARDIOLOGY',
    issuedByPractitionerId: 'pr_lund',
    fromAppointmentId: aliceLund.id,
    issuedAt: aliceLund.completedAt!,
    visitsAllowed: 2,
    visitsUsed: 0,
  });
  appt({ patient: alice, practitionerId: 'pr_okafor', type: 'FOLLOW_UP', start: nextSlot('pr_okafor', 'FOLLOW_UP', 3), status: 'CONFIRMED', payer: 'INSURANCE' });

  // --- Bob: two recent no-shows and one old one
  for (const [days, pr, at] of [[40, 'pr_okafor', '10:30'], [100, 'pr_lund', '11:00'], [250, 'pr_okafor', '14:00']] as const) {
    const missed = appt({ patient: bob, practitionerId: pr, type: 'FIRST_VISIT', start: daysAgoAt(days, at), status: 'NO_SHOW' });
    const inv = charge(bob, missed.id, 'NO_SHOW', 4000);
    if (days > 200) inv.status = 'PAID';
  }
  const soon = listSlots('pr_okafor', 'FIRST_VISIT', t, addDays(t, 1)).filter((s) => {
    const h = hoursUntil(s.start, t);
    return h > 4 && h < 23;
  });
  appt({
    patient: bob,
    practitionerId: 'pr_okafor',
    type: 'FIRST_VISIT',
    start: soon.length ? new Date(soon[soon.length - 1].start) : nextSlot('pr_okafor', 'FIRST_VISIT', 0),
    status: 'CONFIRMED',
  });
  appt({
    patient: bob,
    practitionerId: 'pr_holm',
    type: 'FIRST_VISIT',
    start: nextSlot('pr_holm', 'FIRST_VISIT', 10),
    status: 'PENDING_REVIEW',
    extra: { reviewReason: 'SPECIALIST_NO_REFERRAL' },
  });

  // --- Carol: used up her BASIC visits this year, in with Dr. Okafor right now
  for (let k = 1; k <= 6; k++) {
    appt({ patient: carol, practitionerId: 'pr_lund', type: 'FOLLOW_UP', start: daysAgoAt(k * 10, '09:00'), status: 'COMPLETED', payer: 'INSURANCE' });
  }
  const startedAt = new Date(Math.floor(t.getTime() / (5 * 60_000)) * 5 * 60_000);
  appt({
    patient: carol,
    practitionerId: 'pr_okafor',
    type: 'FIRST_VISIT',
    start: addMinutes(startedAt, -5),
    status: 'CHECKED_IN',
    quote: { payerReason: 'ANNUAL_CAP_REACHED', capExceeded: true },
    extra: { checkedInAt: iso(addMinutes(t, -3)), createdAt: iso(addDays(t, -2)) },
  });
  appt({ patient: dana, practitionerId: 'pr_okafor', type: 'FIRST_VISIT', start: nextSlot('pr_okafor', 'FIRST_VISIT', 5), status: 'CONFIRMED', payer: 'INSURANCE' });

  // --- Dave: insurer never answers, staff approved this one by phone
  appt({
    patient: dave,
    practitionerId: 'pr_okafor',
    type: 'TELEHEALTH',
    start: nextSlot('pr_okafor', 'TELEHEALTH', 0),
    status: 'CONFIRMED',
    payer: 'INSURANCE',
    extra: { reviewReason: 'INSURANCE_UNVERIFIED', reviewNote: 'Called insurer, policy active' },
  });
  db.waitlist.set('wl_dave', {
    id: 'wl_dave',
    patientId: dave.id,
    specialty: 'GP',
    anyPractitioner: true,
    type: 'FIRST_VISIT',
    earliest: iso(t),
    latest: iso(addDays(t, 7)),
    priority: 2,
    status: 'ACTIVE',
    ignoredOffers: 0,
    createdAt: iso(addDays(t, -3)),
  });

  // seeded visit invoices are already settled
  for (const inv of all(db.invoices)) if (inv.kind === 'VISIT') inv.status = 'PAID';

  console.log(
    `[seed] ${db.patients.size} patients, ${db.practitioners.size} practitioners, ${db.appointments.size} appointments (password: ${DEMO_PASSWORD})`,
  );
}
