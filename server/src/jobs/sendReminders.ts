import { appointmentsFor, getPractitioner } from '../db/store';
import { config } from '../config';
import { notify } from '../services/notificationService';
import { hoursUntil, iso, minutesUntil, now } from '../utils/time';

export async function sendReminders() {
  const t = now();
  for (const appt of appointmentsFor((a) => a.status === 'CONFIRMED')) {
    const h = hoursUntil(appt.start, t);
    if (h <= 0) continue;
    const practitioner = getPractitioner(appt.practitionerId)?.name;

    if (!appt.reminder48SentAt && h <= 48 && h > 2) {
      // booked less than 48h ahead - skip the "2 days to go" one
      if (hoursUntil(appt.start, new Date(appt.createdAt)) > 48) {
        await notify(appt.patientId, 'REMINDER_48H', { start: appt.start, practitioner });
      }
      appt.reminder48SentAt = iso(t);
    }

    if (!appt.reminder2hSentAt && h <= 2) {
      await notify(appt.patientId, 'REMINDER_2H', { start: appt.start, practitioner });
      appt.reminder2hSentAt = iso(t);
    }

    if (appt.type === 'TELEHEALTH' && !appt.telehealthLinkSentAt && minutesUntil(appt.start, t) <= 15) {
      await notify(appt.patientId, 'TELEHEALTH_LINK', { url: config.telehealthBaseUrl + appt.id });
      appt.telehealthLinkSentAt = iso(t);
    }
  }
}
