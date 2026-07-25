import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MerchantCaseDetailsPage } from './MerchantCaseDetailsPage';
import * as merchantApi from '../../api/merchant';
import * as evidenceApi from '../../api/evidence';
import * as authApi from '../../api/auth';
import { AuthProvider } from '../../auth/AuthContext';
import { ApiError } from '../../api/client';
import type { DisputeCase, PolicyRequirement } from '../../types/domain';

const MERCHANT_USER = { id: 'merchant-1', name: 'Northstar Electronics', email: 'merchant@resolvex.demo', role: 'MERCHANT' as const };

const DAY_MS = 24 * 60 * 60 * 1000;
const FUTURE_DEADLINE = new Date(Date.now() + 10 * DAY_MS).toISOString();
const PAST_DEADLINE = new Date(Date.now() - 5 * DAY_MS).toISOString();

const REQUIREMENTS: PolicyRequirement[] = [
  {
    id: 'req-1',
    reasonCode: 'GOODS_NOT_RECEIVED',
    requirementKey: 'invoice',
    requirementName: 'Invoice or order record',
    description: 'Merchant provides the invoice or order record.',
    acceptedEvidenceTypes: ['invoice', 'order_record'],
    weight: 20,
    isMandatory: true,
    policyVersion: 'prototype-v1',
    active: true,
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  },
  {
    id: 'req-2',
    reasonCode: 'GOODS_NOT_RECEIVED',
    requirementKey: 'delivery_confirmation',
    requirementName: 'Delivery confirmation',
    description: 'Merchant provides carrier delivery confirmation or tracking proof.',
    acceptedEvidenceTypes: ['delivery_confirmation', 'tracking_record'],
    weight: 25,
    isMandatory: true,
    policyVersion: 'prototype-v1',
    active: true,
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  },
];

