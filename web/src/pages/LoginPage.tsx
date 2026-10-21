import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../auth/AuthContext';
import ErrorBanner from '../components/ErrorBanner';

interface LoginState {
  from?: string;
  email?: string;
  notice?: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const state = (useLocation().state as LoginState | null) ?? {};
  const [email, setEmail] = useState(state.email ?? '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(email.trim(), password);
      const target = user.role === 'PATIENT' && user.emailVerified && state.from ? state.from : homePathFor(user);
      navigate(target, {
        replace: true,
        state: user.emailVerified ? undefined : { email: user.email },
      });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page card">
      <h1>Log in</h1>
      {state.notice && (
        <p className="banner banner-success" role="status">
          {state.notice}
        </p>
      )}
      <form className="form" onSubmit={handleSubmit}>
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <ErrorBanner error={error} />
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="muted">
        New patient? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  );
}
