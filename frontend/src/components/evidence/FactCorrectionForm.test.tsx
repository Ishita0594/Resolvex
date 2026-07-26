import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FactCorrectionForm } from './FactCorrectionForm';
import type { ExtractedFact } from '../../types/domain';

function buildFact(overrides: Partial<ExtractedFact> = {}): ExtractedFact {
  return {
    id: 'fact-1',
    evidenceId: 'evidence-1',
    factType: 'DELIVERY_STATUS',
    factValue: 'Not delivered',
    normalizedValue: null,
    confidence: 0.72,
    sourcePage: 1,
    verifiedByUser: false,
    correctedByUser: false,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('FactCorrectionForm', () => {
  it('preserves and displays the original value while the user edits a new one', async () => {
    render(<FactCorrectionForm fact={buildFact()} onCancel={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByText('Not delivered', { selector: 'span' })).toBeInTheDocument();

    const input = screen.getByLabelText('Corrected value');
    await userEvent.clear(input);
    await userEvent.type(input, 'Delivered on time');

    expect(screen.getByText('Not delivered', { selector: 'span' })).toBeInTheDocument();
    expect(input).toHaveValue('Delivered on time');
  });

  it('requires confirmation before submitting a correction', async () => {
    const onSubmit = vi.fn();
    render(<FactCorrectionForm fact={buildFact()} onCancel={vi.fn()} onSubmit={onSubmit} />);

    const input = screen.getByLabelText('Corrected value');
    await userEvent.clear(input);
    await userEvent.type(input, 'Delivered on time');

    await userEvent.click(screen.getByRole('button', { name: /save correction/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/confirm this correction/i)).toBeInTheDocument();
    expect(screen.getByText('Delivered on time')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /confirm correction/i }));
    expect(onSubmit).toHaveBeenCalledWith({ factValue: 'Delivered on time', verifiedByUser: false });
  });

  it('includes the verification checkbox state when submitting', async () => {
    const onSubmit = vi.fn();
    render(<FactCorrectionForm fact={buildFact()} onCancel={vi.fn()} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByLabelText(/i have verified this value is correct/i));
    await userEvent.click(screen.getByRole('button', { name: /save correction/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm correction/i }));

    expect(onSubmit).toHaveBeenCalledWith({ factValue: 'Not delivered', verifiedByUser: true });
  });

  it('disables submission until something has changed', () => {
    render(<FactCorrectionForm fact={buildFact()} onCancel={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save correction/i })).toBeDisabled();
  });

  it('lets the user cancel without submitting', async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    render(<FactCorrectionForm fact={buildFact()} onCancel={onCancel} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
