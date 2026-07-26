import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { RoleRoute } from './auth/RoleRoute';
import { DASHBOARD_PATH_BY_ROLE } from './auth/roles';
import { AppLayout } from './components/layout/AppLayout';
import { ToastProvider } from './components/common/ToastProvider';
import { NotificationsProvider } from './notifications/NotificationsContext';
import { RealtimeProvider } from './realtime/RealtimeContext';
import { LandingPage } from './pages/marketing/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { CardMemberDashboard } from './pages/member/CardMemberDashboard';
import { TransactionDetailsPage } from './pages/member/TransactionDetailsPage';
import { CreateDisputePage } from './pages/member/CreateDisputePage';
import { MemberCasesPage } from './pages/member/MemberCasesPage';
import { CaseDetailsPage } from './pages/member/CaseDetailsPage';
import { MerchantDashboard } from './pages/merchant/MerchantDashboard';
import { MerchantCasesPage } from './pages/merchant/MerchantCasesPage';
import { MerchantCaseDetailsPage } from './pages/merchant/MerchantCaseDetailsPage';
import { AnalystDashboard } from './pages/analyst/AnalystDashboard';
import { AnalystQueuePage } from './pages/analyst/AnalystQueuePage';
import { AnalystCasePage } from './pages/analyst/AnalystCasePage';
import { DecisionExplanationPage } from './pages/shared/DecisionExplanationPage';
import { NotFoundPage } from './pages/misc/NotFoundPage';
import { UnauthorizedPage } from './pages/misc/UnauthorizedPage';
import { ForbiddenPage } from './pages/misc/ForbiddenPage';
import { SessionExpiredModal } from './components/common/SessionExpiredModal';
import { OfflineBanner } from './components/common/OfflineBanner';

function RootRedirect() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated && user) {
    return <Navigate to={DASHBOARD_PATH_BY_ROLE[user.role]} replace />;
  }

  return <LandingPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route element={<RoleRoute allow={['CARD_MEMBER']} />}>
            <Route path="/member/dashboard" element={<CardMemberDashboard />} />
            <Route path="/member/transactions/:transactionId" element={<TransactionDetailsPage />} />
            <Route path="/member/transactions/:transactionId/dispute" element={<CreateDisputePage />} />
            <Route path="/member/disputes" element={<MemberCasesPage />} />
            <Route path="/member/disputes/:caseId" element={<CaseDetailsPage />} />
            <Route path="/member/disputes/:caseId/decision" element={<DecisionExplanationPage />} />
          </Route>
          <Route element={<RoleRoute allow={['MERCHANT']} />}>
            <Route path="/merchant/dashboard" element={<MerchantDashboard />} />
            <Route path="/merchant/disputes" element={<MerchantCasesPage />} />
            <Route path="/merchant/disputes/:caseId" element={<MerchantCaseDetailsPage />} />
            <Route path="/merchant/disputes/:caseId/decision" element={<DecisionExplanationPage />} />
          </Route>
          <Route element={<RoleRoute allow={['ANALYST']} />}>
            <Route path="/analyst/dashboard" element={<AnalystDashboard />} />
            <Route path="/analyst/queue" element={<AnalystQueuePage />} />
            <Route path="/analyst/cases/:caseId" element={<AnalystCasePage />} />
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
      <ToastProvider>
        <RealtimeProvider>
          <NotificationsProvider>
            <OfflineBanner />
            <AppRoutes />
            <SessionExpiredModal />
          </NotificationsProvider>
        </RealtimeProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
