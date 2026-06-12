# Sprint 041A: Profile-Source Access Domain + Storage

## Goal

Add the backend-core foundation for tracking whether a specific Collector Profile Manager profile can access a specific Content Manager source group.

Profile-source access is profile-specific readiness/access data. It is distinct from Content Manager source group status and distinct from profile account maturity/readiness stage.

## Scope

- Add a Profile-Source Access domain model under Collector Profile Manager.
- Add application repository ports and use cases for upserting, getting, and listing access records.
- Add safe application DTO mapping for profile-source access records.
- Add PostgreSQL/Drizzle storage for profile-source access records.
- Store `sourceGroupId` as an external module reference string.
- Reference Collector Profile Manager profiles if consistent with existing schema.
- Update documentation for ownership and safety boundaries.

## Access States

- `UNKNOWN`
- `PUBLIC_ACCESSIBLE`
- `JOIN_REQUIRED`
- `JOIN_REQUESTED`
- `JOINED_ACCESSIBLE`
- `ACCESS_DENIED`
- `LOGIN_REQUIRED`
- `CHECKPOINT_REQUIRED`
- `NEEDS_MANUAL_REVIEW`

## Record Fields

- `id`
- `profileId`
- `sourceGroupId`
- `accessState`
- `lastCheckedAt`
- `lastSuccessfulAt`
- `lastFailureReason`
- `joinRequestedAt`
- `notes`
- `createdAt`
- `updatedAt`

`lastFailureReason` is a sanitized `{ code, message }` object only.

## Behavior

- Upsert can set any valid access state.
- `lastCheckedAt` updates on every upsert/update.
- `lastSuccessfulAt` updates when state becomes `PUBLIC_ACCESSIBLE` or `JOINED_ACCESSIBLE`.
- `joinRequestedAt` updates when state becomes `JOIN_REQUESTED`.
- `createdAt` is preserved on update.
- `updatedAt` changes on update.
- This sprint does not validate source group existence. Source group validation can be added later through an explicit Content Manager-facing port or API adapter.

## Persistence

Add `collector_profile_source_access`.

Required constraints and indexes:

- Unique `profile_id + source_group_id`.
- Index `profile_id`.
- Index `source_group_id`.
- Index `access_state`.
- Index `updated_at`.

Do not add a database foreign key to Content Manager source group tables in this sprint.

## Out of Scope

- HTTP endpoints.
- Web UI.
- Source group existence validation through Content Manager.
- Assisted Group Access Session.
- Group Access Check runner.
- Category Browse Exercise.
- Ambient Exercise changes.
- Scheduler behavior.
- Collection worker changes.
- Browser automation.
- Automatic group joining.
- Automatic search.
- Likes, comments, posts, shares, messages, or friend requests.
- CAPTCHA solving.
- Checkpoint bypass.
- Credential automation.
- Profile stage auto-promotion or auto-demotion.

## Safety Boundaries

Profile-source access records and DTOs must not expose:

- cookies
- localStorage
- proxy credentials
- session headers
- provisioning tokens
- token hashes
- trusted runtime configuration
- browser fingerprint secrets
- raw page HTML
- screenshots
- raw Facebook payloads

## Verification

- `pnpm typecheck`
- `pnpm test`

When `DATABASE_URL` is available:

- `pnpm db:migrate`
- `pnpm test:http:db`
