# Sprint 043: Assisted Group Access Checkout Foundation

## Goal

Establish a distinct, safe Collector Profile Manager checkout contract for
future operator-assisted Facebook group access sessions.

This sprint must not launch a browser, perform group actions, inspect access in
a browser, mutate profile-source access state, or add operator/Web UI/runtime
execution behavior.

## Scope

- Add `ASSISTED_GROUP_ACCESS` as a Collector Profile Manager lease purpose.
- Add a purpose-specific assisted group access checkout use case.
- Add `POST /collector/profiles/:profileId/assisted-group-access/checkout`.
- Require a non-empty `sourceGroupId` request body and reject unexpected fields.
- Validate source-group existence through the existing
  `SourceGroupReferencePort`.
- Perform source-group validation before entering the Profile Manager
  transaction.
- Run eligibility checks, active-lease checks, profile mutation, and lease
  creation through transaction-scoped Profile Manager repositories.
- Create an `ASSISTED_GROUP_ACCESS` lease and mark the profile `BUSY`.
- Return only safe lease data and minimal safe profile data.
- Ensure release and trusted runtime-configuration flows work for active
  assisted leases and reject released or expired leases.

## Eligibility

Assisted group access checkout is for a specified profile and source group.

The profile must satisfy the existing checkout safety gates:

- `status = READY`
- captured authentication session
- configured network context
- configured hardware fingerprint
- valid temporal routine and active window
- cooldown availability
- daily safety thresholds and usage limits
- no active lease

Account-stage eligibility is purpose-specific:

- Allowed: `WARMING`, `COLLECTION_READY`
- Rejected: `NEW_ACCOUNT`, `LIMITED`, `NEEDS_REVIEW`, `RETIRED`

Account-stage rejection must use a distinct typed reason such as
`ACCOUNT_STAGE_NOT_ASSISTED_GROUP_ACCESS_ELIGIBLE`; it must not reuse the
ambient exercise reason.

## Source Access Boundary

Assisted group access checkout does not require successful profile-source
access. The purpose of this checkout is to establish or inspect access in a
future operator-assisted workflow.

The checkout must not create, update, refresh, or otherwise mutate
profile-source access records. Existing records must remain unchanged.

`sourceGroupId` must not be stored on the generic profile lease.

## Out Of Scope

- Browser code
- Operator CLI code
- Web UI changes
- Collector Runtime scheduler behavior
- Entry-route consumption
- Collection run records or assisted-access run records
- Automated group joining
- Browser-backed access detection
- Automatic account-stage changes
- Automatic profile-source access changes
- CAPTCHA solving
- Checkpoint bypass
- Credential automation
- Posting, commenting, liking, sharing, messaging, or other platform actions

## Testing Requirements

Add focused coverage for:

- `WARMING` success
- `COLLECTION_READY` success
- rejection for `NEW_ACCOUNT`, `LIMITED`, `NEEDS_REVIEW`, and `RETIRED`
- existing readiness/configuration/authentication/temporal/cooldown/safety rules
- active lease conflict
- required and malformed HTTP `sourceGroupId`
- unknown source group
- source-group validation before transaction entry
- persisted lease purpose `ASSISTED_GROUP_ACCESS`
- success without a profile-source access record
- existing profile-source access records unchanged
- transaction-scoped repository usage
- lease release lifecycle
- active versus released/expired runtime-configuration access
- schema, migration, mapper, repository, and DB-backed HTTP behavior

## Verification

Run and report:

- `pnpm --filter @fgc/web typecheck`
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:migrate`
- `DATABASE_URL="postgres://content_pipeline:content_pipeline@localhost:5432/content_pipeline" pnpm test:db`
- `DATABASE_URL="postgres://content_pipeline:content_pipeline@localhost:5432/content_pipeline" pnpm test:http:db`
