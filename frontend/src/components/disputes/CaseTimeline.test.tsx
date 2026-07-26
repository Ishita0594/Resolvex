import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CaseTimeline } from './CaseTimeline';
import type { TimelineEvent } from '../../types/domain';

const OUT_OF_ORDER_EVENTS: TimelineEvent[] = [
  {
    id: 'evt-2',
    caseId: 'case-1',
    eventType: 'CASE_AWAITING_MERCHANT',
    description: 'Merchant response requested.',
    performedBy: null,
    metadata: null,
    createdAt: '2026-07-25T00:00:00.000Z',
  },
  {
    id: 'evt-1',
    caseId: 'case-1',
    eventType: 'CASE_SUBMITTED',
    description: 'Card member submitted the dispute.',
    performedBy: 'member-1',
    metadata: null,
    createdAt: '2026-07-24T00:00:00.000Z',
  },
  {
    id: 'evt-3',
    caseId: 'case-1',
    eventType: 'CASE_RESOLVED',
    description: 'Case resolved.',
    performedBy: 'analyst-1',
    metadata: null,
    createdAt: '2026-07-26T00:00:00.000Z',
  },
];

describe('CaseTimeline', () => {
  it('renders events in chronological order regardless of input order', () => {
    render(<CaseTimeline events={OUT_OF_ORDER_EVENTS} />);

    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items[0]).toContain('Card member submitted the dispute.');
    expect(items[1]).toContain('Merchant response requested.');
    expect(items[2]).toContain('Case resolved.');
  });

  it('shows an empty message when there are no events', () => {
    render(<CaseTimeline events={[]} />);
    expect(screen.getByText(/no timeline events yet/i)).toBeInTheDocument();
  });
});
