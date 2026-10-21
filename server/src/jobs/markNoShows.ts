import { appointmentsFor } from '../db/store';
import { config } from '../config';
import { transition } from '../domain/appointmentStates';
import { recordStrike } from '../services/noShowPolicy';
import { minutesUntil, now } from '../utils/time';

export async function markNoShows() {
  const t = now();
  const missed = appointmentsFor(
    (a) => a.status === 'CONFIRMED' && !a.checkedInAt && minutesUntil(a.start, t) < -config.noShowGraceMinutes,
  );
  for (const appt of missed) {
    transition(appt, 'NO_SHOW');
    await recordStrike(appt);
  }
  if (missed.length) console.log(`[no-shows] marked ${missed.length} appointment(s)`);
}
