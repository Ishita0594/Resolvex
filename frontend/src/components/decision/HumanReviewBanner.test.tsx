import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HumanReviewBanner } from './HumanReviewBanner';

describe('HumanReviewBanner', () => {
  it('explains that automation stopped without implying either party has won', () => {
    render(<HumanReviewBanner reason={null} />);
    expect(screen.getByText('This case needs human review')).toBeInTheDocument();
    expect(screen.getByText(/does not mean either party has already won or lost/i)).toBeInTheDocument();
  });

  it('lists the backend-provided reasons as plain sentences', () => {
    render(
      <HumanReviewBanner reason="confidence 62 is below threshold 85; decision margin 10 is below threshold 20" />,
    );
    expect(screen.getByText('Why automation stopped:')).toBeInTheDocument();
    expect(screen.getByText('Confidence 62 is below threshold 85')).toBeInTheDocument();
    expect(screen.getByText('Decision margin 10 is below threshold 20')).toBeInTheDocument();
  });

  it('omits the reasons list entirely when no reason is provided', () => {
    render(<HumanReviewBanner reason={null} />);
    expect(screen.queryByText('Why automation stopped:')).not.toBeInTheDocument();
  });

  it('never renders raw JSON', () => {
    const { container } = render(<HumanReviewBanner reason="confidence 40 is below threshold 85" />);
    expect(container.textContent).not.toMatch(/[{[]"\w+":/);
  });
});
