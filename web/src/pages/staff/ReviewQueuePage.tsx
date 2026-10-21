import { useState } from 'react';
import { staffApi } from '../../api/endpoints';
import type { AppointmentView } from '../../api/types';
import ErrorBanner from '../../components/ErrorBanner';
import { useApi } from '../../hooks/useApi';
import {
  formatDateTime,
  formatMoney,
  REVIEW_REASON_LABELS,
  SPECIALTY_LABELS,
  TYPE_LABELS,
} from '../../utils/format';

export default function ReviewQueuePage() {
  const { data, error, loading, setData } = useApi(() => staffApi.reviewQueue(), []);
  const [notice, setNotice] = useState<string | null>(null);

  function handleDone(appointment: AppointmentView, decision: 'APPROVE' | 'REJECT') {
    setData((prev) => (prev ? { appointments: prev.appointments.filter((a) => a.id !== appointment.id) } : prev));
    setNotice(`${decision === 'APPROVE' ? 'Approved' : 'Rejected'} booking for ${appointment.patientName}.`);
  }

  const queue = [...(data?.appointments ?? [])].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="stack">
      <h1>Review queue</h1>
      <p className="muted">
        Bookings that need a decision before they’re confirmed. Anything still pending close to its start time is
        cancelled automatically.
      </p>

      {notice && (
        <p className="banner banner-success" role="status">
          {notice}
        </p>
      )}
      <ErrorBanner error={error} />

      {loading ? (
        <p className="muted" role="status">
          Loading…
        </p>
      ) : queue.length === 0 ? (
        <p className="card muted">Nothing to review.</p>
      ) : (
        queue.map((a) => <ReviewCard key={a.id} appointment={a} onDone={handleDone} />)
      )}
    </div>
  );
}

interface ReviewCardProps {
  appointment: AppointmentView;
  onDone: (appointment: AppointmentView, decision: 'APPROVE' | 'REJECT') => void;
}

function ReviewCard({ appointment: a, onDone }: ReviewCardProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const noteId = `note-${a.id}`;

  async function decide(decision: 'APPROVE' | 'REJECT') {
    setBusy(true);
    setError(null);
    try {
      await staffApi.review(a.id, decision, note.trim() || undefined);
      onDone(a, decision);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <article className="card">
      <div className="section-header">
        <h2>{a.patientName}</h2>
        {a.reviewReason && <span className="badge status-pending-review">{REVIEW_REASON_LABELS[a.reviewReason]}</span>}
      </div>
      <dl className="details">
        <div>
          <dt>Visit</dt>
          <dd>
            {SPECIALTY_LABELS[a.specialty]} · {TYPE_LABELS[a.type]}
          </dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{formatDateTime(a.start)}</dd>
        </div>
        <div>
          <dt>With</dt>
          <dd>{a.practitionerName}</dd>
        </div>
        {a.quote && (
          <div>
            <dt>Price</dt>
            <dd>
              {formatMoney(a.quote.patientShare)} patient
              {a.quote.insurerShare > 0 && ` + ${formatMoney(a.quote.insurerShare)} insurer`}
              {' · '}
              {a.payer === 'INSURANCE' ? 'insurance' : 'self-pay'}
            </dd>
          </div>
        )}
      </dl>

      <div className="field">
        <label htmlFor={noteId}>Note to patient (optional)</label>
        <textarea id={noteId} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <ErrorBanner error={error} />
      <div className="actions">
        <button type="button" className="btn btn-danger-outline" onClick={() => decide('REJECT')} disabled={busy}>
          Reject
        </button>
        <button type="button" className="btn btn-primary" onClick={() => decide('APPROVE')} disabled={busy}>
          Approve
        </button>
      </div>
    </article>
  );
}
