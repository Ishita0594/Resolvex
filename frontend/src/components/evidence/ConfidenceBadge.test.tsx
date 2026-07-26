import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidenceBadge, getConfidenceLevel } from './ConfidenceBadge';

describe('getConfidenceLevel', () => {
  it('bands confidence into high, medium, and low', () => {
    expect(getConfidenceLevel(0.85)).toBe('high');
    expect(getConfidenceLevel(0.99)).toBe('high');
    expect(getConfidenceLevel(0.6)).toBe('medium');
    expect(getConfidenceLevel(0.84)).toBe('medium');
    expect(getConfidenceLevel(0.59)).toBe('low');
    expect(getConfidenceLevel(0)).toBe('low');
  });
});

describe('ConfidenceBadge', () => {
  it('renders an accessible text label for high confidence, not just a color', () => {
    render(<ConfidenceBadge confidence={0.92} />);
    expect(screen.getByText('High confidence (92%)')).toBeInTheDocument();
  });

  it('renders an accessible text label for medium confidence', () => {
    render(<ConfidenceBadge confidence={0.7} />);
    expect(screen.getByText('Medium confidence (70%)')).toBeInTheDocument();
  });

  it('renders an accessible text label for low confidence', () => {
    render(<ConfidenceBadge confidence={0.3} />);
    expect(screen.getByText('Low confidence (30%)')).toBeInTheDocument();
  });

  it('renders a fallback label when no confidence score is available', () => {
    render(<ConfidenceBadge confidence={null} />);
    expect(screen.getByText('Not scored')).toBeInTheDocument();
  });
});
