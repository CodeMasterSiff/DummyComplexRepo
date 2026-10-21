import { db, all, getPatient } from '../db/store';
import { Appointment, Invoice, Patient } from '../domain/types';
import { newId } from '../utils/ids';
import { iso, now } from '../utils/time';

// children are billed through their guardian
export function billedPatientId(patient: Patient) {
  return patient.guardianId ?? patient.id;
}

export function charge(patient: Patient, appointmentId: string, kind: Invoice['kind'], amount: number) {
  const invoice: Invoice = {
    id: newId('inv'),
    billedPatientId: billedPatientId(patient),
    appointmentId,
    kind,
    amount,
    status: 'OPEN',
    createdAt: iso(now()),
  };
  db.invoices.set(invoice.id, invoice);
  return invoice;
}

export function billVisit(appt: Appointment) {
  const patient = getPatient(appt.patientId)!;
  const quote = appt.quote;
  if (!quote) {
    console.warn(`[billing] appointment ${appt.id} completed without a quote`);
    return;
  }
  if (quote.patientShare > 0) charge(patient, appt.id, 'VISIT', quote.patientShare);

  if (appt.payer === 'INSURANCE' && quote.insurerShare > 0) {
    const policy = patient.insurance ?? (patient.guardianId ? getPatient(patient.guardianId)?.insurance : undefined);
    if (!policy) return;
    const claim = {
      id: newId('clm'),
      appointmentId: appt.id,
      provider: policy.provider,
      memberId: policy.memberId,
      amount: quote.insurerShare,
      status: 'SUBMITTED' as const,
      createdAt: iso(now()),
    };
    db.claims.set(claim.id, claim);
  }
}

export function invoicesFor(patientIds: string[]) {
  return all(db.invoices)
    .filter((i) => patientIds.includes(i.billedPatientId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
