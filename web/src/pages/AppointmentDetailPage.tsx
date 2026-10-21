import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { appointmentApi } from '../api/endpoints';
import type { AppointmentStatus, AppointmentView, Slot } from '../api/types';
import CancelDialog from '../components/CancelDialog';
import ErrorBanner from '../components/ErrorBanner';
import PriceQuote from '../components/PriceQuote';
import SlotPicker from '../components/SlotPicker';
import StatusBadge from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import { useNow } from '../hooks/useNow';
import {
  formatDateTime,
  formatMoney,
  formatTime,
  REVIEW_REASON_LABELS,
  SPECIALTY_LABELS,
  TYPE_LABELS,
} from '../utils/format';

const CHECKIN_OPENS_MIN = 30;
const CHECKIN_CLOSES_MIN = 15;
const CANCELLABLE: AppointmentStatus[] = ['HELD', 'PENDING_REVIEW', 'CONFIRMED'];

interface DetailState {
  booked?: AppointmentStatus;
  rescheduled?: { fee: number; courtesyUsed: boolean };
}

function bookingBanner(state: DetailState | null): { tone: string; text: string } | null {
  if (state?.booked === 'CONFIRMED') return { tone: 'success', text: 'Booked!' };
  if (state?.booked === 'PENDING_REVIEW') return { tone: 'info', text: 'Your booking is awaiting review by the clinic' };
  if (state?.rescheduled) {
    const { fee, courtesyUsed } = state.rescheduled;
    if (fee > 0) return { tone: 'warning', text: `Rescheduled. A late reschedule fee of ${formatMoney(fee)} was charged.` };
    if (courtesyUsed) return { tone: 'success', text: 'Rescheduled free of charge using your yearly courtesy reschedule.' };
    return { tone: 'success', text: 'Rescheduled.' };
  }
  return null;
}

export default function AppointmentDetailPage() {
  const { id = '' } = useParams();
  // keyed so a reschedule (new id) starts from fresh state
  return <AppointmentDetail key={id} id={id} />;
}

