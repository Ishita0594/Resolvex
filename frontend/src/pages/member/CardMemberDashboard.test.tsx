import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CardMemberDashboard } from './CardMemberDashboard';
import { AuthProvider } from '../../auth/AuthContext';
import * as authApi from '../../api/auth';
import * as transactionsApi from '../../api/transactions';
import * as disputesApi from '../../api/disputes';
import { ApiError } from '../../api/client';
import type { DisputeCase, Transaction } from '../../types/domain';

const MEMBER_USER = { id: 'member-1', name: 'Ada Card Member', email: 'member@resolvex.demo', role: 'CARD_MEMBER' as const };

const TRANSACTIONS: Transaction[] = [
  {
    id: 'txn-1',
    merchantId: 'merchant-1',
    merchantName: 'Northstar Electronics',
    amount: '249.99',
    currency: 'USD',
    transactionDate: '2026-06-08T14:22:00.000Z',
    status: 'POSTED',
    maskedCardLast4: '4242',
    createdAt: '2026-06-08T14:22:00.000Z',
    updatedAt: '2026-06-08T14:22:00.000Z',
  },
  {
    id: 'txn-2',
    merchantId: 'merchant-2',
    merchantName: 'Harbor Home Goods',
    amount: '89.50',
    currency: 'USD',
    transactionDate: '2026-06-12T09:15:00.000Z',
    status: 'POSTED',
    maskedCardLast4: '4242',
    createdAt: '2026-06-12T09:15:00.000Z',
    updatedAt: '2026-06-12T09:15:00.000Z',
  },
];

const DISPUTES: DisputeCase[] = [
  {
    id: 'case-1',
    transactionId: 'txn-2',
    cardMemberId: 'member-1',
    merchantId: 'merchant-2',
    reasonCode: 'GOODS_NOT_RECEIVED',
    cardMemberStatement: 'Never arrived.',
    merchantStatement: null,
    merchantResponseDate: null,
    merchantResponseStatus: 'PENDING',
    status: 'AWAITING_MERCHANT',
    responseDeadline: '2026-07-31T00:00:00.000Z',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    resolvedAt: null,
    transaction: {
      id: 'txn-2',
      merchantName: 'Harbor Home Goods',
      amount: '89.50',
      currency: 'USD',
      maskedCardLast4: '4242',
    },
  },
];

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/member/dashboard']}>
      <AuthProvider>
        <CardMemberDashboard />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('CardMemberDashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(MEMBER_USER);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');
  });

  it('renders transactions returned by the API with merchant, amount, and dispute status', async () => {
    vi.spyOn(transactionsApi, 'listTransactions').mockResolvedValue(TRANSACTIONS);
    vi.spyOn(disputesApi, 'listDisputes').mockResolvedValue(DISPUTES);

    renderDashboard();

    expect(await screen.findByText('Northstar Electronics')).toBeInTheDocument();
    expect(screen.getByText('Harbor Home Goods')).toBeInTheDocument();
    expect(screen.getByText('$249.99')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dispute this transaction/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view dispute/i })).toBeInTheDocument();
  });

  it('shows an empty state when there are no transactions', async () => {
    vi.spyOn(transactionsApi, 'listTransactions').mockResolvedValue([]);
    vi.spyOn(disputesApi, 'listDisputes').mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument();
  });

  it('shows an error state with retry when the API call fails', async () => {
    vi.spyOn(transactionsApi, 'listTransactions').mockRejectedValue(
      new ApiError({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Unable to reach ResolveX right now.',
        timestamp: new Date().toISOString(),
        path: '/api/transactions',
      }),
    );
    vi.spyOn(disputesApi, 'listDisputes').mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByText('Unable to reach ResolveX right now.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('retries loading when the try again button is clicked', async () => {
    const listSpy = vi
      .spyOn(transactionsApi, 'listTransactions')
      .mockRejectedValueOnce(
        new ApiError({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Temporary failure.',
          timestamp: new Date().toISOString(),
          path: '/api/transactions',
        }),
      )
      .mockResolvedValueOnce(TRANSACTIONS);
    vi.spyOn(disputesApi, 'listDisputes').mockResolvedValue(DISPUTES);

    const { default: userEvent } = await import('@testing-library/user-event');
    renderDashboard();

    const retryButton = await screen.findByRole('button', { name: /try again/i });
    await userEvent.setup().click(retryButton);

    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Northstar Electronics')).toBeInTheDocument();
  });
});