function buildDispute(overrides: Partial<DisputeCase> = {}): DisputeCase {
  return {
    id: 'case-1',
    transactionId: 'txn-1',
    cardMemberId: 'member-1',
    merchantId: 'merchant-1',
    reasonCode: 'GOODS_NOT_RECEIVED',
    cardMemberStatement: 'The package never arrived at my address.',
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/merchant/disputes/case-1']}>
      <AuthProvider>
        <Routes>
          <Route path="/merchant/disputes/:caseId" element={<MerchantCaseDetailsPage />} />
          <Route path="/merchant/disputes" element={<div>Cases list page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function fillMandatoryEvidence(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('Evidence type for Invoice or order record'), 'invoice');
  await user.type(screen.getByLabelText('Evidence details for Invoice or order record'), 'Order #12345');

  await user.selectOptions(screen.getByLabelText('Evidence type for Delivery confirmation'), 'tracking_record');
  await user.type(screen.getByLabelText('Evidence details for Delivery confirmation'), 'Carrier confirmed delivery.');
}

describe('MerchantCaseDetailsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(authApi, 'fetchProfile').mockResolvedValue(MERCHANT_USER);
    window.localStorage.setItem('resolvex.accessToken', 'test-token');
    vi.spyOn(merchantApi, 'getPolicyRequirements').mockResolvedValue(REQUIREMENTS);
    vi.spyOn(evidenceApi, 'listCaseEvidence').mockResolvedValue([]);
  });

  it('renders transaction details, card-member statement, and the checklist from the API', async () => {
    vi.spyOn(merchantApi, 'getMerchantDispute').mockResolvedValue(buildDispute());

    renderPage();

    expect(await screen.findByText('The package never arrived at my address.')).toBeInTheDocument();
    expect(screen.getByText('Goods not received')).toBeInTheDocument();
    expect(screen.getByText('Invoice or order record')).toBeInTheDocument();
    expect(screen.getByText('Delivery confirmation')).toBeInTheDocument();
    expect(screen.getAllByText('Mandatory')).toHaveLength(2);
  });

  it('blocks submission without a merchant statement', async () => {
    vi.spyOn(merchantApi, 'getMerchantDispute').mockResolvedValue(buildDispute());
    const submitSpy = vi.spyOn(merchantApi, 'submitMerchantResponse');

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Invoice or order record');
    await fillMandatoryEvidence(user);
    await user.click(screen.getByRole('button', { name: /review and submit response/i }));

    expect(await screen.findByText(/provide a merchant statement/i)).toBeInTheDocument();
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('blocks submission when mandatory evidence is missing', async () => {
    vi.spyOn(merchantApi, 'getMerchantDispute').mockResolvedValue(buildDispute());
    const submitSpy = vi.spyOn(merchantApi, 'submitMerchantResponse');

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Invoice or order record');
    await user.type(screen.getByLabelText(/your response to the card-member claim/i), 'We shipped this on time.');
    await user.click(screen.getByRole('button', { name: /review and submit response/i }));

    expect(await screen.findByText(/provide evidence for all mandatory requirements/i)).toBeInTheDocument();
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('submits a merchant response successfully with statement and evidence', async () => {
    vi.spyOn(merchantApi, 'getMerchantDispute').mockResolvedValue(buildDispute());
    const submitSpy = vi.spyOn(merchantApi, 'submitMerchantResponse').mockResolvedValue(
      buildDispute({
        merchantStatement: 'We shipped this on time and have delivery proof.',
        merchantResponseStatus: 'SUBMITTED',
        merchantResponseDate: new Date().toISOString(),
        status: 'EVIDENCE_PROCESSING',
      }),
    );

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Invoice or order record');
    await fillMandatoryEvidence(user);
    await user.type(
      screen.getByLabelText(/your response to the card-member claim/i),
      'We shipped this on time and have delivery proof.',
    );
    await user.click(screen.getByRole('button', { name: /review and submit response/i }));

    expect(await screen.findByText(/confirm your response/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /confirm and submit/i }));

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));
    expect(submitSpy).toHaveBeenCalledWith('case-1', {
      merchantStatement: 'We shipped this on time and have delivery proof.',
      evidence: [
        { requirementKey: 'invoice', evidenceType: 'invoice', value: 'Order #12345' },
        { requirementKey: 'delivery_confirmation', evidenceType: 'tracking_record', value: 'Carrier confirmed delivery.' },
      ],
    });

    expect(await screen.findByText(/a final response has already been recorded/i)).toBeInTheDocument();
  });

  it('prevents duplicate submissions when the confirm button is clicked more than once', async () => {
    vi.spyOn(merchantApi, 'getMerchantDispute').mockResolvedValue(buildDispute());
    let resolveSubmit: (value: DisputeCase) => void = () => {};
    const submitSpy = vi.spyOn(merchantApi, 'submitMerchantResponse').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    renderPage();
    const user = userEvent.setup();

    await screen.findByText('Invoice or order record');
    await fillMandatoryEvidence(user);
    await user.type(screen.getByLabelText(/your response to the card-member claim/i), 'We shipped this on time.');
    await user.click(screen.getByRole('button', { name: /review and submit response/i }));

    const confirmButton = await screen.findByRole('button', { name: /confirm and submit/i });
    await user.click(confirmButton);
    await user.click(confirmButton);
    await user.click(confirmButton);

    resolveSubmit(
      buildDispute({
        merchantStatement: 'We shipped this on time.',
        merchantResponseStatus: 'SUBMITTED',
        merchantResponseDate: new Date().toISOString(),
        status: 'EVIDENCE_PROCESSING',
      }),
    );

    await waitFor(() => expect(screen.getByText(/a final response has already been recorded/i)).toBeInTheDocument());
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it('renders a read-only view and blocks the response form once a case already has a submitted response', async () => {
    vi.spyOn(merchantApi, 'getMerchantDispute').mockResolvedValue(
      buildDispute({
        merchantStatement: 'We shipped this on time and have delivery proof.',
        merchantResponseStatus: 'SUBMITTED',
        merchantResponseDate: '2026-07-24T00:00:00.000Z',
        status: 'EVIDENCE_PROCESSING',
      }),
    );

    renderPage();

    expect(await screen.findByText(/a final response has already been recorded/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/your response to the card-member claim/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Evidence type for Invoice or order record')).not.toBeInTheDocument();
  });

  it('displays a clear expired state and blocks the form once the response deadline has passed', async () => {
    vi.spyOn(merchantApi, 'getMerchantDispute').mockResolvedValue(
      buildDispute({ responseDeadline: PAST_DEADLINE }),
    );

    renderPage();

    expect(await screen.findByText(/response deadline for this case has passed/i)).toBeInTheDocument();
    expect(screen.getByText('Deadline passed')).toBeInTheDocument();
    expect(screen.queryByLabelText(/your response to the card-member claim/i)).not.toBeInTheDocument();
  });

  it('shows an unauthorized error state when the case cannot be accessed', async () => {
    vi.spyOn(merchantApi, 'getMerchantDispute').mockRejectedValue(
      new ApiError({
        statusCode: 404,
        error: 'Not Found',
        message: 'Dispute case not found',
        timestamp: new Date().toISOString(),
        path: '/api/merchant/disputes/case-1',
      }),
    );

    renderPage();

    expect(await screen.findByText('Dispute case not found')).toBeInTheDocument();
  });
});
