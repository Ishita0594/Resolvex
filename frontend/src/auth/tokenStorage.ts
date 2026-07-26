// Prototype-only storage. All session persistence funnels through this module
// so the storage mechanism (currently localStorage) can be swapped for
// secure HTTP-only cookies later without touching call sites.
const TOKEN_KEY = 'resolvex.accessToken';

export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
