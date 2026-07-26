import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CreateDisputePage } from './CreateDisputePage';
import * as transactionsApi from '../../api/transactions';
import * as disputesApi from '../../api/disputes';
import { ApiError } from '../../api/client';
import type { DisputeCase, Transaction } from '../../types/domain';

const TRANSACTION: Transaction = {
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
};

const CREATED_DISPUTE: DisputeCase = {
  id: 'case-99',
  transactionId: 'txn-1',
  cardMemberId: 'member-1',
  merchantId: 'merchant-1',
  reasonCode: 'GOODS_NOT_RECEIVED',
  cardMemberStatement: 'It never arrived.',
  merchantStatement: null,
  merchantResponseDate: null,
  merchantResponseStatus: 'PENDING',
  status: 'AWAITING_MERCHANT',
  responseDeadline: '2026-07-31T00:00:00.000Z',
  createdAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
  resolvedAt: null,
  transaction: {
    id: 'txn-1',
    merchantName: 'Northstar Electronics',
    amount: '249.99',
    currency: 'USD',
    maskedCardLast4: '4242',
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/member/transactions/txn-1/dispute']}>
      <Routes>
        <Route path="/member/transactions/:transactionId/dispute" element={<CreateDisputePage />} />
        <Route path="/member/disputes/:caseId" element={<div>Case details page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^reason$/i), 'GOODS_NOT_RECEIVED');
  await user.type(screen.getByLabelText(/what happened/i), 'The package never arrived at my address.');
  await user.selectOptions(screen.getByLabelText(/expected resolution/i), 'FULL_REFUND');
  await user.click(screen.getByLabelText(/i confirm the information/i));
}

describe('CreateDisputePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(transactionsApi, 'getTransaction').mockResolvedValue(TRANSACTION);
  });

  it('shows a validation message when required fields are missing', async () => {
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Northstar Electronics');
    await user.click(screen.getByRole('button', { name: /review and submit/i }));

    expect(await screen.findByText(/choose a reason/i)).toBeInTheDocument();
  });

  it('opens a confirmation modal and navigates to the case details page on success', async () => {
    const createSpy = vi.spyOn(disputesApi, 'createDispute').mockResolvedValue(CREATED_DISPUTE);
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Northstar Electronics');
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /review and submit/i }));

    expect(await screen.findByText(/confirm your dispute/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm and submit/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 'txn-1', reasonCode: 'GOODS_NOT_RECEIVED' }),
    );
    expect(await screen.findByText('Case details page')).toBeInTheDocument();
  });

  it('displays the API error message when submission fails', async () => {
    vi.spyOn(disputesApi, 'createDispute').mockRejectedValue(
      new ApiError({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Multiple active disputes for this transaction are not allowed.',
        timestamp: new Date().toISOString(),
        path: '/api/disputes',
      }),
    );
    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Northstar Electronics');
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /review and submit/i }));
    await user.click(screen.getByRole('button', { name: /confirm and submit/i }));

    expect(await screen.findByText(/multiple active disputes/i)).toBeInTheDocument();
  });

  it('prevents duplicate submissions when the confirm button is clicked more than once', async () => {
    let resolveCreate: (value: DisputeCase) => void = () => {};
    const createSpy = vi.spyOn(disputesApi, 'createDispute').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Northstar Electronics');
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /review and submit/i }));

    const confirmButton = screen.getByRole('button', { name: /confirm and submit/i });
    await user.click(confirmButton);
    await user.click(confirmButton);
    await user.click(confirmButton);

    resolveCreate(CREATED_DISPUTE);

    await waitFor(() => expect(screen.getByText('Case details page')).toBeInTheDocument());
    expect(createSpy).toHaveBeenCalledTimes(1);
  });
});
