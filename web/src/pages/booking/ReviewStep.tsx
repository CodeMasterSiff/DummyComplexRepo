import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isApiError } from '../../api/client';
import { appointmentApi } from '../../api/endpoints';
import type { Appointment, Payer } from '../../api/types';
import ErrorBanner from '../../components/ErrorBanner';
import HoldTimer from '../../components/HoldTimer';
import PriceQuote from '../../components/PriceQuote';
import { useApi } from '../../hooks/useApi';
import { formatDateTime, formatTime, SPECIALTY_LABELS, TYPE_LABELS } from '../../utils/format';

export const HOLD_EXPIRED_MESSAGE = 'Your hold on that time expired before the booking was confirmed. Please pick a time again.';

interface Props {
  appointment: Appointment;
  patientName?: string;
  practitionerName?: string;
  referralId?: string;
  defaultPayer: Payer;
  insuranceAvailable: boolean;
  onConfirmed: (appointment: Appointment) => void;
  onHoldExpired: (message: string) => void;
  onBack?: () => void;
}

export default function ReviewStep({
  appointment,
  patientName,
  practitionerName,
  referralId,
  defaultPayer,
  insuranceAvailable,
  onConfirmed,
  onHoldExpired,
  onBack,
}: Props) {
  const navigate = useNavigate();
  const [payer, setPayer] = useState<Payer>(defaultPayer);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const quote = useApi(
    () => appointmentApi.quote(appointment.id, payer, referralId),
    [appointment.id, payer, referralId],
  );

  const referralMissing =
    isApiError(error, 'REFERRAL_REQUIRED') ||
    (payer === 'INSURANCE' && !referralId && quote.data?.needsReferral === true);

  function switchToSelfPay() {
    setPayer('SELF_PAY');
    setError(null);
  }

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const { appointment: confirmed } = await appointmentApi.confirm(appointment.id, payer, referralId);
      onConfirmed(confirmed);
    } catch (err) {
      if (isApiError(err, 'HOLD_EXPIRED')) {
        onHoldExpired(HOLD_EXPIRED_MESSAGE);
        return;
      }
      if (isApiError(err, 'EMAIL_NOT_VERIFIED')) {
        navigate('/verify-email');
        return;
      }
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="stack">
      {appointment.holdExpiresAt && <HoldTimer expiresAt={appointment.holdExpiresAt} onExpire={() => setExpired(true)} />}

      <dl className="details">
        <div>
          <dt>Visit</dt>
          <dd>
            {SPECIALTY_LABELS[appointment.specialty]} · {TYPE_LABELS[appointment.type]}
          </dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>
            {formatDateTime(appointment.start)} – {formatTime(appointment.end)}
          </dd>
        </div>
        {practitionerName && (
          <div>
            <dt>With</dt>
            <dd>{practitionerName}</dd>
          </div>
        )}
        {patientName && (
          <div>
            <dt>Patient</dt>
            <dd>{patientName}</dd>
          </div>
        )}
      </dl>

      <fieldset className="segmented" disabled={submitting || expired}>
        <legend>How will you pay?</legend>
        <label className={payer === 'INSURANCE' ? 'active' : ''}>
          <input
            type="radio"
            name="payer"
            value="INSURANCE"
            checked={payer === 'INSURANCE'}
            disabled={!insuranceAvailable}
            onChange={() => setPayer('INSURANCE')}
          />
          Insurance
        </label>
        <label className={payer === 'SELF_PAY' ? 'active' : ''}>
          <input
            type="radio"
            name="payer"
            value="SELF_PAY"
            checked={payer === 'SELF_PAY'}
            onChange={() => setPayer('SELF_PAY')}
          />
          Self-pay
        </label>
      </fieldset>
      {!insuranceAvailable && <p className="hint">No insurance on file, so this visit is self-pay.</p>}

      {quote.loading ? (
        <p className="muted" role="status">
          Calculating price…
        </p>
      ) : quote.data ? (
        <PriceQuote quote={quote.data.quote} requestedPayer={payer} />
      ) : (
        <ErrorBanner error={quote.error} />
      )}

      {referralMissing && !expired && (
        <div className="banner banner-warning" role="alert">
          <p>Your insurer requires a referral for this visit. You can still book it as self-pay.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={switchToSelfPay}>
            Continue as self-pay
          </button>
        </div>
      )}
      {!isApiError(error, 'REFERRAL_REQUIRED') && <ErrorBanner error={error} />}

      {expired && (
        <div className="banner banner-warning" role="alert">
          <p>Your hold on this time has run out.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onHoldExpired(HOLD_EXPIRED_MESSAGE)}>
            Pick another time
          </button>
        </div>
      )}

      <div className="actions">
        {onBack && (
          <button type="button" className="btn btn-secondary" onClick={onBack} disabled={submitting}>
            Back
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={confirm} disabled={submitting || expired}>
          {submitting ? 'Confirming…' : 'Confirm booking'}
        </button>
      </div>
    </div>
  );
}
