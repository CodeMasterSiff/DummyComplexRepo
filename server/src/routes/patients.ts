import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { handler } from '../middleware/errors';
import * as patients from '../services/patientService';
import { referralsFor } from '../services/referralService';
import { invoicesFor } from '../services/billingService';

const router = Router();
router.use(requireRole('PATIENT'));

router.get(
  '/me',
  handler((req, res) => {
    const patient = patients.patientForActor(req.user!);
    res.json({ patient, dependents: patients.dependentsOf(patient.id) });
  }),
);

router.put(
  '/me/insurance',
  handler((req, res) => {
    res.json({ patient: patients.setInsurance(req.user!, req.body) });
  }),
);

router.put(
  '/me/phone',
  handler(async (req, res) => {
    await patients.startPhoneVerification(req.user!, req.body.phone);
    res.json({ ok: true });
  }),
);

router.post(
  '/me/phone/verify',
  handler((req, res) => {
    res.json({ patient: patients.confirmPhone(req.user!, String(req.body.code ?? '')) });
  }),
);

router.post(
  '/me/dependents',
  handler((req, res) => {
    res.status(201).json({ patient: patients.addDependent(req.user!, req.body) });
  }),
);

router.get('/me/referrals', (req, res) => {
  res.json({ referrals: referralsFor(patients.householdIds(req.user!)) });
});

router.get('/me/invoices', (req, res) => {
  res.json({ invoices: invoicesFor(patients.householdIds(req.user!)) });
});

export default router;
