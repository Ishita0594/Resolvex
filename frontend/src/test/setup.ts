import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement matchMedia. Default every query to "not matching" (desktop
// viewport) so components using useMediaQuery/useIsMobileViewport render their default
// layout in tests; individual tests can override this with vi.spyOn to exercise the
// mobile branch.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
