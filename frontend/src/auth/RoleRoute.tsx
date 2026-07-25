import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { UserRole } from '../types/domain';

export function RoleRoute({ allow }: { allow: UserRole[] }) {
  const { user } = useAuth();

  if (!user || !allow.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
