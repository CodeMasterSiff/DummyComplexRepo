import { Router } from 'express';
import * as auth from '../services/authService';
import { requireAuth } from '../middleware/auth';
import { handler } from '../middleware/errors';

const router = Router();

router.post(
  '/signup',
  handler(async (req, res) => {
    const user = await auth.signup(req.body);
    res.status(201).json({ user });
  }),
);

router.post(
  '/verify-email',
  handler((req, res) => {
    auth.verifyEmail(req.body.email, String(req.body.code ?? '').trim());
    res.json({ ok: true });
  }),
);

router.post(
  '/resend-code',
  handler(async (req, res) => {
    await auth.sendVerificationCode(req.body.email);
    res.json({ ok: true });
  }),
);

router.post(
  '/login',
  handler((req, res) => {
    res.json(auth.login(req.body.email, req.body.password));
  }),
);

router.post('/logout', requireAuth, (req, res) => {
  auth.logout(req.token!);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: auth.toPublic(req.user!) });
});

export default router;
