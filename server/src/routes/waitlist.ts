import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { handler } from '../middleware/errors';
import { householdIds } from '../services/patientService';
import { toView } from '../services/appointmentQueries';
import * as waitlist from '../services/waitlistService';

const router = Router();

// public - the token in the SMS link is enough to look at the offer
router.get(
  '/offers/:token',
  handler((req, res) => {
    res.json(waitlist.describeOffer(req.params.token));
  }),
);

router.use(requireRole('PATIENT'));

router.post(
  '/offers/:token/claim',
  handler((req, res) => {
    res.json({ appointment: toView(waitlist.claimOffer(req.user!, req.params.token)) });
  }),
);

router.post(
  '/offers/:token/decline',
  handler(async (req, res) => {
    await waitlist.declineOffer(req.user!, req.params.token);
    res.json({ ok: true });
  }),
);

router.get('/', (req, res) => {
  res.json({ entries: waitlist.entriesFor(householdIds(req.user!)) });
});

router.post(
  '/',
  handler((req, res) => {
    res.status(201).json({ entry: waitlist.joinWaitlist(req.user!, req.body) });
  }),
);

router.delete(
  '/:id',
  handler((req, res) => {
    waitlist.leaveWaitlist(req.user!, req.params.id);
    res.status(204).end();
  }),
);

export default router;
