const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

/** REST base URL, e.g. https://api.resolvex.demo/api */
export const API_BASE_URL = rawApiBaseUrl;

/**
 * WebSocket gateway base URL. Falls back to the API base URL with the `/api` suffix
 * stripped, since the case-events gateway is mounted on the bare Nest HTTP server.
 * Set VITE_WS_BASE_URL explicitly when the socket gateway is hosted on a different
 * origin than the REST API (common with some static-host + serverless-API setups).
 */
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || rawApiBaseUrl.replace(/\/api\/?$/, '');

/** Product name shown in the top bar, browser tab, and auth screens. */
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'ResolveX';

/** Optional label (e.g. "Hackathon Demo") shown as a badge when this build is a demo deployment. Unset in production. */
export const DEMO_MODE_LABEL = import.meta.env.VITE_DEMO_MODE_LABEL || null;
