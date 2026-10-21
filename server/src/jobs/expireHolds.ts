import { appointmentsFor } from '../db/store';
import { config } from '../config';
import { transition } from '../domain/appointmentStates';
import { notify } from '../services/notificationService';
import { iso, minutesUntil, now } from '../utils/time';

export async function expireHolds() {
  const t = now();

  for (const appt of appointmentsFor((a) => a.status === 'HELD' && !!a.holdExpiresAt && new Date(a.holdExpiresAt) < t)) {
    transition(appt, 'EXPIRED');
  }

  // reviews nobody got to in time
  const stale = appointmentsFor(
    (a) => a.status === 'PENDING_REVIEW' && minutesUntil(a.start, t) < config.pendingReviewCutoffMinutes,
  );
  for (const appt of stale) {
    transition(appt, 'CANCELLED');
    appt.cancelledAt = iso(t);
    appt.cancelledBy = 'SYSTEM';
    appt.cancelReason = 'REVIEW_TIMEOUT';
    await notify(appt.patientId, 'REVIEW_REJECTED', { start: appt.start, reason: 'not reviewed in time' });
  }
}
