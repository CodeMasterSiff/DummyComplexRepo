import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import ErrorBanner from '../components/ErrorBanner';
import { todayIso } from '../utils/format';

const MIN_PASSWORD_LENGTH = 10;

export default function SignupPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const trimmedEmail = email.trim();
    try {
      await authApi.signup({ fullName: fullName.trim(), dateOfBirth, email: trimmedEmail, password });
    } catch (err) {
      setError(err);
      setSubmitting(false);
      return;
    }

    try {
      await login(trimmedEmail, password);
    } catch {
      // not fatal: they can verify first and log in afterwards
    }
    navigate('/verify-email', { state: { email: trimmedEmail } });
  }

  return (
    <div className="auth-page card">
      <h1>Create your account</h1>
      <p className="muted">Book and manage appointments at Northside Health Centre for you and your children.</p>
      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="dob">Date of birth</label>
          <input
            id="dob"
            type="date"
            autoComplete="bday"
            max={todayIso()}
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            required
          />
        </div>
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
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-hint"
            required
          />
          <p id="password-hint" className="hint">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        </div>
        <ErrorBanner error={error} />
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="muted">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
