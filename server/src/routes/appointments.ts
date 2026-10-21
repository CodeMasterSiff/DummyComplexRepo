import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { handler } from '../middleware/errors';
import { getAppointmentForActor, householdAppointments, toView } from '../services/appointmentQueries';
import { confirmBooking, createHold, previewQuote } from '../services/bookingService';
import { cancelByPatient, reschedule } from '../services/cancellationService';
import { checkIn } from '../services/checkInService';
import { Payer } from '../domain/types';

const router = Router();
router.use(requireAuth);

router.get('/', requireRole('PATIENT'), (req, res) => {
  res.json({ appointments: householdAppointments(req.user!) });
});

router.get(
  '/:id',
  handler((req, res) => {
    res.json({ appointment: toView(getAppointmentForActor(req.user!, req.params.id)) });
  }),
);

router.post(
  '/hold',
  requireRole('PATIENT'),
  handler((req, res) => {
    const { patientId, practitionerId, type, start } = req.body;
    const appt = createHold(req.user!, { patientId, practitionerId, type, start });
    res.status(201).json({ appointment: toView(appt) });
  }),
);

router.get(
  '/:id/quote',
  handler((req, res) => {
    const payer = (req.query.payer as Payer) ?? 'INSURANCE';
    res.json(previewQuote(req.user!, req.params.id, payer));
  }),
);

router.post(
  '/:id/confirm',
  requireRole('PATIENT', 'STAFF'),
  handler(async (req, res) => {
    const appt = await confirmBooking(req.user!, req.params.id, req.body);
    res.json({ appointment: toView(appt) });
  }),
);

router.post(
  '/:id/cancel',
  requireRole('PATIENT'),
  handler(async (req, res) => {
    const { appointment, fee } = await cancelByPatient(req.user!, req.params.id, req.body?.reason);
    res.json({ appointment: toView(appointment), fee });
  }),
);

router.post(
  '/:id/reschedule',
  requireRole('PATIENT'),
  handler(async (req, res) => {
    const result = await reschedule(req.user!, req.params.id, req.body.start);
    res.json({ ...result, appointment: toView(result.appointment) });
  }),
);

router.post(
  '/:id/check-in',
  requireRole('PATIENT'),
  handler((req, res) => {
    const { appointment, joinUrl } = checkIn(req.user!, req.params.id);
    res.json({ appointment: toView(appointment), joinUrl });
  }),
);

export default router;
