# Status Machine

## Case Statuses
- `DRAFT`
- `SUBMITTED`
- `AWAITING_MERCHANT`
- `EVIDENCE_PROCESSING`
- `UNDER_EVALUATION`
- `HUMAN_REVIEW`
- `RESOLVED`
- `APPEALED`
- `CLOSED`

## Merchant Response Statuses
- `PENDING`
- `SUBMITTED`
- `REOPENED`

## Evidence Processing Statuses
- `UPLOADED`
- `PROCESSING`
- `PROCESSED`
- `FAILED`
- `VERIFIED`

## Transition Rules
| From | To | Trigger Role | Reason |
| --- | --- | --- | --- |
| `DRAFT` | `SUBMITTED` | `CARD_MEMBER` | Card member submits a disputed transaction case. |
| `SUBMITTED` | `AWAITING_MERCHANT` | `ANALYST` | Analyst or system requests merchant evidence. |
| `AWAITING_MERCHANT` | `EVIDENCE_PROCESSING` | `MERCHANT` | Merchant uploads required evidence. |
| `SUBMITTED` | `EVIDENCE_PROCESSING` | `ANALYST` | Analyst confirms enough evidence exists without merchant follow-up. |
| `EVIDENCE_PROCESSING` | `UNDER_EVALUATION` | `ANALYST` | Structured evidence extraction is complete and ready for policy evaluation. |
| `UNDER_EVALUATION` | `RESOLVED` | `ANALYST` | Deterministic policy engine reaches a supported outcome with sufficient confidence. |
| `UNDER_EVALUATION` | `HUMAN_REVIEW` | `ANALYST` | Evidence is incomplete, low-confidence, or conflicting. |
| `UNDER_EVALUATION` | `AWAITING_MERCHANT` | `ANALYST` | Analyst requests more information before completing review. |
| `HUMAN_REVIEW` | `AWAITING_MERCHANT` | `ANALYST` | Analyst requests more information from the parties. |
| `HUMAN_REVIEW` | `RESOLVED` | `ANALYST` | Analyst resolves the case using policy rules and structured evidence. |
| `RESOLVED` | `APPEALED` | `CARD_MEMBER` | Card member appeals the decision. |
| `RESOLVED` | `APPEALED` | `MERCHANT` | Merchant appeals the decision. |
| `APPEALED` | `HUMAN_REVIEW` | `ANALYST` | Analyst accepts the appeal for review. |
| `APPEALED` | `CLOSED` | `ANALYST` | Analyst rejects or finalizes the appeal. |
| `RESOLVED` | `CLOSED` | `ANALYST` | Case is finalized after the appeal window or final analyst action. |

## Invariants
- AI models cannot transition a case to `RESOLVED`.
- `RESOLVED` requires deterministic policy output and structured evidence references.
- Low-confidence or conflicting evidence must transition to `HUMAN_REVIEW`.
- `CLOSED` is terminal.
- Analyst overrides require an override reason when the analyst decision differs from the latest system recommendation.
- Analyst decisions and information requests must create audit log entries and timeline events.
- Case status broadcasts must contain safe display metadata only and must not include complete evidence content.
- Merchant responses can move a case from `AWAITING_MERCHANT` to `EVIDENCE_PROCESSING` only after a valid structured response.
- Duplicate final merchant responses are blocked once `merchantResponseStatus` is `SUBMITTED`.
- Merchant responses after `responseDeadline` are blocked unless an analyst workflow has reopened the merchant response window with `merchantResponseStatus` set to `REOPENED`.
- AI evidence processing may move an evidence item from `UPLOADED` or `FAILED` to `PROCESSING`, then to `PROCESSED` or `FAILED`.
- AI processing never moves a case to `RESOLVED`; it only creates reviewable `ExtractedFact` rows.
- User-corrected or user-verified extracted facts must be preserved by later processing attempts.
