## ADDED Requirements

### Requirement: Payment completion is based on trusted provider evidence
The system SHALL NOT mark a payment or enrollment paid solely from a client-provided transaction ID or client confirmation. Settlement SHALL require a valid signed provider callback or a verified server-side provider order query.

#### Scenario: A user submits a fabricated transaction ID
- **WHEN** the provider has not confirmed that the stored order was successfully paid
- **THEN** the payment and enrollment remain unpaid and the request does not publish a payment-success event

#### Scenario: A valid signed callback or provider query confirms the order
- **WHEN** provider status is successful and the tenant, app, merchant, order number, transaction ID, currency, and amount match the stored payment
- **THEN** the payment is completed once, the linked enrollment is marked paid, and existing notifications are dispatched idempotently

#### Scenario: Provider evidence is missing, invalid, or mismatched
- **WHEN** signature validation fails, the provider query is unavailable, the amount differs, or the provider returns a non-success state
- **THEN** the order remains unpaid/processing according to the documented state machine and an auditable reconciliation event is recorded

### Requirement: Payment callbacks and reconciliation are tenant bound
Every provider callback/query SHALL resolve its payment using the merchant order number and stored tenant, load that tenant’s payment configuration, validate provider evidence before state changes, and apply an atomic idempotent state transition.

#### Scenario: Duplicate payment callback or confirmation arrives
- **WHEN** the payment is already completed with validated provider evidence
- **THEN** the callback/confirmation responds idempotently without issuing duplicate payment events, coupon use, enrollment transitions, or notifications
