import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { RoleRoute } from './auth/RoleRoute';
import { DASHBOARD_PATH_BY_ROLE } from './auth/roles';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { CardMemberDashboard } from './pages/member/CardMemberDashboard';
import { MerchantDashboard } from './pages/merchant/MerchantDashboard';
import { AnalystDashboard } from './pages/analyst/AnalystDashboard';
import { NotFoundPage } from './pages/misc/NotFoundPage';
import { UnauthorizedPage } from './pages/misc/UnauthorizedPage';
import { SessionExpiredModal } from './components/common/SessionExpiredModal';

function RootRedirect() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated && user) {
    return <Navigate to={DASHBOARD_PATH_BY_ROLE[user.role]} replace />;
  }

  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<RoleRoute allow={['CARD_MEMBER']} />}>
            <Route path="/member/dashboard" element={<CardMemberDashboard />} />
          </Route>
          <Route element={<RoleRoute allow={['MERCHANT']} />}>
            <Route path="/merchant/dashboard" element={<MerchantDashboard />} />
          </Route>
          <Route element={<RoleRoute allow={['ANALYST']} />}>
            <Route path="/analyst/dashboard" element={<AnalystDashboard />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <SessionExpiredModal />
    </AuthProvider>
  );
}
