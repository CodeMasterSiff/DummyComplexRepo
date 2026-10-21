import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { handler } from '../middleware/errors';
import { reviewQueue, scheduleFor, toView } from '../services/appointmentQueries';
import { createHold } from '../services/bookingService';
import { cancelByClinic, closeDay } from '../services/cancellationService';
import { checkIn } from '../services/checkInService';
import { completeAppointment } from '../services/completionService';
import { reviewAppointment } from '../services/reviewService';
import { searchPatients } from '../services/patientService';
import { badRequest } from '../domain/errors';
import { dateKey, now } from '../utils/time';

const router = Router();
const staffOnly = requireRole('STAFF');

router.get('/review-queue', staffOnly, (_req, res) => {
  res.json({ appointments: reviewQueue() });
});

router.post(
  '/appointments/:id/review',
  staffOnly,
  handler(async (req, res) => {
    const appt = await reviewAppointment(req.params.id, req.body.decision, req.body.note);
    res.json({ appointment: toView(appt) });
  }),
);

router.get('/schedule', requireRole('STAFF', 'PRACTITIONER'), (req, res) => {
  const date = (req.query.date as string) || dateKey(now());
  let practitionerId = req.query.practitionerId as string | undefined;
  if (req.user!.role === 'PRACTITIONER' && !practitionerId) practitionerId = req.user!.practitionerId;
  res.json({ appointments: scheduleFor(date, practitionerId) });
});

router.get('/patients', staffOnly, (req, res) => {
  res.json({ patients: searchPatients(req.query.q as string) });
});

router.post(
  '/appointments/hold',
  staffOnly,
  handler((req, res) => {
    const { patientId, practitionerId, type, start, overrideBlock } = req.body;
    if (!patientId) throw badRequest('PATIENT_REQUIRED');
    const appt = createHold(req.user!, { patientId, practitionerId, type, start }, { overrideBlock: !!overrideBlock });
    res.status(201).json({ appointment: toView(appt) });
  }),
);

router.post(
  '/appointments/:id/cancel',
  staffOnly,
  handler(async (req, res) => {
    const appt = await cancelByClinic(req.params.id, req.body?.reason);
    res.json({ appointment: toView(appt) });
  }),
);

router.post(
  '/appointments/:id/check-in',
  staffOnly,
  handler((req, res) => {
    const { appointment, joinUrl } = checkIn(req.user!, req.params.id);
    res.json({ appointment: toView(appointment), joinUrl });
  }),
);

router.post(
  '/appointments/:id/complete',
  requireRole('PRACTITIONER'),
  handler(async (req, res) => {
    const { appointment, referral } = await completeAppointment(req.user!, req.params.id, req.body ?? {});
    res.json({ appointment: toView(appointment), referral });
  }),
);

router.post(
  '/closures',
  staffOnly,
  handler(async (req, res) => {
    res.status(201).json(await closeDay(req.body));
  }),
);

export default router;
