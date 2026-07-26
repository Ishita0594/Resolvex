import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MerchantDashboard } from './MerchantDashboard';
import { AuthProvider } from '../../auth/AuthContext';
import * as authApi from '../../api/auth';
import * as merchantApi from '../../api/merchant';
import { ApiError } from '../../api/client';
import type { DisputeCase } from '../../types/domain';

const MERCHANT_USER = { id: 'merchant-1', name: 'Nora Merchant', email: 'merchant@resolvex.demo', role: 'MERCHANT' as const };

const DAY_MS = 24 * 60 * 60 * 1000;
const FUTURE_DEADLINE = new Date(Date.now() + 10 * DAY_MS).toISOString();

function buildDispute(overrides: Partial<DisputeCase>): DisputeCase {
  return {
    id: 'case-1',
    transactionId: 'txn-1',
    cardMemberId: 'member-1',
    merchantId: 'merchant-1',
    reasonCode: 'GOODS_NOT_RECEIVED',
    cardMemberStatement: 'The package never arrived.',
    merchantStatement: null,
    merchantResponseDate: null,
    merchantResponseStatus: 'PENDING',
    status: 'AWAITING_MERCHANT',
    responseDeadline: FUTURE_DEADLINE,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    resolvedAt: null,
    transaction: {
      id: 'txn-1',
      merchantName: 'Northstar Electronics',
      amount: '249.99',
      currency: 'USD',
      maskedCardLast4: '4242',
    },
    ...overrides,
  };
}

const DISPUTES: DisputeCase[] = [
  buildDispute({ id: 'case-1' }),
  buildDispute({
    id: 'case-2',
    merchantResponseStatus: 'SUBMITTED',
    merchantStatement: 'We shipped the item on time.',
    merchantResponseDate: '2026-07-24T00:00:00.000Z',
    status: 'EVIDENCE_PROCESSING',
    cardMemberStatement: 'My refund was never processed.',
    transaction: {
      id: 'txn-2',
      merchantName: 'Harbor Home Goods',
      amount: '89.50',
      currency: 'USD',
      maskedCardLast4: '4242',
    },
  }),
];

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/merchant/dashboard']}>
      <AuthProvider>
        <MerchantDashboard />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('MerchantDashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(MERCHANT_USER);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');
  });

  it('renders assigned cases returned by the API in the case table', async () => {
    vi.spyOn(merchantApi, 'listMerchantDisputes').mockResolvedValue(DISPUTES);

    renderDashboard();

    expect(await screen.findByText('The package never arrived.')).toBeInTheDocument();
    expect(screen.getByText('My refund was never processed.')).toBeInTheDocument();
  });

  it('summarizes open, awaiting-response, and recently-submitted counts', async () => {
    vi.spyOn(merchantApi, 'listMerchantDisputes').mockResolvedValue(DISPUTES);

    renderDashboard();

    await screen.findByText('The package never arrived.');
    expect(screen.getByText('Total open disputes').previousElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Cases awaiting response').previousElementSibling).toHaveTextContent('1');
    expect(screen.getAllByText('Recently submitted responses')[0].previousElementSibling).toHaveTextContent('1');
  });

  it('shows an empty state when no cases are assigned', async () => {
    vi.spyOn(merchantApi, 'listMerchantDisputes').mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByText(/no disputes assigned yet/i)).toBeInTheDocument();
  });

  it('shows an error state with retry when the API call fails', async () => {
    vi.spyOn(merchantApi, 'listMerchantDisputes').mockRejectedValue(
      new ApiError({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Unable to reach ResolveX right now.',
        timestamp: new Date().toISOString(),
        path: '/api/merchant/disputes',
      }),
    );

    renderDashboard();

    expect(await screen.findByText('Unable to reach ResolveX right now.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows an unauthorized error state for a 403 response', async () => {
    vi.spyOn(merchantApi, 'listMerchantDisputes').mockRejectedValue(
      new ApiError({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Forbidden resource',
        timestamp: new Date().toISOString(),
        path: '/api/merchant/disputes',
      }),
    );

    renderDashboard();

    expect(await screen.findByText(/forbidden resource/i)).toBeInTheDocument();
    expect(screen.getByText(/you don't have access to this/i)).toBeInTheDocument();
  });
});
