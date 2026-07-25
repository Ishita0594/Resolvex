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

## Demo accounts

Seeded by the backend (`npm run prisma:seed` in `backend/`):

- `member@resolvex.demo`
- `merchant@resolvex.demo`
- `analyst@resolvex.demo`

Password: `ResolveXDemo123!` unless overridden by `RESOLVEX_DEMO_*` env vars.
The login page has one-click buttons that fill these in.

## Phase 1 — Auth and app skeleton

- JWT auth against `/api/auth/{register,login,profile}`, token persisted
  through `src/auth/tokenStorage.ts` (isolated so it can be swapped for
  HTTP-only cookies without touching call sites).
- Role-based routing: `CARD_MEMBER` → `/member/dashboard`, `MERCHANT` →
  `/merchant/dashboard`, `ANALYST` → `/analyst/dashboard`.
- `ProtectedRoute` blocks unauthenticated access; `RoleRoute` blocks
  cross-role access and redirects to `/unauthorized`.
- A 401 from any authenticated request clears the session and shows a
  "session expired" modal prompting re-login.

## Commands

```bash
npm run dev       # start dev server
npm run build     # type-check + production build
npm run lint      # eslint
npm run test      # vitest (single run)
npm run test:watch
```
