# Demo Scenarios

Use only synthetic data for demos.

## Scenario 1: Goods Not Received
- Category: `GOODS_NOT_RECEIVED`
- Card member claims the item was not delivered.
- Merchant uploads shipment tracking and delivery confirmation.
- Policy engine compares delivery evidence, order dates, and merchant response time.
- Conflicting delivery signals route the case to `HUMAN_REVIEW`.

## Scenario 2: Refund Not Processed
- Category: `REFUND_NOT_PROCESSED`
- Card member provides cancellation and refund request evidence.
- Merchant provides refund ledger evidence.
- Policy engine checks refund timing, amount, and transaction references.
- Missing refund proof routes the case to `HUMAN_REVIEW` or a deterministic outcome when evidence is sufficient.

## Scenario 3: Cancelled Goods or Services
- Category: `CANCELLED_GOODS_OR_SERVICES`
- Card member claims services were cancelled before fulfillment.
- Merchant provides cancellation policy and service fulfillment evidence.
- Policy engine evaluates cancellation timing, policy terms, and service usage evidence.
- Ambiguous terms or incomplete documents route the case to `HUMAN_REVIEW`.
