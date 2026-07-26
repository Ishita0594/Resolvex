import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExtractedFactsPanel } from './ExtractedFactsPanel';
import type { ExtractedFact } from '../../types/domain';

function buildFact(overrides: Partial<ExtractedFact> = {}): ExtractedFact {
  return {
    id: 'fact-1',
    evidenceId: 'evidence-1',
    factType: 'REFUND_AMOUNT',
    factValue: '49.99',
    normalizedValue: '49.99 USD',
    confidence: 0.91,
    sourcePage: 2,
    verifiedByUser: false,
    correctedByUser: false,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('ExtractedFactsPanel', () => {
  it('shows an empty state when there are no extracted facts', () => {
    render(<ExtractedFactsPanel facts={[]} canEdit onStartEdit={vi.fn()} onCancelEdit={vi.fn()} onSubmitCorrection={vi.fn()} />);
    expect(screen.getByText(/no facts have been extracted/i)).toBeInTheDocument();
  });

  it('renders each fact with its name, extracted value, normalized value, confidence, and source page', () => {
    render(
      <ExtractedFactsPanel
        facts={[buildFact()]}
        canEdit
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSubmitCorrection={vi.fn()}
      />,
    );

    expect(screen.getByText('Refund Amount')).toBeInTheDocument();
    expect(screen.getByText('49.99')).toBeInTheDocument();
    expect(screen.getByText('49.99 USD')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('High confidence (91%)')).toBeInTheDocument();
    expect(screen.getByText('AI extracted')).toBeInTheDocument();
  });

  it('distinguishes a user-corrected fact from an AI-extracted one', () => {
    render(
      <ExtractedFactsPanel
        facts={[buildFact({ correctedByUser: true, verifiedByUser: true })]}
        canEdit
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSubmitCorrection={vi.fn()}
      />,
    );

    expect(screen.getByText('User corrected')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByText('AI extracted')).not.toBeInTheDocument();
  });

  it('shows the edit action when the current user can edit', () => {
    render(
      <ExtractedFactsPanel
        facts={[buildFact()]}
        canEdit
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSubmitCorrection={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('hides the edit action when the current user is not authorized to edit', () => {
    render(
      <ExtractedFactsPanel
        facts={[buildFact()]}
        canEdit={false}
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSubmitCorrection={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('opens the correction form for a fact when its edit action is used', async () => {
    const onStartEdit = vi.fn();
    render(
      <ExtractedFactsPanel
        facts={[buildFact()]}
        canEdit
        onStartEdit={onStartEdit}
        onCancelEdit={vi.fn()}
        onSubmitCorrection={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onStartEdit).toHaveBeenCalledWith('fact-1');
  });

  it('renders the correction form inline for the fact being edited', () => {
    render(
      <ExtractedFactsPanel
        facts={[buildFact()]}
        canEdit
        editingFactId="fact-1"
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSubmitCorrection={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Corrected value')).toBeInTheDocument();
  });
});
