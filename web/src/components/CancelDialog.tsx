import { useEffect, useId, useRef, useState } from 'react';
import { appointmentApi } from '../api/endpoints';
import type { Appointment, AppointmentView } from '../api/types';
import { formatDateTime, formatMoney, TYPE_LABELS } from '../utils/format';
import ErrorBanner from './ErrorBanner';

const LATE_CANCEL_HOURS = 24;

interface Props {
  appointment: AppointmentView;
  onClose: () => void;
  onCancelled: (appointment: Appointment, fee: number) => void;
}

export default function CancelDialog({ appointment, onClose, onCancelled }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<{ appointment: Appointment; fee: number } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const hoursUntilStart = (new Date(appointment.start).getTime() - Date.now()) / 3_600_000;
  const lateCancel = appointment.status === 'CONFIRMED' && hoursUntilStart < LATE_CANCEL_HOURS;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await appointmentApi.cancel(appointment.id, reason.trim() || undefined);
      setResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (result) onCancelled(result.appointment, result.fee);
    else onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!submitting) handleClose();
      }}
    >
      {result ? (
        <>
          <h2 id={titleId}>Appointment cancelled</h2>
          {result.fee > 0 ? (
            <p>
              A late cancellation fee of <strong>{formatMoney(result.fee)}</strong> has been added to your invoices.
            </p>
          ) : (
            <p>No cancellation fee was charged.</p>
          )}
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={handleClose} autoFocus>
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 id={titleId}>Cancel this appointment?</h2>
          <p>
            {TYPE_LABELS[appointment.type]} with {appointment.practitionerName} on{' '}
            <strong>{formatDateTime(appointment.start)}</strong>
          </p>

          {lateCancel && (
            <p className="banner banner-warning">
              Cancelling less than 24 hours before your appointment incurs a late cancellation fee of at least €15.
            </p>
          )}

          <div className="field">
            <label htmlFor={reasonId}>Reason (optional)</label>
            <textarea id={reasonId} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <ErrorBanner error={error} />

          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting} autoFocus>
              Keep appointment
            </button>
            <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={submitting}>
              {submitting ? 'Cancelling…' : 'Cancel appointment'}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
