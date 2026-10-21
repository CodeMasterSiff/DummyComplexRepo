import { db, all, getPatient, getPractitioner } from '../db/store';
import { config, FEATURES } from '../config';
import { Appointment, AppointmentType, Practitioner, Specialty, User, WaitlistEntry, WaitlistOffer } from '../domain/types';
import { DomainError, badRequest, notFound } from '../domain/errors';
import { assertBookable } from './availabilityService';
import { isBlocked, patientForActor } from './patientService';
import { createHold } from './bookingService';
import { notify } from './notificationService';
import { newId, newToken } from '../utils/ids';
import { addDays, addMinutes, iso, minutesUntil, now } from '../utils/time';

const SPECIALTIES: Specialty[] = ['GP', 'PHYSIO', 'DERMATOLOGY', 'CARDIOLOGY'];

interface FreedSlot {
  practitionerId: string;
  start: string;
  excludePatientId?: string;
}

export function joinWaitlist(
  user: User,
  input: {
    patientId?: string;
    practitionerId?: string;
    specialty: Specialty;
    anyPractitioner?: boolean;
    type: AppointmentType;
    earliest: string;
    latest: string;
  },
) {
  if (!FEATURES.WAITLIST) throw badRequest('WAITLIST_DISABLED');
  const patient = patientForActor(user, input.patientId);
  if (!SPECIALTIES.includes(input.specialty)) throw badRequest('VALIDATION', 'Unknown specialty');
  if (input.practitionerId) {
    const pr = getPractitioner(input.practitionerId);
    if (!pr || pr.specialty !== input.specialty) throw badRequest('VALIDATION', 'Practitioner does not match specialty');
  } else if (!input.anyPractitioner) {
    throw badRequest('VALIDATION', 'Choose a practitioner or allow any practitioner');
  }
  const earliest = new Date(input.earliest);
  const latest = new Date(input.latest);
  if (isNaN(earliest.getTime()) || isNaN(latest.getTime()) || latest <= earliest) {
    throw badRequest('VALIDATION', 'Invalid date range');
  }

  const entry: WaitlistEntry = {
    id: newId('wl'),
    patientId: patient.id,
    practitionerId: input.practitionerId,
    specialty: input.specialty,
    anyPractitioner: !!input.anyPractitioner,
    type: input.type,
    earliest: iso(earliest),
    latest: iso(latest),
    priority: 2,
    status: 'ACTIVE',
    ignoredOffers: 0,
    createdAt: iso(now()),
  };
  db.waitlist.set(entry.id, entry);
  return entry;
}

export function enrollPriority(appt: Appointment) {
  if (!FEATURES.WAITLIST) return;
  const entry: WaitlistEntry = {
    id: newId('wl'),
    patientId: appt.patientId,
    practitionerId: appt.practitionerId,
    specialty: appt.specialty,
    anyPractitioner: false,
    type: appt.type,
    earliest: iso(now()),
    latest: iso(addDays(now(), config.clinicCancelWaitlistDays)),
    priority: 1,
    status: 'ACTIVE',
    ignoredOffers: 0,
    createdAt: iso(now()),
  };
  db.waitlist.set(entry.id, entry);
}

export function entriesFor(patientIds: string[]) {
  return all(db.waitlist).filter((e) => patientIds.includes(e.patientId) && e.status === 'ACTIVE');
}

export function leaveWaitlist(user: User, id: string) {
  const entry = db.waitlist.get(id);
  if (!entry) throw notFound('Waitlist entry');
  patientForActor(user, entry.patientId);
  entry.status = 'REMOVED';
}

export async function releaseSlot(appt: Appointment) {
  if (!FEATURES.WAITLIST) return;
  if (minutesUntil(appt.start) < config.minLeadMinutes) return;
  await offerNext({ practitionerId: appt.practitionerId, start: appt.start, excludePatientId: appt.patientId });
}

function slotFits(pr: Practitioner, type: AppointmentType, start: Date) {
  try {
    assertBookable(pr, type, start);
    return true;
  } catch {
    return false;
  }
}

async function offerNext(slot: FreedSlot) {
  const pr = getPractitioner(slot.practitionerId);
  if (!pr) return;
  const start = new Date(slot.start);
  const sameSlot = (o: WaitlistOffer) => o.practitionerId === pr.id && o.start === slot.start;

  if (all(db.offers).some((o) => sameSlot(o) && o.status === 'OPEN')) return;
  const alreadyOffered = new Set(all(db.offers).filter(sameSlot).map((o) => o.entryId));

  const candidates = all(db.waitlist)
    .filter(
      (e) =>
        e.status === 'ACTIVE' &&
        e.patientId !== slot.excludePatientId &&
        !alreadyOffered.has(e.id) &&
        (e.practitionerId === pr.id || (e.anyPractitioner && e.specialty === pr.specialty)) &&
        start >= new Date(e.earliest) &&
        start <= new Date(e.latest),
    )
    .filter((e) => {
      const p = getPatient(e.patientId);
      return !!p && !isBlocked(p);
    })
    .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt));

  for (const entry of candidates) {
    if (!slotFits(pr, entry.type, start)) continue;
    const offer: WaitlistOffer = {
      id: newId('ofr'),
      token: newToken(),
      entryId: entry.id,
      practitionerId: pr.id,
      start: slot.start,
      status: 'OPEN',
      expiresAt: iso(addMinutes(now(), config.waitlistOfferMinutes)),
      createdAt: iso(now()),
    };
    db.offers.set(offer.id, offer);
    await notify(entry.patientId, 'WAITLIST_OFFER', {
      start: slot.start,
      practitioner: pr.name,
      link: `${config.webBaseUrl}/waitlist/claim/${offer.token}`,
    });
    return offer;
  }
}

function findOffer(token: string) {
  const offer = all(db.offers).find((o) => o.token === token);
  if (!offer) throw notFound('Offer');
  return offer;
}

export function describeOffer(token: string) {
  const offer = findOffer(token);
  const entry = db.waitlist.get(offer.entryId)!;
  return {
    offer,
    practitionerName: getPractitioner(offer.practitionerId)?.name,
    patientName: getPatient(entry.patientId)?.fullName,
    type: entry.type,
  };
}

export function claimOffer(user: User, token: string) {
  const offer = findOffer(token);
  if (offer.status !== 'OPEN' || new Date(offer.expiresAt) < now()) {
    throw new DomainError('OFFER_EXPIRED', 410, 'This offer is no longer available');
  }
  const entry = db.waitlist.get(offer.entryId)!;
  const appt = createHold(user, {
    patientId: entry.patientId,
    practitionerId: offer.practitionerId,
    type: entry.type,
    start: offer.start,
  });
  offer.status = 'CLAIMED';
  entry.status = 'FULFILLED';
  return appt;
}

export async function declineOffer(user: User, token: string) {
  const offer = findOffer(token);
  const entry = db.waitlist.get(offer.entryId)!;
  patientForActor(user, entry.patientId);
  if (offer.status !== 'OPEN') return;
  offer.status = 'DECLINED';
  await offerNext({ practitionerId: offer.practitionerId, start: offer.start });
}

export async function expireOffers() {
  const t = now();
  for (const offer of all(db.offers).filter((o) => o.status === 'OPEN' && new Date(o.expiresAt) < t)) {
    offer.status = 'EXPIRED';
    const entry = db.waitlist.get(offer.entryId);
    if (entry) {
      entry.ignoredOffers++;
      if (entry.ignoredOffers >= config.waitlistMaxIgnoredOffers) entry.status = 'REMOVED';
    }
    await offerNext({ practitionerId: offer.practitionerId, start: offer.start });
  }
}
