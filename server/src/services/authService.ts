import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { db, findUserByEmail } from '../db/store';
import { config } from '../config';
import { Patient, PublicUser, User } from '../domain/types';
import { DomainError, badRequest, conflict } from '../domain/errors';
import { newId, newToken, sixDigitCode } from '../utils/ids';
import { addHours, addMinutes, ageOn, iso, now } from '../utils/time';
import { sendEmail } from '../integrations/mailer';

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`;
}

function checkPassword(pw: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(pw, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export const toPublic = ({ passwordHash, ...rest }: User): PublicUser => rest;

export async function signup(input: {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string;
  phone?: string;
}) {
  const email = (input.email ?? '').trim().toLowerCase();
  if (!email.includes('@')) throw badRequest('INVALID_EMAIL');
  if (findUserByEmail(email)) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
  if (!input.password || input.password.length < 10) throw badRequest('WEAK_PASSWORD', 'Use at least 10 characters');
  if (!input.fullName || !input.dateOfBirth) throw badRequest('VALIDATION', 'Name and date of birth are required');
  if (ageOn(input.dateOfBirth) < 18) {
    throw badRequest('MINOR_SIGNUP', 'Patients under 18 must be added by a parent or guardian');
  }

  const patient: Patient = {
    id: newId('pat'),
    fullName: input.fullName.trim(),
    dateOfBirth: input.dateOfBirth,
    email,
    phone: input.phone,
    phoneVerified: false,
    noShowCount: 0,
    createdAt: iso(now()),
  };
  const user: User = {
    id: newId('usr'),
    email,
    passwordHash: hashPassword(input.password),
    role: 'PATIENT',
    patientId: patient.id,
    emailVerified: false,
    createdAt: iso(now()),
  };
  db.patients.set(patient.id, patient);
  db.users.set(user.id, user);

  await sendVerificationCode(email);
  return toPublic(user);
}

export async function sendVerificationCode(email: string) {
  email = (email ?? '').trim().toLowerCase();
  const user = findUserByEmail(email);
  if (!user || user.emailVerified) return; // don't leak which emails exist

  const existing = db.emailVerifications.get(email);
  if (existing && Date.now() - new Date(existing.lastSentAt).getTime() < 60_000) {
    throw new DomainError('RESEND_TOO_SOON', 429, 'Please wait a minute before requesting a new code');
  }
  const code = sixDigitCode();
  db.emailVerifications.set(email, {
    email,
    code,
    attempts: 0,
    expiresAt: iso(addMinutes(now(), 15)),
    lastSentAt: iso(now()),
  });
  await sendEmail(email, 'Verify your email', `Your MediBook verification code is ${code}`);
}

export function verifyEmail(email: string, code: string) {
  email = (email ?? '').trim().toLowerCase();
  const pending = db.emailVerifications.get(email);
  if (!pending) throw badRequest('NO_PENDING_CODE', 'Request a new code');
  if (new Date(pending.expiresAt) < now()) {
    db.emailVerifications.delete(email);
    throw badRequest('CODE_EXPIRED', 'The code has expired');
  }
  if (pending.code !== code) {
    pending.attempts++;
    if (pending.attempts >= 5) {
      db.emailVerifications.delete(email);
      throw badRequest('TOO_MANY_ATTEMPTS', 'Too many attempts, request a new code');
    }
    throw badRequest('INVALID_CODE', 'That code is not correct');
  }
  const user = findUserByEmail(email)!;
  user.emailVerified = true;
  db.emailVerifications.delete(email);
}

export function login(email: string, password: string) {
  const user = findUserByEmail(email ?? '');
  if (!user || !checkPassword(password ?? '', user.passwordHash)) {
    throw new DomainError('INVALID_CREDENTIALS', 401, 'Wrong email or password');
  }
  const token = newToken();
  db.sessions.set(token, { token, userId: user.id, expiresAt: iso(addHours(now(), config.sessionHours)) });
  return { token, user: toPublic(user) };
}

export function logout(token: string) {
  db.sessions.delete(token);
}

export function userForToken(token: string) {
  const session = db.sessions.get(token);
  if (!session) return undefined;
  if (new Date(session.expiresAt) < now()) {
    db.sessions.delete(token);
    return undefined;
  }
  return db.users.get(session.userId);
}
