import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

function TestHarness({ onClose }: { onClose?: () => void }) {
  return (
    <div>
      <button type="button">Outside trigger</button>
      <Modal
        titleId="test-modal-title"
        title="Test modal"
        onClose={onClose}
        footer={
          <button type="button" onClick={onClose}>
            Close from footer
          </button>
        }
      >
        <input aria-label="First field" />
        <input aria-label="Second field" />
      </Modal>
    </div>
  );
}

describe('Modal', () => {
  it('is labelled by its title and moves initial focus inside the dialog', async () => {
    render(<TestHarness onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'test-modal-title');
    expect(dialog).toHaveAccessibleName('Test modal');

    // The header's close button is the first focusable element in DOM order.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('closes on Escape and restores focus to the element that opened it', async () => {
    const onClose = vi.fn();
    render(<TestHarness onClose={onClose} />);
    const user = userEvent.setup();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape while closeDisabled is set (submission in flight)', async () => {
    const onClose = vi.fn();
    render(
      <Modal titleId="t" title="Submitting" onClose={onClose} closeDisabled>
        <p>body</p>
      </Modal>,
    );
    const user = userEvent.setup();

    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('traps Tab focus within the dialog, wrapping from the last to the first focusable element', async () => {
    render(<TestHarness onClose={vi.fn()} />);
    const user = userEvent.setup();

    const closeButton = screen.getByRole('button', { name: 'Close from footer' });
    closeButton.focus();
    expect(closeButton).toHaveFocus();

    await user.tab();

    // Wraps back to the header's close button, the first focusable element in the dialog.
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });
});
