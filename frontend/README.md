# ResolveX Frontend

React, TypeScript, Vite, React Router, Axios, and Bootstrap.

Do not place backend or AI service code in this directory.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

The app runs at `http://localhost:5173` and expects the backend at
`VITE_API_BASE_URL` (default `http://localhost:3000/api`).

## Environment variables

All variables are read once, in `src/config/env.ts`, so the rest of the app never touches
`import.meta.env` directly.

| Variable                | Required | Default (derived)                     | Purpose                                                                                     |
| ------------------------ | -------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`      | Yes      | `http://localhost:3000/api`            | REST API base URL.                                                                            |
| `VITE_WS_BASE_URL`       | No       | `VITE_API_BASE_URL` with `/api` stripped | Realtime (Socket.IO) gateway origin. Only set this if the gateway is hosted separately from the REST API. |
| `VITE_APP_NAME`          | No       | `ResolveX`                             | Product name shown in the browser tab, top bar, and auth screens.                              |
| `VITE_DEMO_MODE_LABEL`   | No       | unset                                  | Optional badge (e.g. `Hackathon Demo`) shown in the top bar and on the login/landing screens. Leave unset for a production-looking build. |

See `.env.example` for a ready-to-copy template.

## Deployment (Vercel or any static host)

This is a single-page app: the build output in `dist/` is fully static, and any route not
matching a real asset must fall back to `index.html` so client-side routing can take over.

### Vercel

1. Import the repository into Vercel and set **Root Directory** to `frontend/`.
2. Vercel auto-detects Vite; `frontend/vercel.json` also pins the build command
   (`npm run build`), output directory (`dist`), and the SPA rewrite rule so deep links
   (e.g. `/analyst/queue`) don't 404 on refresh.
3. Add the environment variables above in the Vercel project settings (at minimum
   `VITE_API_BASE_URL` pointing at your deployed backend). Redeploy after changing them —
   Vite inlines `VITE_*` variables at build time.
4. Deploy. Every push to the connected branch gets a new preview URL; promote to production
   from the Vercel dashboard.

### Any other static host (Netlify, Cloudflare Pages, S3 + CloudFront, GitHub Pages, ...)

1. `npm run build` and upload the contents of `dist/`.
2. Configure the host to serve `index.html` for any unmatched path (a "SPA fallback" /
   "rewrite all to index.html" setting — the exact name varies by host).
3. Set the same `VITE_*` variables at build time before running `npm run build`.

## Demo accounts

Seeded by the backend (`npm run prisma:seed` in `backend/`):

- `member@resolvex.demo` — card member
- `merchant@resolvex.demo` — merchant
- `analyst@resolvex.demo` — analyst

Password: `ResolveXDemo123!` unless overridden by `RESOLVEX_DEMO_*` env vars on the backend.
This is a placeholder value baked into a non-production prototype build, not a pattern meant
to resemble a real credential.

The login screen's **Prototype demo accounts** panel (`src/pages/auth/DemoAccountsPanel.tsx`)
lists each role and one-click-fills its email; it never prints the password on screen.

## Landing page

Signed-out visitors hitting `/` see `src/pages/marketing/LandingPage.tsx`: a short product
pitch, a "not a fraud-detection system" clarification, one benefit card per stakeholder
(card member, merchant, analyst/issuer), a five-step workflow preview, and a link to sign in.
Authenticated users are redirected straight to their role's dashboard instead.

## Routing overview

- `/` — landing page (signed out) or redirect to your dashboard (signed in)
- `/login`, `/register` — auth
- `/unauthorized` — shown when a protected route is hit while signed out (401)
- `/forbidden` — shown when a signed-in user's role can't access a route (403)
- `/member/*`, `/merchant/*`, `/analyst/*` — role-gated app screens under the shared `AppLayout`
- `*` — 404 page

- JWT auth against `/api/auth/{register,login,profile}`, token persisted
  through `src/auth/tokenStorage.ts` (isolated so it can be swapped for
  HTTP-only cookies without touching call sites).
- Role-based routing: `CARD_MEMBER` → `/member/dashboard`, `MERCHANT` →
  `/merchant/dashboard`, `ANALYST` → `/analyst/dashboard`.
- `ProtectedRoute` blocks unauthenticated access (→ `/unauthorized`); `RoleRoute` blocks
  cross-role access (→ `/forbidden`).
- A 401 from any authenticated request clears the session and shows a
  "session expired" modal prompting re-login. A global banner appears if the browser goes
  offline or the API becomes unreachable.

## Commands

```bash
npm run dev       # start dev server
npm run build     # type-check + production build
npm run preview   # serve the production build locally (after npm run build)
npm run lint      # eslint
npm run test      # vitest (single run)
npm run test:watch
```
