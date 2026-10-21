import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { isApiError } from '../api/client';
import { waitlistApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import ErrorBanner from '../components/ErrorBanner';
import { useApi } from '../hooks/useApi';
import { formatDateTime, formatTime, TYPE_LABELS } from '../utils/format';

export default function WaitlistClaimPage() {
  const { token = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, error, loading } = useApi(() => waitlistApi.offer(token), [token]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [declined, setDeclined] = useState(false);

  async function claim() {
    setBusy(true);
    setActionError(null);
    try {
      const { appointment } = await waitlistApi.claim(token);
      navigate(`/book/review/${appointment.id}`);
    } catch (err) {
      if (isApiError(err, 'EMAIL_NOT_VERIFIED')) {
        navigate('/verify-email', { state: { email: user?.email } });
        return;
      }
      setActionError(err);
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setActionError(null);
    try {
      await waitlistApi.decline(token);
      setDeclined(true);
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="muted" role="status">
        Loading offer…
      </p>
    );
  }

  if (!data) return <ErrorBanner error={error} />;

  const { offer, practitionerName, patientName, type } = data;
  const isOpen = offer.status === 'OPEN' && new Date(offer.expiresAt).getTime() > Date.now();

  return (
    <div className="narrow card">
      <h1>A time opened up</h1>
      <dl className="details">
        <div>
          <dt>Patient</dt>
          <dd>{patientName}</dd>
        </div>
        <div>
          <dt>Visit</dt>
          <dd>{TYPE_LABELS[type]}</dd>
        </div>
        <div>
          <dt>With</dt>
          <dd>{practitionerName}</dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{formatDateTime(offer.start)}</dd>
        </div>
      </dl>

      {declined ? (
        <p className="banner banner-info" role="status">
          No problem — we’ve passed this time on. You stay on the waitlist.
        </p>
      ) : !isOpen ? (
        <p className="banner banner-warning">This offer has expired or was already taken.</p>
      ) : (
        <>
          <p className="muted">Claim it before {formatTime(offer.expiresAt)} or it goes to the next person.</p>
          <ErrorBanner error={actionError} />
          {user ? (
            <div className="actions">
              <button type="button" className="btn btn-secondary" onClick={decline} disabled={busy}>
                Decline
              </button>
              <button type="button" className="btn btn-primary" onClick={claim} disabled={busy}>
                {busy ? 'Please wait…' : 'Claim this time'}
              </button>
            </div>
          ) : (
            <div className="actions">
              <Link to="/login" state={{ from: location.pathname }} className="btn btn-primary">
                Log in to respond
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
