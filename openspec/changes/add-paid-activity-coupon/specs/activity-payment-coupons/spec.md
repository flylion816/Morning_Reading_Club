## ADDED Requirements

### Requirement: Paid Activity Registration Pricing
The system SHALL allow administrators to configure a community activity as free or paid and SHALL store all monetary amounts as integer fen.

#### Scenario: Configure a paid activity
- **WHEN** an administrator saves an activity with paid registration enabled and a positive price
- **THEN** the activity retains that price as a non-negative integer in fen

#### Scenario: Preserve free registration
- **WHEN** an administrator saves an activity without paid registration
- **THEN** users can register without creating a payment order

### Requirement: Activity Coupon Redemption
The system SHALL issue tenant-scoped coupons to selected users and SHALL apply at most one active, unexpired coupon automatically to a paid activity registration.

#### Scenario: Apply one eligible coupon
- **WHEN** a user registers for a paid activity and has an active coupon valid for that activity or all paid activities
- **THEN** the system calculates the discounted amount and associates only that coupon with the registration

#### Scenario: Reject unavailable coupons
- **WHEN** a coupon is expired, already used, outside the activity scope, or belongs to another tenant or user
- **THEN** that coupon cannot reduce the activity price or be consumed

### Requirement: Activity Payment Settlement
The system SHALL keep period-enrollment payments backward compatible while recording activity payments against their activity registration and marking payment/coupon state atomically on successful settlement.

#### Scenario: Settle an activity payment
- **WHEN** an activity registration payment succeeds
- **THEN** the registration becomes paid, its paid amount and payment reference are retained, and the redeemed coupon is marked used exactly once

#### Scenario: Preserve period payments
- **WHEN** a user pays for a period enrollment
- **THEN** the existing enrollment payment flow and data references remain unchanged

### Requirement: Coupon Administration Security
The system SHALL restrict activity coupon creation, modification, deletion, and issuance to authenticated tenant administrators.

#### Scenario: Manage coupons as an administrator
- **WHEN** an authenticated administrator with the required activity management access submits a coupon change
- **THEN** the system applies the change within the selected tenant

#### Scenario: Reject unauthorized coupon management
- **WHEN** a non-administrator attempts to create, modify, delete, or issue a coupon
- **THEN** the system rejects the request without changing coupon data
