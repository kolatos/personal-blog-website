import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  /** When provided, the authenticated user must have this role. */
  requiredRole?: 'admin' | 'user';
}

/**
 * Guards a route behind authentication (and optionally role) checks.
 *
 * - Not authenticated → redirect to /login
 * - Authenticated but wrong role → redirect to / (403 equivalent)
 * - Authenticated and role matches → render nested routes via <Outlet>
 */
export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  // While auth state is resolving, render nothing (avoids flash-redirect)
  if (isLoading) {
    return null;
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role check
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
