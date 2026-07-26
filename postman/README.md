# ResolveX Postman Collection

This folder contains directly importable Postman assets for the implemented ResolveX backend and local AI service.

## Files

- `ResolveX.postman_collection.json`
- `ResolveX.local.postman_environment.json`
- `test-data/README.md`

## Start Services

Using Docker Compose from the repository root:

```powershell
copy .env.example .env
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:8000/health
```

Running manually:

```powershell
cd backend
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn app.main:app --reload
```

## Import

1. Open Postman.
2. Import `postman/ResolveX.postman_collection.json`.
3. Import `postman/ResolveX.local.postman_environment.json`.
4. Select the `ResolveX Local Development Only` environment.
5. Run the login requests in `01 - Authentication` first.

Login requests automatically populate:

- `memberToken`, `memberUserId`
- `merchantToken`, `merchantUserId`
- `analystToken`, `analystUserId`

Other requests save IDs such as `transactionId`, `caseId`, `evidenceId`, `requirementId`, `decisionId`, `reviewId`, and `notificationId` when the response contains them.

## Demo Accounts

Local seed credentials:

- Card member: `member@resolvex.demo`
- Merchant: `merchant@resolvex.demo`
- Analyst: `analyst@resolvex.demo`
- Password: `ResolveXDemo123!`

This is a development-only demo password from the seed documentation. Do not use it outside local judging or demos.

## Supported Reason Codes

- `GOODS_NOT_RECEIVED`
- `REFUND_NOT_PROCESSED`
- `CANCELLED_GOODS_OR_SERVICES`

## Local Base URLs

- Backend: `http://localhost:3000/api`
- AI service: `http://localhost:8000`
- Swagger UI: `http://localhost:3000/api/docs`

## Recommended Folder Order

1. `00 - Health and Setup`
2. `01 - Authentication`
3. `02 - Transactions`
4. `03 - Card Member Disputes`
5. `04 - Merchant Workflow`
6. `05 - Policy Requirements`
7. `06 - Evidence Upload and Management`
8. `07 - OCR and AI Processing`
9. `08 - Policy Evaluation`
10. `09 - Analyst Review`
11. `10 - Notifications`
12. `11 - Audit and Timeline`
13. `12 - Negative and Authorization Tests`
14. `13 - Complete Demo Flows`

## Collection Runner

Use the Collection Runner for the seeded demo flows in `13 - Complete Demo Flows`. These flows use stable seeded case IDs:

- Scenario A: `91000000-0000-4000-8000-000000000001`
- Scenario B: `91000000-0000-4000-8000-000000000002`
- Scenario C: `91000000-0000-4000-8000-000000000003`
- Scenario D: `91000000-0000-4000-8000-000000000004`

Some negative tests intentionally expect `400`, `401`, `403`, `404`, or `409`.

## Manual Evidence Files

Postman cannot attach a repository file automatically after import. For requests named `Local Multipart Upload` or `Direct AI - Parse Document File`:

1. Open the request body.
2. Keep the form-data key as `file`.
3. Change the value from blank to a local file.
4. Use a PDF, PNG, JPG, or JPEG.
5. For backend local upload, the selected file name, MIME type, and byte size must match the earlier upload-target request exactly.

The default backend maximum evidence size is `10485760` bytes.

## WebSocket Events

Socket.IO namespace: `/case-events`.

Clients authenticate with `handshake.auth.token` or `Authorization: Bearer <token>`, then may emit `case.subscribe` with `{ "caseId": "uuid" }`.

Implemented server events:

- `case.status.updated`
- `evidence.processing.completed`
- `merchant.response.received`
- `analyst.review.required`
- `decision.generated`
- `information.requested`

WebSocket calls are documented here rather than modeled as normal HTTP requests.

## Known Limitations

- The collection does not include planned APIs that are not implemented.
- No generic dispute update, delete, appeal, policy CRUD, or demo reset HTTP endpoint exists.
- The backend exposes only the latest stored evaluation through HTTP; earlier decision records are preserved in PostgreSQL but no dedicated decision-history endpoint exists.
- Local demo evidence rows are seeded as metadata/facts; seeded file bytes may not exist in local storage, so temporary download requests can return `404` until a real file is uploaded.
- Prototype policy rules are ResolveX assumptions for demo validation. They are not official legal, card-network, or American Express policy.

Do not commit real JWTs, passwords, evidence, cardholder data, AWS credentials, Neon URLs, or production secrets.
