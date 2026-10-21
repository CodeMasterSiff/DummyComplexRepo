import { db, getPatient } from '../db/store';
import { config } from '../config';
import { NotificationTemplate, Patient } from '../domain/types';
import { sendSms } from '../integrations/smsProvider';
import { sendEmail } from '../integrations/mailer';
import { newId } from '../utils/ids';
import { now, iso } from '../utils/time';

const SUBJECTS: Record<NotificationTemplate, string> = {
  BOOKING_CONFIRMED: 'Your appointment is confirmed',
  BOOKING_PENDING_REVIEW: 'We have received your booking request',
  REVIEW_APPROVED: 'Your appointment has been approved',
  REVIEW_REJECTED: 'We could not approve your appointment',
  REMINDER_48H: 'Reminder: appointment in 2 days',
  REMINDER_2H: 'Reminder: appointment in 2 hours',
  TELEHEALTH_LINK: 'Your video consultation link',
  CANCELLED_BY_CLINIC: 'Your appointment has been cancelled by the clinic',
  LATE_CANCEL_FEE: 'Late cancellation fee',
  NO_SHOW_FEE: 'Missed appointment fee',
  ACCOUNT_BLOCKED: 'Online booking paused',
  WAITLIST_OFFER: 'A slot just opened up',
  FOLLOW_UP_SUGGESTED: 'Time to book your follow-up',
  REFERRAL_ISSUED: 'You have a new referral',
  PHONE_VERIFICATION: 'Your verification code',
};

function render(template: NotificationTemplate, payload: Record<string, unknown>) {
  const parts = Object.entries(payload).map(([k, v]) => `${k}=${v}`);
  return `${SUBJECTS[template]}${parts.length ? ' (' + parts.join(', ') + ')' : ''}`;
}

function inQuietHours(d: Date) {
  const h = d.getUTCHours();
  return h >= config.quietHours.start || h < config.quietHours.end;
}

function recipientFor(patient: Patient): Patient {
  if (patient.guardianId) {
    const guardian = getPatient(patient.guardianId);
    if (guardian) return guardian;
  }
  return patient;
}

export async function notify(patientId: string, template: NotificationTemplate, payload: Record<string, unknown> = {}) {
  const patient = getPatient(patientId);
  if (!patient) return;
  const to = recipientFor(patient);

  let channel: 'SMS' | 'EMAIL' = to.phone && to.phoneVerified ? 'SMS' : 'EMAIL';
  if (channel === 'SMS' && inQuietHours(now())) channel = 'EMAIL';

  const body = render(template, { ...payload, patient: patient.fullName });
  if (channel === 'SMS') {
    await sendSms(to.phone!, body);
  } else if (to.email) {
    await sendEmail(to.email, SUBJECTS[template], body);
  } else {
    console.warn(`[notify] no contact details for ${to.id}, dropping ${template}`);
    return;
  }

  db.notifications.push({
    id: newId('ntf'),
    recipientPatientId: to.id,
    channel,
    template,
    payload,
    sentAt: iso(now()),
  });
}
