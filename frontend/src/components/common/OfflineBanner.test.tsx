import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { OfflineBanner } from './OfflineBanner';
import { API_AVAILABLE_EVENT, API_UNAVAILABLE_EVENT } from '../../api/client';

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    setNavigatorOnline(true);
  });

  afterEach(() => {
    setNavigatorOnline(true);
  });

  it('renders nothing while online and the API is reachable', () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows an offline message when the browser goes offline', async () => {
    render(<OfflineBanner />);

    setNavigatorOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(await screen.findByText(/you're offline/i)).toBeInTheDocument();

    setNavigatorOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows an API-unavailable message when a request fails with no response, and clears on the next success', async () => {
    render(<OfflineBanner />);

    act(() => {
      window.dispatchEvent(new CustomEvent(API_UNAVAILABLE_EVENT));
    });

    expect(await screen.findByText(/unable to reach the resolvex server/i)).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent(API_AVAILABLE_EVENT));
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
