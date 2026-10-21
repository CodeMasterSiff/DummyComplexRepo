import { useState, type FormEvent } from 'react';
import { catalogApi, staffApi } from '../../api/endpoints';
import ErrorBanner from '../../components/ErrorBanner';
import { useApi } from '../../hooks/useApi';
import { formatCalendarDate, todayIso } from '../../utils/format';

export default function ClosuresPage() {
  const { data } = useApi(() => catalogApi.practitioners(), []);
  const practitioners = data?.practitioners ?? [];

  const [date, setDate] = useState(todayIso());
  const [practitionerId, setPractitionerId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const who = practitioners.find((p) => p.id === practitionerId)?.name ?? 'the whole clinic';
    const ok = window.confirm(
      `Close ${formatCalendarDate(date)} for ${who}? All bookings that day will be cancelled and patients notified.`,
    );
    if (!ok) return;

    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const res = await staffApi.closeDay({ date, practitionerId: practitionerId || undefined, reason: reason.trim() });
      setResult(
        `${formatCalendarDate(res.closure.date)} closed for ${who}. ${res.cancelledCount} appointment${
          res.cancelledCount === 1 ? ' was' : 's were'
        } cancelled.`,
      );
      setReason('');
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack narrow">
      <h1>Close a day</h1>
      <p className="muted">
        Use this for sick days, holidays or building issues. Existing bookings on that date are cancelled by the clinic
        with no fee, and the patients are moved to the front of the waitlist.
      </p>

      {result && (
        <p className="banner banner-success" role="status">
          {result}
        </p>
      )}

      <section className="card">
        <form className="form" onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="field">
              <label htmlFor="closure-date">Date</label>
              <input
                id="closure-date"
                type="date"
                min={todayIso()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="closure-practitioner">Who</label>
              <select
                id="closure-practitioner"
                value={practitionerId}
                onChange={(e) => setPractitionerId(e.target.value)}
              >
                <option value="">Whole clinic</option>
                {practitioners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="closure-reason">Reason</label>
            <input id="closure-reason" value={reason} onChange={(e) => setReason(e.target.value)} required />
          </div>
          <ErrorBanner error={error} />
          <div className="actions">
            <button type="submit" className="btn btn-danger" disabled={saving}>
              {saving ? 'Closing…' : 'Close day'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
