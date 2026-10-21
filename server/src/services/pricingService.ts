import { AppointmentType, Patient, Payer, Plan, Quote, Specialty } from '../domain/types';

const BASE_PRICES: Record<Specialty, number> = {
  GP: 6000,
  PHYSIO: 7500,
  DERMATOLOGY: 11000,
  CARDIOLOGY: 16000,
};

export const PLAN_COPAY: Record<Plan, number> = {
  BASIC: 0.3,
  PLUS: 0.15,
  PREMIUM: 0,
};

interface QuoteInput {
  specialty: Specialty;
  type: AppointmentType;
  payer: Payer;
  plan?: Plan;
  patient: Patient;
  payerReason?: string;
  capExceeded?: boolean;
}

export function buildQuote(input: QuoteInput): Quote {
  const basePrice = BASE_PRICES[input.specialty];
  let listPrice = basePrice;
  if (input.type === 'FOLLOW_UP') listPrice = Math.round(listPrice * 0.7);

  if (input.payer === 'SELF_PAY' || !input.plan) {
    if (input.type === 'TELEHEALTH') listPrice = Math.round(listPrice * 0.8);
    return {
      basePrice,
      listPrice,
      patientShare: listPrice,
      insurerShare: 0,
      payer: 'SELF_PAY',
      payerReason: input.payerReason,
      capExceeded: input.capExceeded,
      currency: 'EUR',
    };
  }

  let copay = PLAN_COPAY[input.plan];
  // kids see the GP for free
  const age = new Date().getFullYear() - new Date(input.patient.dateOfBirth).getFullYear();
  if (input.specialty === 'GP' && age < 18) copay = 0;

  const patientShare = Math.round(listPrice * copay);
  return {
    basePrice,
    listPrice,
    patientShare,
    insurerShare: listPrice - patientShare,
    payer: 'INSURANCE',
    currency: 'EUR',
  };
}
