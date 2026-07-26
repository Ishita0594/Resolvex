import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DemoAccountsPanel } from './DemoAccountsPanel';

describe('DemoAccountsPanel', () => {
  it('lists every seeded role account without printing the shared demo password', () => {
    render(<DemoAccountsPanel onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: /card member/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /merchant/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyst/i })).toBeInTheDocument();

    expect(screen.queryByText('ResolveXDemo123!')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('ResolveXDemo123!');
  });

  it('reports the selected account email to the caller', async () => {
    const onSelect = vi.fn();
    render(<DemoAccountsPanel onSelect={onSelect} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /analyst/i }));

    expect(onSelect).toHaveBeenCalledWith('analyst@resolvex.demo');
  });
});
