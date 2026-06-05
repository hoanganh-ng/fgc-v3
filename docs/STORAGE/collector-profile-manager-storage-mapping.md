# Collector Profile Manager Storage Mapping

## Purpose

This document records the expected persistence shape for the Collector Profile Manager before a real database adapter exists. It is a storage direction, not an implementation. Application and domain code must continue to depend only on application-owned ports and domain schemas.

## Storage Direction

PostgreSQL is the likely database because it supports indexed relational columns for checkout and provisioning queries while still allowing JSONB storage for complex profile property groups.

The recommended shape is:

- Root-level columns for operational fields that are queried frequently.
- JSONB columns for complex profile property groups that are usually loaded as a whole.
- Application-level validation with Collector Profile Manager schemas before persisted data reaches use cases.
- Future transaction boundaries around checkout and lease creation, without adding transactions in the current sprint.

## Profile Storage

Suggested table: `collector_profiles`

Root-level columns:

- `profile_id`: primary key, maps to `identity.id`.
- `display_name`: maps to `identity.displayName`.
- `status`: maps to `identity.status`; indexed for lifecycle and checkout queries.
- `created_at`: maps to `identity.createdAt`.
- `updated_at`: maps to `identity.updatedAt` and supports future concurrency checks.
- `version`: integer for future optimistic conflict detection if the adapter needs compare-and-swap saves.
- `provisioning_token_status`: maps to `provisioningToken.status`.
- `provisioning_token_hash`: nullable lookup field for issued provisioning tokens. Store only a hash or equivalent protected lookup value when a production token boundary exists.
- `provisioning_token_issued_at`: maps to `provisioningToken.issuedAt`.
- `provisioning_token_expires_at`: maps to `provisioningToken.expiresAt`.
- `provisioning_token_consumed_at`: maps to `provisioningToken.consumedAt`.
- `last_checkout_at`: maps to `identity.lastCheckoutAt`.
- `last_released_at`: maps to `identity.lastReleasedAt`.
- `next_available_at`: maps to `identity.nextAvailableAt` and supports checkout availability filtering.
- `daily_usage_local_date`: maps to `identity.dailyUsage.localDate`.
- `daily_sessions_started`: maps to `identity.dailyUsage.sessionsStarted`.
- `daily_active_duration_minutes`: maps to `identity.dailyUsage.activeDurationMinutes`.
- `daily_macro_actions`: maps to `identity.dailyUsage.macroActions`.

JSONB columns:

- `identity_metadata`: remaining identity metadata such as optional external references and labels, if not promoted to columns.
- `network_context`: maps to the Network Context property group.
- `hardware_fingerprint`: maps to the Hardware Fingerprinting property group.
- `authentication_state`: maps to the Authentication State property group.
- `behavioral_persona`: maps to the Behavioral Persona property group.
- `temporal_routine`: maps to the Temporal Routine property group.
- `safety_thresholds`: maps to the Safety Thresholds property group.
- `content_affinities`: maps to the Content Affinities property group.

Mapping notes:

- Checkout metadata remains part of identity metadata and does not create another profile property group.
- The root-level operational columns should be kept synchronized with the JSON/domain representation when saving.
- Future adapters should validate loaded rows by reconstructing a `CollectorProfile` and passing it through the domain schema before use case orchestration.
- The repository port remains database-agnostic. It should expose use-case-oriented methods such as checkout candidate lookup rather than SQL fragments or generic query builders.

## Lease Storage

Suggested table: `collector_profile_leases`

Root-level columns:

- `lease_id`: primary key, maps to `ProfileLease.id`.
- `profile_id`: foreign key candidate to `collector_profiles.profile_id`.
- `status`: maps to `ProfileLease.status`.
- `leased_at`: maps to `ProfileLease.leasedAt`.
- `expires_at`: maps to `ProfileLease.expiresAt`.
- `released_at`: maps to `ProfileLease.releasedAt`.
- `created_at`: adapter-managed insert timestamp.
- `updated_at`: adapter-managed update timestamp.

Mapping notes:

- Active lease lookup should be supported by `profile_id` plus `status`.
- Release updates should change lease status and `released_at` together.
- Expiry handling remains an application/domain concern until a later sprint defines operational cleanup.

## Indexes

Recommended profile indexes:

- Primary key on `collector_profiles(profile_id)`.
- Index on `collector_profiles(status)`.
- Unique or selective index on `collector_profiles(provisioning_token_hash)` for rows with `provisioning_token_status = 'ISSUED'`.
- Composite checkout index on `collector_profiles(status, next_available_at)`.
- Optional index on `collector_profiles(daily_usage_local_date, daily_sessions_started)` if checkout volume requires additional filtering.

Recommended lease indexes:

- Primary key on `collector_profile_leases(lease_id)`.
- Index on `collector_profile_leases(profile_id)`.
- Partial unique index for one active lease per profile, such as `profile_id` where `status = 'ACTIVE'`.
- Composite index on `collector_profile_leases(profile_id, status)` for active lease lookup.

## Future Atomic Checkout Boundary

A future database adapter will likely need one transaction for checkout:

1. Locate candidate READY profiles using indexed operational fields.
2. Reconstruct and validate candidate profiles.
3. Confirm no active lease exists for the selected profile.
4. Save the profile transition to BUSY and operational checkout metadata.
5. Insert the active lease.

This sprint only documents that boundary and strengthens port contracts. It does not introduce transactions, database clients, migrations, or production persistence adapters.
