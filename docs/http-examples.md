# ResolveX HTTP Examples

These examples assume the Phase 9 Compose stack is running at `http://localhost:3000` and the demo seed password is `ResolveXDemo123!`. They use synthetic demo data only.

## Login

```powershell
$login = Invoke-RestMethod -Method Post http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{
  "email": "analyst@resolvex.demo",
  "password": "ResolveXDemo123!"
}'
$token = $login.accessToken
```

## Dispute Creation

```powershell
$memberLogin = Invoke-RestMethod -Method Post http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{
  "email": "member@resolvex.demo",
  "password": "ResolveXDemo123!"
}'
$memberHeaders = @{ Authorization = "Bearer $($memberLogin.accessToken)" }

Invoke-RestMethod -Method Post http://localhost:3000/api/disputes -Headers $memberHeaders -ContentType 'application/json' -Body '{
  "transactionId": "10000000-0000-4000-8000-000000000001",
  "reasonCode": "GOODS_NOT_RECEIVED",
  "cardMemberStatement": "The order was expected last week, but the package has not arrived."
}'
```

## Merchant Response

```powershell
$merchantLogin = Invoke-RestMethod -Method Post http://localhost:3000/api/auth/login -ContentType 'application/json' -Body '{
  "email": "merchant@resolvex.demo",
  "password": "ResolveXDemo123!"
}'
$merchantHeaders = @{ Authorization = "Bearer $($merchantLogin.accessToken)" }

Invoke-RestMethod -Method Post http://localhost:3000/api/disputes/91000000-0000-4000-8000-000000000001/merchant-response -Headers $merchantHeaders -ContentType 'application/json' -Body '{
  "merchantStatement": "We can show invoice and dispatch records, but no delivery confirmation is available.",
  "evidence": [
    {
      "requirementKey": "invoice",
      "evidenceType": "invoice",
      "value": "Invoice SCENARIO-A-ORDER exists."
    },
    {
      "requirementKey": "dispatch_record",
      "evidenceType": "dispatch_record",
      "value": "Dispatch record confirms shipment."
    }
  ]
}'
```

## Evidence Processing

```powershell
$target = Invoke-RestMethod -Method Post http://localhost:3000/api/disputes/91000000-0000-4000-8000-000000000001/evidence/upload-target -Headers $merchantHeaders -ContentType 'application/json' -Body '{
  "evidenceType": "delivery_confirmation",
  "fileName": "delivery-proof.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 2048
}'

Invoke-RestMethod -Method Post "http://localhost:3000/api/disputes/91000000-0000-4000-8000-000000000001/evidence/confirm" -Headers $merchantHeaders -ContentType 'application/json' -Body (@{
  evidenceId = $target.evidenceId
  fileHash = "4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7c75a5a5efcff8e"
} | ConvertTo-Json)

Invoke-RestMethod -Method Post "http://localhost:3000/api/evidence/$($target.evidenceId)/process" -Headers $merchantHeaders
```

For local multipart uploads, send file field `file` to the `uploadUrl` returned by `upload-target`.

## Evaluation

```powershell
$analystHeaders = @{ Authorization = "Bearer $token" }

Invoke-RestMethod -Method Post http://localhost:3000/api/disputes/91000000-0000-4000-8000-000000000001/evaluate -Headers $analystHeaders
Invoke-RestMethod -Method Get http://localhost:3000/api/disputes/91000000-0000-4000-8000-000000000001/explanation -Headers $analystHeaders
```

Stable Phase 9 scenario IDs:

- Scenario A card member supported: `91000000-0000-4000-8000-000000000001`
- Scenario B merchant supported: `91000000-0000-4000-8000-000000000002`
- Scenario C human review: `91000000-0000-4000-8000-000000000003`
- Scenario D refund not processed: `91000000-0000-4000-8000-000000000004`

## Analyst Decision

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/analyst/cases/91000000-0000-4000-8000-000000000003/decision -Headers $analystHeaders -ContentType 'application/json' -Body '{
  "decision": "ESCALATE",
  "analystNotes": "Delivery location conflicts with the recipient evidence and confidence is below the automatic threshold."
}'
```

Override decisions must include `overrideReason` when they differ from the latest system recommendation.
