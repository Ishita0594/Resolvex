import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnalystQueuePage } from './AnalystQueuePage';
import * as analystApi from '../../api/analyst';
import { RealtimeProvider } from '../../realtime/RealtimeContext';
import { AuthProvider } from '../../auth/AuthContext';
import * as authApi from '../../api/auth';
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

/** Always well into the future / far in the past relative to the real clock, so deadline-derived priority is deterministic. */
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
    latestConfidence: 62,
    latestDecisionMargin: 8,
    latestEscalationReason: 'confidence 62 is below threshold 85; decision margin 8 is below threshold 20',
    responseDeadline: FAR_FUTURE_DEADLINE,
    createdAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RealtimeProvider>
          <AnalystQueuePage />
        </RealtimeProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AnalystQueuePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(ANALYST_USER);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');
  });

  it('renders the queue with case id, category, amount, recommendation, confidence, escalation reason, age, and priority', async () => {
    vi.spyOn(analystApi, 'listAnalystQueue').mockResolvedValue([
      buildCase({
        id: 'case-1234-5678',
        merchantName: 'Northstar Electronics',
        reasonCode: 'GOODS_NOT_RECEIVED',
        amount: '249.99',
        currency: 'USD',
        latestConfidence: 62,
      }),
    ]);

    renderPage();

    expect(await screen.findByText('Northstar Electronics')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('case-123')).toBeInTheDocument();
    expect(within(table).getByText('Goods not received')).toBeInTheDocument();
    expect(within(table).getByText('$249.99')).toBeInTheDocument();
    expect(within(table).getByText('62%')).toBeInTheDocument();
    expect(within(table).getByText(/confidence 62 is below threshold 85/)).toBeInTheDocument();
    expect(within(table).getByText('High')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is in the queue', async () => {
    vi.spyOn(analystApi, 'listAnalystQueue').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText('Nothing needs review right now')).toBeInTheDocument();
  });

  it('filters by priority', async () => {
    vi.spyOn(analystApi, 'listAnalystQueue').mockResolvedValue([
      buildCase({ id: 'high-case', merchantName: 'High Priority Co', latestConfidence: 40 }),
      buildCase({
        id: 'standard-case',
        merchantName: 'Standard Co',
        latestConfidence: 90,
        latestDecisionMargin: 40,
        responseDeadline: '2026-12-01T00:00:00.000Z',
      }),
    ]);

    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText('High Priority Co')).toBeInTheDocument();
    expect(screen.getByText('Standard Co')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Priority'), 'HIGH');

    expect(screen.getByText('High Priority Co')).toBeInTheDocument();
    expect(screen.queryByText('Standard Co')).not.toBeInTheDocument();
  });

  it('filters by dispute category', async () => {
    vi.spyOn(analystApi, 'listAnalystQueue').mockResolvedValue([
      buildCase({ id: 'goods-case', merchantName: 'Goods Co', reasonCode: 'GOODS_NOT_RECEIVED' }),
      buildCase({ id: 'refund-case', merchantName: 'Refund Co', reasonCode: 'REFUND_NOT_PROCESSED' }),
    ]);

    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText('Goods Co')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Dispute category'), 'REFUND_NOT_PROCESSED');

    expect(screen.queryByText('Goods Co')).not.toBeInTheDocument();
    expect(screen.getByText('Refund Co')).toBeInTheDocument();
  });

  it('toggles sort direction when a sortable column header is clicked twice', async () => {
    vi.spyOn(analystApi, 'listAnalystQueue').mockResolvedValue([
      buildCase({ id: 'low-confidence', merchantName: 'Low Confidence Co', latestConfidence: 30 }),
      buildCase({ id: 'high-confidence', merchantName: 'High Confidence Co', latestConfidence: 95, latestDecisionMargin: 40 }),
    ]);

    renderPage();
    const user = userEvent.setup();
    await screen.findByText('Low Confidence Co');

    function rowOrder() {
      return screen.getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
    }

    await user.click(screen.getByRole('button', { name: /confidence/i }));
    const afterFirstClick = rowOrder();

    await user.click(screen.getByRole('button', { name: /confidence/i }));
    const afterSecondClick = rowOrder();

    expect(afterFirstClick).not.toEqual(afterSecondClick);
  });
});
