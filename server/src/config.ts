export const config = {
  port: Number(process.env.PORT ?? 4000),
  clinicName: 'Northside Health Centre',

  HOLD_MINUTES: 15, // how long a slot is held while the patient completes the booking

  bookingHorizonDays: 60,
  minLeadMinutes: 120,
  telehealthMinLeadMinutes: 30,

  lateCancelHours: 24,
  lateCancelMinFee: 1500,
  courtesyRescheduleDays: 365,

  checkInOpensMinutes: 30,
  noShowGraceMinutes: 15,
  noShowFee: 4000,
  strikeLimit: 3,
  strikeWindowDays: 180,
  blockDays: 30,

  waitlistOfferMinutes: 30,
  waitlistMaxIgnoredOffers: 3,
  clinicCancelWaitlistDays: 14,

  referralValidDays: 90,
  defaultReferralVisits: 3,
  pendingReviewCutoffMinutes: 120,

  quietHours: { start: 21, end: 8 },
  sessionHours: 12,
  insuranceTimeoutMs: 3000,
  telehealthBaseUrl: 'https://meet.northside.example/r/',
  webBaseUrl: process.env.WEB_BASE_URL ?? 'http://localhost:5173',
};

export const FEATURES = {
  LEGACY_STRIKES: process.env.LEGACY_STRIKES === '1',
  WAITLIST: process.env.WAITLIST !== '0',
};