function AppointmentDetail({ id }: { id: string }) {
  const location = useLocation();
  const banner = bookingBanner(location.state as DetailState | null);
  const now = useNow(30_000);

  const { data, error, loading, setData } = useApi(() => appointmentApi.get(id), [id]);
  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  if (loading && !data) {
    return (
      <p className="muted" role="status">
        Loading appointment…
      </p>
    );
  }
  if (!data) return <ErrorBanner error={error} />;

  const appt = data.appointment;
  const start = new Date(appt.start).getTime();
  const canCheckIn =
    appt.status === 'CONFIRMED' &&
    now >= start - CHECKIN_OPENS_MIN * 60_000 &&
    now <= start + CHECKIN_CLOSES_MIN * 60_000;

  function patch(update: Partial<AppointmentView>) {
    setData((prev) => (prev ? { appointment: { ...prev.appointment, ...update } } : prev));
  }

  async function handleCheckIn() {
    setCheckingIn(true);
    setActionError(null);
    try {
      const res = await appointmentApi.checkIn(appt.id);
      patch(res.appointment);
      if (res.joinUrl) setJoinUrl(res.joinUrl);
      setNotice('You’re checked in.');
    } catch (err) {
      setActionError(err);
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <div className="stack">
      <p>
        <Link to="/appointments">‹ All appointments</Link>
      </p>

      {banner && (
        <p className={`banner banner-${banner.tone}`} role="status">
          {banner.text}
        </p>
      )}
      {notice && (
        <p className="banner banner-success" role="status">
          {notice}
        </p>
      )}

      <section className="card">
        <div className="section-header">
          <h1>
            {SPECIALTY_LABELS[appt.specialty]} · {TYPE_LABELS[appt.type]}
          </h1>
          <StatusBadge status={appt.status} />
        </div>

        <dl className="details">
          <div>
            <dt>When</dt>
            <dd>
              {formatDateTime(appt.start)} – {formatTime(appt.end)}
            </dd>
          </div>
          <div>
            <dt>With</dt>
            <dd>{appt.practitionerName}</dd>
          </div>
          <div>
            <dt>Patient</dt>
            <dd>{appt.patientName}</dd>
          </div>
          {appt.payer && (
            <div>
              <dt>Payment</dt>
              <dd>{appt.payer === 'INSURANCE' ? 'Insurance' : 'Self-pay'}</dd>
            </div>
          )}
        </dl>

        {appt.status === 'HELD' && (
          <p className="banner banner-info">
            This time is on hold for you. <Link to={`/book/review/${appt.id}`}>Finish booking</Link>
          </p>
        )}
        {appt.status === 'PENDING_REVIEW' && (
          <p className="banner banner-info">
            The clinic is reviewing this booking
            {appt.reviewReason ? ` (${REVIEW_REASON_LABELS[appt.reviewReason].toLowerCase()})` : ''}. We’ll let you know
            once it’s confirmed.
          </p>
        )}
        {appt.status === 'CANCELLED' && (
          <p className="muted">
            Cancelled{appt.cancelledBy === 'CLINIC' ? ' by the clinic' : ''}
            {appt.cancelledAt ? ` on ${formatDateTime(appt.cancelledAt)}` : ''}
            {appt.cancelReason ? ` · ${appt.cancelReason}` : ''}
          </p>
        )}
        {appt.reviewNote && <p className="muted">Note from the clinic: {appt.reviewNote}</p>}

        {appt.type === 'TELEHEALTH' && joinUrl && (
          <p className="banner banner-success">
            <a href={joinUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
              Join video consultation
            </a>
          </p>
        )}

        <ErrorBanner error={actionError} onDismiss={() => setActionError(null)} />

        <div className="actions">
          {canCheckIn && (
            <button type="button" className="btn btn-primary" onClick={handleCheckIn} disabled={checkingIn}>
              {checkingIn ? 'Checking in…' : 'Check in'}
            </button>
          )}
          {appt.status === 'CONFIRMED' && (
            <button type="button" className="btn btn-secondary" onClick={() => setShowReschedule((v) => !v)}>
              {showReschedule ? 'Close reschedule' : 'Reschedule'}
            </button>
          )}
          {CANCELLABLE.includes(appt.status) && (
            <button type="button" className="btn btn-danger-outline" onClick={() => setShowCancel(true)}>
              Cancel appointment
            </button>
          )}
        </div>
      </section>

      {showReschedule && appt.status === 'CONFIRMED' && <ReschedulePanel appointment={appt} />}

      {appt.quote && (
        <section className="card">
          <h2>Price</h2>
          <PriceQuote quote={appt.quote} />
        </section>
      )}

      {appt.notes && (
        <section className="card">
          <h2>Visit notes</h2>
          <p className="pre-line">{appt.notes}</p>
        </section>
      )}

      {showCancel && (
        <CancelDialog
          appointment={appt}
          onClose={() => setShowCancel(false)}
          onCancelled={(cancelled, fee) => {
            setShowCancel(false);
            patch(cancelled);
            setNotice(fee > 0 ? `Appointment cancelled. Late cancellation fee: ${formatMoney(fee)}.` : 'Appointment cancelled.');
          }}
        />
      )}
    </div>
  );
}

function ReschedulePanel({ appointment }: { appointment: AppointmentView }) {
  const navigate = useNavigate();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    if (!slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await appointmentApi.reschedule(appointment.id, slot.start);
      navigate(`/appointments/${res.appointment.id}`, {
        replace: true,
        state: { rescheduled: { fee: res.fee, courtesyUsed: res.courtesyUsed } },
      });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h2>Pick a new time</h2>
      <p className="muted">
        Same practitioner and visit type. You can reschedule once a year within 24 hours at no charge.
      </p>
      <SlotPicker
        practitionerId={appointment.practitionerId}
        type={appointment.type}
        selectedStart={slot?.start}
        disabled={submitting}
        onPick={setSlot}
      />
      <ErrorBanner error={error} />
      {slot && (
        <div className="actions">
          <span>
            Move to <strong>{formatDateTime(slot.start)}</strong>?
          </span>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Rescheduling…' : 'Confirm new time'}
          </button>
        </div>
      )}
    </section>
  );
}
