import { Router } from 'express';
import { db, all } from '../db/store';
import { requireAuth } from '../middleware/auth';
import { handler } from '../middleware/errors';
import { firstAvailable, listSlots } from '../services/availabilityService';
import { AppointmentType, Specialty } from '../domain/types';
import { badRequest } from '../domain/errors';
import { addDays, now, startOfDayUTC } from '../utils/time';

const router = Router();

const SPECIALTIES = [
  { code: 'GP', name: 'General practice', telehealth: true },
  { code: 'PHYSIO', name: 'Physiotherapy', telehealth: false },
  { code: 'DERMATOLOGY', name: 'Dermatology', telehealth: true },
  { code: 'CARDIOLOGY', name: 'Cardiology', telehealth: false },
];

router.get('/specialties', (_req, res) => {
  res.json({ specialties: SPECIALTIES });
});

router.get('/practitioners', (req, res) => {
  const specialty = req.query.specialty as string | undefined;
  const practitioners = all(db.practitioners).filter((p) => !specialty || p.specialty === specialty);
  res.json({ practitioners });
});

router.get(
  '/availability',
  requireAuth,
  handler((req, res) => {
    const { practitionerId, type, from, to } = req.query as Record<string, string>;
    if (!practitionerId || !type) throw badRequest('VALIDATION', 'practitionerId and type are required');
    const fromDate = from ? new Date(from) : startOfDayUTC(now());
    const toDate = to ? new Date(to) : addDays(fromDate, 6);
    res.json({ slots: listSlots(practitionerId, type as AppointmentType, fromDate, toDate) });
  }),
);

router.get(
  '/availability/first',
  requireAuth,
  handler((req, res) => {
    const { specialty, type } = req.query as Record<string, string>;
    if (!specialty || !type) throw badRequest('VALIDATION', 'specialty and type are required');
    res.json({ slot: firstAvailable(specialty as Specialty, type as AppointmentType) });
  }),
);

export default router;
