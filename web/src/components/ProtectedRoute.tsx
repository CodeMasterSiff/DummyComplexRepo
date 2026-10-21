import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '../api/types';
import { homePathFor, useAuth } from '../auth/AuthContext';

interface Props {
  roles?: Role[];
  children?: ReactNode;
}

export default function ProtectedRoute({ roles, children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <p className="muted" role="status">
        Loading…
      </p>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
