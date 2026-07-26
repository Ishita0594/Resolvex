import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalystDecisionPanel } from './AnalystDecisionPanel';
import * as analystApi from '../../api/analyst';
import { ApiError } from '../../api/client';
import type { AnalystDecisionResult } from '../../types/domain';

function buildResult(overrides: Partial<AnalystDecisionResult> = {}): AnalystDecisionResult {
  return {
    reviewId: 'review-1',
    caseId: 'case-1',
    systemRecommendation: 'MERCHANT_SUPPORTED',
    analystDecision: 'SUPPORT_MERCHANT',
    status: 'RESOLVED',
    overrideReason: null,
    createdAt: '2026-07-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('AnalystDecisionPanel', () => {
  it('renders all four decision actions', () => {
    render(<AnalystDecisionPanel caseId="case-1" latestRecommendation={null} onDecided={vi.fn()} />);

    expect(screen.getByRole('button', { name: /support card member/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /support merchant/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request more information/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /escalate/i })).toBeInTheDocument();
  });

  it('requires an override reason when the decision differs from the system recommendation', async () => {
    const submitSpy = vi.spyOn(analystApi, 'submitAnalystDecision');
    render(<AnalystDecisionPanel caseId="case-1" latestRecommendation="MERCHANT_SUPPORTED" onDecided={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /support card member/i }));
    expect(screen.getByText(/override reason/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm decision/i }));

    expect(await screen.findByText(/override reason is required/i)).toBeInTheDocument();
    expect(submitSpy).not.toHaveBeenCalled();
  });

  it('does not require an override reason when the decision matches the system recommendation', async () => {
    const submitSpy = vi.spyOn(analystApi, 'submitAnalystDecision').mockResolvedValue(buildResult());
    const onDecided = vi.fn();
    render(<AnalystDecisionPanel caseId="case-1" latestRecommendation="MERCHANT_SUPPORTED" onDecided={onDecided} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /support merchant/i }));
    expect(screen.queryByLabelText(/override reason/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /confirm decision/i }));

    await waitFor(() =>
      expect(submitSpy).toHaveBeenCalledWith('case-1', {
        decision: 'SUPPORT_MERCHANT',
        overrideReason: undefined,
        analystNotes: undefined,
      }),
    );
    expect(onDecided).toHaveBeenCalledWith(buildResult());
  });

  it('submits with a trimmed override reason and analyst notes once provided', async () => {
    const submitSpy = vi.spyOn(analystApi, 'submitAnalystDecision').mockResolvedValue(
      buildResult({ analystDecision: 'SUPPORT_CARD_MEMBER', overrideReason: 'Evidence contradicts the automated read.' }),
    );
    render(<AnalystDecisionPanel caseId="case-1" latestRecommendation="MERCHANT_SUPPORTED" onDecided={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /support card member/i }));
    await user.type(screen.getByLabelText(/override reason/i), '  Evidence contradicts the automated read.  ');
    await user.type(screen.getByLabelText(/analyst notes/i), '  Reviewed manually.  ');
    await user.click(screen.getByRole('button', { name: /confirm decision/i }));

    await waitFor(() =>
      expect(submitSpy).toHaveBeenCalledWith('case-1', {
        decision: 'SUPPORT_CARD_MEMBER',
        overrideReason: 'Evidence contradicts the automated read.',
        analystNotes: 'Reviewed manually.',
      }),
    );
  });

  it('prevents double submission when the confirm button is clicked more than once', async () => {
    let resolveSubmit: (value: AnalystDecisionResult) => void = () => {};
    const submitSpy = vi.spyOn(analystApi, 'submitAnalystDecision').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    render(<AnalystDecisionPanel caseId="case-1" latestRecommendation="MERCHANT_SUPPORTED" onDecided={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /support merchant/i }));
    const confirmButton = screen.getByRole('button', { name: /confirm decision/i });
    await user.click(confirmButton);
    await user.click(confirmButton);
    await user.click(confirmButton);

    resolveSubmit(buildResult());

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));
  });

  it('shows the API error message and keeps the dialog open on failure', async () => {
    vi.spyOn(analystApi, 'submitAnalystDecision').mockRejectedValue(
      new ApiError({ statusCode: 409, error: 'Conflict', message: 'Closed cases cannot be reviewed', timestamp: '', path: '' }),
    );
    render(<AnalystDecisionPanel caseId="case-1" latestRecommendation="MERCHANT_SUPPORTED" onDecided={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /support merchant/i }));
    await user.click(screen.getByRole('button', { name: /confirm decision/i }));

    expect(await screen.findByText('Closed cases cannot be reviewed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm decision/i })).toBeInTheDocument();
  });

  it('disables the actions and shows the reason when disabled', () => {
    render(
      <AnalystDecisionPanel
        caseId="case-1"
        latestRecommendation="MERCHANT_SUPPORTED"
        disabled
        disabledReason="This case is resolved and can no longer be decided."
        onDecided={vi.fn()}
      />,
    );

    expect(screen.getByText('This case is resolved and can no longer be decided.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /support card member/i })).toBeDisabled();
  });
});
