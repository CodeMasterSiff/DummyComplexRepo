import { useState, type FormEvent } from 'react';
import { catalogApi, staffApi } from '../../api/endpoints';
import type { AppointmentStatus, AppointmentView, Specialty } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import ErrorBanner from '../../components/ErrorBanner';
import StatusBadge from '../../components/StatusBadge';
import { useApi } from '../../hooks/useApi';
import { formatCalendarDate, formatTime, SPECIALTY_LABELS, TYPE_LABELS, todayIso } from '../../utils/format';

const CLINIC_CANCELLABLE: AppointmentStatus[] = ['HELD', 'PENDING_REVIEW', 'CONFIRMED'];
const REFERRAL_SPECIALTIES: Specialty[] = ['PHYSIO', 'DERMATOLOGY', 'CARDIOLOGY'];

export default function SchedulePage() {
  const { user } = useAuth();
  const isStaff = user?.role === 'STAFF';
  const [date, setDate] = useState(todayIso());
  const [practitionerId, setPractitionerId] = useState(user?.role === 'PRACTITIONER' ? (user.practitionerId ?? '') : '');
  const [notice, setNotice] = useState<string | null>(null);

  const practitioners = useApi(() => catalogApi.practitioners(), []);
  const schedule = useApi(() => staffApi.schedule(date, practitionerId || undefined), [date, practitionerId]);

  const appointments = [...(schedule.data?.appointments ?? [])].sort((a, b) => a.start.localeCompare(b.start));

  function handleChanged(message: string) {
    setNotice(message);
    schedule.reload();
  }

  return (
    <div className="stack">
      <h1>Schedule</h1>

      <div className="toolbar">
        <div className="field">
          <label htmlFor="schedule-date">Date</label>
          <input id="schedule-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="schedule-practitioner">Practitioner</label>
          <select
            id="schedule-practitioner"
            value={practitionerId}
            onChange={(e) => setPractitionerId(e.target.value)}
          >
            <option value="">All practitioners</option>
            {practitioners.data?.practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({SPECIALTY_LABELS[p.specialty]})
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice && (
        <p className="banner banner-success" role="status">
          {notice}
        </p>
      )}
      <ErrorBanner error={schedule.error} />

      <section className="card">
        <h2>{formatCalendarDate(date)}</h2>
        {schedule.loading && !schedule.data ? (
          <p className="muted" role="status">
            Loading schedule…
          </p>
        ) : appointments.length === 0 ? (
          <p className="muted">No appointments on this day.</p>
        ) : (
          <ul className="list">
            {appointments.map((a) => (
              <ScheduleRow
                key={a.id}
                appointment={a}
                isStaff={isStaff}
                canComplete={
                  user?.role === 'PRACTITIONER' && a.practitionerId === user.practitionerId && a.status === 'CHECKED_IN'
                }
                onChanged={handleChanged}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface RowProps {
  appointment: AppointmentView;
  isStaff: boolean;
  canComplete: boolean;
  onChanged: (message: string) => void;
}

function ScheduleRow({ appointment: a, isStaff, canComplete, onChanged }: RowProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged(message);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function handleCancel(e: FormEvent) {
    e.preventDefault();
    run(() => staffApi.cancel(a.id, reason.trim()), `Cancelled ${a.patientName}’s appointment. The patient has been notified.`);
  }

  return (
    <li className="list-item list-item-stacked">
      <div className="list-row">
        <div>
          <span className="list-title tabular">
            {formatTime(a.start)}–{formatTime(a.end)}
          </span>{' '}
          <span>{a.patientName}</span>
          <p className="muted">
            {a.practitionerName} · {SPECIALTY_LABELS[a.specialty]} · {TYPE_LABELS[a.type]}
          </p>
        </div>
        <div className="row-actions">
          <StatusBadge status={a.status} />
          {isStaff && a.status === 'CONFIRMED' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => run(() => staffApi.checkIn(a.id), `${a.patientName} is checked in.`)}
            >
              Check in
            </button>
          )}
          {isStaff && CLINIC_CANCELLABLE.includes(a.status) && !cancelling && (
            <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setCancelling(true)}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {cancelling && (
        <form className="inline-form" onSubmit={handleCancel}>
          <div className="field">
            <label htmlFor={`reason-${a.id}`}>Reason for clinic cancellation</label>
            <input id={`reason-${a.id}`} value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          <div className="actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCancelling(false)}>
              Keep
            </button>
            <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
              Cancel appointment
            </button>
          </div>
        </form>
      )}

      {canComplete && <CompleteVisitForm appointment={a} onCompleted={onChanged} />}

      <ErrorBanner error={error} onDismiss={() => setError(null)} />
    </li>
  );
}

function CompleteVisitForm({
  appointment,
  onCompleted,
}: {
  appointment: AppointmentView;
  onCompleted: (message: string) => void;
}) {
  const [notes, setNotes] = useState('');
  const [followUpDays, setFollowUpDays] = useState('');
  const [issueReferral, setIssueReferral] = useState(false);
  const [toSpecialty, setToSpecialty] = useState<Specialty>('DERMATOLOGY');
  const [visits, setVisits] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const id = appointment.id;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await staffApi.complete(id, {
        notes: notes.trim(),
        followUpInDays: followUpDays ? Number(followUpDays) : undefined,
        referral: issueReferral
          ? { toSpecialty, visitsAllowed: visits ? Number(visits) : undefined }
          : undefined,
      });
      onCompleted(
        res.referral
          ? `Visit completed. Referral to ${SPECIALTY_LABELS[res.referral.toSpecialty]} issued.`
          : 'Visit completed.',
      );
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <form className="inline-form complete-form" onSubmit={handleSubmit}>
      <h3>Complete visit</h3>
      <div className="field">
        <label htmlFor={`notes-${id}`}>Visit notes</label>
        <textarea id={`notes-${id}`} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor={`followup-${id}`}>Suggest follow-up in (days)</label>
        <input
          id={`followup-${id}`}
          type="number"
          min={1}
          inputMode="numeric"
          value={followUpDays}
          onChange={(e) => setFollowUpDays(e.target.value)}
        />
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={issueReferral} onChange={(e) => setIssueReferral(e.target.checked)} />
        Refer to a specialist
      </label>
      {issueReferral && (
        <div className="field-row">
          <div className="field">
            <label htmlFor={`ref-specialty-${id}`}>Specialty</label>
            <select
              id={`ref-specialty-${id}`}
              value={toSpecialty}
              onChange={(e) => setToSpecialty(e.target.value as Specialty)}
            >
              {REFERRAL_SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {SPECIALTY_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`ref-visits-${id}`}>Visits</label>
            <input
              id={`ref-visits-${id}`}
              type="number"
              min={1}
              inputMode="numeric"
              value={visits}
              onChange={(e) => setVisits(e.target.value)}
              aria-describedby={`ref-visits-hint-${id}`}
            />
            <p id={`ref-visits-hint-${id}`} className="hint">
              Leave empty for the standard number.
            </p>
          </div>
        </div>
      )}
      <ErrorBanner error={error} />
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Complete visit'}
        </button>
      </div>
    </form>
  );
}
