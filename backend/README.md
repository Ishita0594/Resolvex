# ResolveX Backend

NestJS, TypeScript, Prisma, PostgreSQL, JWT authentication, and role-based authorization live here.

Do not place frontend or AI service code in this directory.

## Setup
```powershell
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init_auth
npm run prisma:seed
```

The seed script creates prototype users for local demos:
- `member@resolvex.demo`
- `merchant@resolvex.demo`
- `analyst@resolvex.demo`

Set `RESOLVEX_DEMO_PASSWORD` or role-specific `RESOLVEX_DEMO_*_PASSWORD` values in `.env`. If omitted, the script uses the documented development-only fallback `ResolveXDemo123!`.

## Commands
```powershell
npm run start:dev
npm run lint
npm run build
npm test
```
