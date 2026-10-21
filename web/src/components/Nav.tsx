import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { Role } from '../api/types';
import { homePathFor, useAuth } from '../auth/AuthContext';

const LINKS: Record<Role, { to: string; label: string }[]> = {
  PATIENT: [
    { to: '/', label: 'Overview' },
    { to: '/book', label: 'Book' },
    { to: '/appointments', label: 'Appointments' },
    { to: '/dependents', label: 'Family' },
  ],
  STAFF: [
    { to: '/staff/schedule', label: 'Schedule' },
    { to: '/staff/review', label: 'Review queue' },
    { to: '/staff/book', label: 'Book for patient' },
    { to: '/staff/closures', label: 'Closures' },
  ],
  PRACTITIONER: [{ to: '/staff/schedule', label: 'My schedule' }],
};

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="topbar">
      <nav className="nav container" aria-label="Main">
        <Link to={user ? homePathFor(user) : '/login'} className="brand">
          MediBook <span className="brand-sub">Northside Health Centre</span>
        </Link>

        {user && (
          <ul className="nav-links">
            {LINKS[user.role].map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} end={link.to === '/'}>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        <div className="nav-user">
          {user ? (
            <>
              <span className="muted nav-email">{user.email}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/signup">Sign up</NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
