import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MerchantCasesPage } from './MerchantCasesPage';
import * as merchantApi from '../../api/merchant';
import { ApiError } from '../../api/client';
import type { DisputeCase } from '../../types/domain';

function buildDispute(overrides: Partial<DisputeCase>): DisputeCase {
  return {
    id: 'case-1',
    transactionId: 'txn-1',
    cardMemberId: 'member-1',
    merchantId: 'merchant-1',
    reasonCode: 'GOODS_NOT_RECEIVED',
    cardMemberStatement: 'Never arrived.',
    merchantStatement: null,
    merchantResponseDate: null,
    merchantResponseStatus: 'PENDING',
    status: 'AWAITING_MERCHANT',
    responseDeadline: '2026-08-15T00:00:00.000Z',
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
  buildDispute({ id: 'case-1', reasonCode: 'GOODS_NOT_RECEIVED', cardMemberStatement: 'The package never arrived.' }),
  buildDispute({
    id: 'case-2',
    reasonCode: 'REFUND_NOT_PROCESSED',
    status: 'EVIDENCE_PROCESSING',
    merchantResponseStatus: 'SUBMITTED',
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/merchant/disputes']}>
      <MerchantCasesPage />
    </MemoryRouter>,
  );
}

describe('MerchantCasesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders assigned cases from the API', async () => {
    vi.spyOn(merchantApi, 'listMerchantDisputes').mockResolvedValue(DISPUTES);

    renderPage();

    expect(await screen.findByText('The package never arrived.')).toBeInTheDocument();
    expect(screen.getByText('My refund was never processed.')).toBeInTheDocument();
  });

  it('filters cases by status and category', async () => {
    vi.spyOn(merchantApi, 'listMerchantDisputes').mockResolvedValue(DISPUTES);

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('The package never arrived.');

    await user.selectOptions(screen.getByLabelText(/^status$/i), 'EVIDENCE_PROCESSING');
    expect(screen.queryByText('The package never arrived.')).not.toBeInTheDocument();
    expect(screen.getByText('My refund was never processed.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^status$/i), 'ALL');
    await user.selectOptions(screen.getByLabelText(/^category$/i), 'GOODS_NOT_RECEIVED');
    expect(screen.getByText('The package never arrived.')).toBeInTheDocument();
    expect(screen.queryByText('My refund was never processed.')).not.toBeInTheDocument();
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

    renderPage();

    expect(await screen.findByText(/forbidden resource/i)).toBeInTheDocument();
    expect(screen.getByText(/you don't have access to this/i)).toBeInTheDocument();
  });
});
