import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import ErrorBanner from '../components/ErrorBanner';
import { useNow } from '../hooks/useNow';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const stateEmail = (useLocation().state as { email?: string } | null)?.email;

  const [email, setEmail] = useState(params.get('email') ?? stateEmail ?? user?.email ?? '');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const now = useNow(1000);
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  // the session may still be loading on first render
  useEffect(() => {
    if (!email && user) setEmail(user.email);
  }, [user, email]);

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.verifyEmail(email.trim(), code.trim());
      if (user) {
        await refreshUser();
        navigate('/onboarding/insurance', { replace: true });
      } else {
        navigate('/login', { replace: true, state: { email, notice: 'Email verified. Log in to continue.' } });
      }
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    try {
      await authApi.resendCode(email.trim());
      setNotice(`We sent a new code to ${email.trim()}.`);
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    } catch (err) {
      setError(err);
    }
  }

  if (user?.emailVerified) {
    return (
      <div className="auth-page card">
        <h1>Email verified</h1>
        <p>Your email address is already verified.</p>
        <Link to="/" className="btn btn-primary">
          Go to your overview
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-page card">
      <h1>Verify your email</h1>
      <p className="muted">
        We emailed you a 6-digit code. Enter it below to finish setting up your account. You need a verified email
        before you can book.
      </p>

      {notice && (
        <p className="banner banner-info" role="status">
          {notice}
        </p>
      )}

      <form className="form" onSubmit={handleVerify}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="code">Verification code</label>
          <input
            id="code"
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
        </div>
        <ErrorBanner error={error} />
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={handleResend} disabled={!email || cooldownLeft > 0}>
            {cooldownLeft > 0 ? `Resend code (${cooldownLeft}s)` : 'Resend code'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Verifying…' : 'Verify email'}
          </button>
        </div>
      </form>
    </div>
  );
}
