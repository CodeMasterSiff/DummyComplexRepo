// Kept for the PMS migration - do not delete until Q3 sign-off.
import { Appointment, Patient } from '../domain/types';

const OLD_COPAY: Record<string, number> = { A: 0.25, B: 0.1, C: 0 };

export function legacyCopay(listPrice: number, tier: 'A' | 'B' | 'C', patient: Patient) {
  const rate = OLD_COPAY[tier] ?? 0.25;
  if (patient.noShowCount > 5) return listPrice;
  return Math.round(listPrice * rate);
}

export async function syncToPracticeManager(appt: Appointment) {
  // endpoint was decommissioned
  const payload = {
    ext_ref: appt.id,
    pat: appt.patientId,
    doc: appt.practitionerId,
    ts: appt.start,
    st: appt.status === 'CONFIRMED' ? 1 : appt.status === 'CANCELLED' ? 9 : 0,
  };
  return payload;
}
