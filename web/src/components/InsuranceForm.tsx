import { useId, useState, type FormEvent } from 'react';
import type { InsurancePolicy, Plan } from '../api/types';
import { PLAN_LABELS, todayIso } from '../utils/format';
import ErrorBanner from './ErrorBanner';

interface Props {
  initial?: InsurancePolicy;
  submitLabel?: string;
  onSubmit: (policy: InsurancePolicy) => Promise<void>;
  onCancel?: () => void;
}

const PLANS: Plan[] = ['BASIC', 'PLUS', 'PREMIUM'];

export default function InsuranceForm({ initial, submitLabel = 'Save insurance', onSubmit, onCancel }: Props) {
  const id = useId();
  const [provider, setProvider] = useState(initial?.provider ?? '');
  const [memberId, setMemberId] = useState(initial?.memberId ?? '');
  const [plan, setPlan] = useState<Plan>(initial?.plan ?? 'BASIC');
  const [validUntil, setValidUntil] = useState(initial?.validUntil ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ provider: provider.trim(), memberId: memberId.trim(), plan, validUntil });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={`${id}-provider`}>Insurance provider</label>
        <input
          id={`${id}-provider`}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          required
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-member`}>Member ID</label>
        <input id={`${id}-member`} value={memberId} onChange={(e) => setMemberId(e.target.value)} required />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${id}-plan`}>Plan</label>
          <select id={`${id}-plan`} value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {PLAN_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-valid`}>Valid until</label>
          <input
            id={`${id}-valid`}
            type="date"
            value={validUntil}
            min={todayIso()}
            onChange={(e) => setValidUntil(e.target.value)}
            required
          />
        </div>
      </div>

      <ErrorBanner error={error} />

      <div className="actions">
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
