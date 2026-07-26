import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AnalystDashboard } from './AnalystDashboard';
import * as analystApi from '../../api/analyst';
import * as authApi from '../../api/auth';
import { AuthProvider } from '../../auth/AuthContext';
import { RealtimeProvider } from '../../realtime/RealtimeContext';
import type { AnalystQueueCase } from '../../types/domain';

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    io: { on: vi.fn(), off: vi.fn() },
  }),
}));

const ANALYST_USER = { id: 'analyst-1', name: 'Rae Analyst', email: 'analyst@resolvex.demo', role: 'ANALYST' as const };

const FAR_FUTURE_DEADLINE = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

function buildCase(overrides: Partial<AnalystQueueCase> = {}): AnalystQueueCase {
  return {
    id: 'case-1',
    reasonCode: 'GOODS_NOT_RECEIVED',
    status: 'HUMAN_REVIEW',
    cardMemberId: 'member-1',
    merchantId: 'merchant-1',
    merchantName: 'Northstar Electronics',
    amount: '249.99',
    currency: 'USD',
    latestRecommendation: 'HUMAN_REVIEW_REQUIRED',
    latestConfidence: 60,
    latestDecisionMargin: 20,
    latestEscalationReason: null,
    responseDeadline: FAR_FUTURE_DEADLINE,
    createdAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RealtimeProvider>
          <AnalystDashboard />
        </RealtimeProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AnalystDashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(ANALYST_USER);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');
  });

  it('shows the total awaiting review, average confidence, and recently resolved cases', async () => {
    vi.spyOn(analystApi, 'listAnalystQueue').mockResolvedValue([
      buildCase({ id: 'case-1', latestConfidence: 40 }),
      buildCase({ id: 'case-2', latestConfidence: 80 }),
    ]);
    vi.spyOn(analystApi, 'listRecentlyResolvedCases').mockResolvedValue([
      buildCase({ id: 'case-resolved', merchantName: 'Resolved Co', latestRecommendation: 'MERCHANT_SUPPORTED' }),
    ]);

    renderDashboard();

    expect(await screen.findByText('Welcome back, Rae')).toBeInTheDocument();

    const awaitingTile = screen.getByText('Awaiting review').closest('.rx-card') as HTMLElement;
    expect(within(awaitingTile).getByText('2')).toBeInTheDocument();

    const confidenceTile = screen.getByText('Average confidence').closest('.rx-card') as HTMLElement;
    expect(within(confidenceTile).getByText('60%')).toBeInTheDocument();

    expect(screen.getByText('Resolved Co')).toBeInTheDocument();
    expect(screen.getByText('Evidence weighed toward the merchant')).toBeInTheDocument();
  });

  it('shows an empty state when the queue has no cases', async () => {
    vi.spyOn(analystApi, 'listAnalystQueue').mockResolvedValue([]);
    vi.spyOn(analystApi, 'listRecentlyResolvedCases').mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByText('Nothing needs review right now')).toBeInTheDocument();
    expect(screen.getByText('No cases have been resolved yet.')).toBeInTheDocument();
  });
});
