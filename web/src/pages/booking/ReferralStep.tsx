import { useState, type FormEvent } from 'react';
import { patientApi } from '../../api/endpoints';
import type { Specialty } from '../../api/types';
import ErrorBanner from '../../components/ErrorBanner';
import { useApi } from '../../hooks/useApi';
import { formatCalendarDate, SPECIALTY_LABELS } from '../../utils/format';
import { isReferralUsable, referralValidUntil, visitsLeft } from '../../utils/referralRules';

const NO_REFERRAL = 'none';

interface Props {
  patientId: string;
  specialty: Specialty;
  appointmentStart: string;
  selectedReferralId?: string;
  onNext: (referralId?: string) => void;
  onBack?: () => void;
}

export default function ReferralStep({
  patientId,
  specialty,
  appointmentStart,
  selectedReferralId,
  onNext,
  onBack,
}: Props) {
  const { data, error, loading } = useApi(() => patientApi.referrals(), []);
  const [choice, setChoice] = useState<string | null>(selectedReferralId ?? null);

  const visitDate = new Date(appointmentStart);
  const usable = (data?.referrals ?? []).filter(
    (r) => r.patientId === patientId && isReferralUsable(r, specialty, visitDate),
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!choice) return;
    onNext(choice === NO_REFERRAL ? undefined : choice);
  }

  if (loading) {
    return (
      <p className="muted" role="status">
        Loading referrals…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <p>
        Your insurer covers {SPECIALTY_LABELS[specialty].toLowerCase()} with a referral from your GP. Choose the referral
        to use for this visit.
      </p>
      <ErrorBanner error={error} />

      <fieldset className="choice-list">
        <legend>Referral</legend>
        {usable.length === 0 && <p className="muted">No valid referrals on file for this visit.</p>}
        {usable.map((r) => (
          <label key={r.id} className="choice">
            <input type="radio" name="referral" value={r.id} checked={choice === r.id} onChange={() => setChoice(r.id)} />
            <span>
              <strong>Referral to {SPECIALTY_LABELS[r.toSpecialty]}</strong>
              <span className="muted">
                {' '}
                · issued {formatCalendarDate(r.issuedAt)} · {visitsLeft(r)} of {r.visitsAllowed} visits left · valid
                until {referralValidUntil(r).toLocaleDateString()}
              </span>
            </span>
          </label>
        ))}
        <label className="choice">
          <input
            type="radio"
            name="referral"
            value={NO_REFERRAL}
            checked={choice === NO_REFERRAL}
            onChange={() => setChoice(NO_REFERRAL)}
          />
          <span>
            <strong>I don’t have a referral</strong>
            <span className="muted"> · you can still book as self-pay; the clinic may review the booking first</span>
          </span>
        </label>
      </fieldset>

      <div className="actions">
        {onBack && (
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={!choice}>
          Continue
        </button>
      </div>
    </form>
  );
}
