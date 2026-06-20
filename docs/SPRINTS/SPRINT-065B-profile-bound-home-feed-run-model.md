# Sprint 065B: Profile-Bound Home-Feed Run Model

## Goal

Add a separate durable Collector Runtime aggregate for profile-bound
Facebook home-feed collection run requests. The run model records a
profile as the operational target, exposes a safe operator request /
list / get / cancel HTTP surface, and prepares internal application
seams for future execution without invoking browser automation or the
Sprint 065A extractor.

Sprint 065B does not execute a browser, navigate Facebook, capture
payloads, invoke the home-feed extractor, submit Content Manager items,
observe `SourcePublisher`, run a worker or scheduler, modify Docker, or
add Web UI behavior. It makes no live-Facebook validation claim.

## Required Context

- `docs/SPRINTS/active.md`
- `docs/SPRINTS/SPRINT-065A-facebook-home-feed-extractor-fixtures.md`
- `src/collector-runtime/domain/collection-run*`
- `src/collector-runtime/domain/profile-source-access-check-run*`
- `src/collector-runtime/application/*collection-run*`
- `src/collector-runtime/application/*profile-source-access-check-run*`
- `src/infrastructure/database/schema/collector-runtime.schema.ts`
- `src/infrastructure/database/mappers/collector-runtime.mapper.ts`
- `src/infrastructure/database/mappers/profile-source-access-check-run.mapper.ts`
- `src/infrastructure/database/repositories/drizzle-collection-run.repository.ts`
- `src/infrastructure/database/repositories/drizzle-profile-source-access-check-run.repository.ts`
- `src/interfaces/http/routes/collector-runtime.routes.ts`
- `src/interfaces/http/schemas/collector-runtime.http-schemas.ts`
- `src/composition/collector-runtime/**`
- Relevant nearby tests for the files above

## Capability Summary

- Adds `ProfileHomeFeedCollectionRun` as a separate Collector Runtime
  aggregate. It does not reuse `CollectionRun`, does not make
  `CollectionRun.sourceGroupId` optional, and does not create a fake
  home-feed `SourceGroup`.
- The target is strict:
  `{ platform: "FACEBOOK", surface: "PROFILE_HOME_FEED" }`.
- The operational target reference is `profileId`.
- The trigger type is `MANUAL_API` only.
- Statuses are `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, and
  `CANCELED`.
- Valid transitions are:
  `QUEUED -> RUNNING | CANCELED`,
  `RUNNING -> SUCCEEDED | FAILED`; terminal states cannot transition.
- Lifecycle timestamp and payload invariants are exact:
  `QUEUED` has no `startedAt`, no `finishedAt`, no `summary`, and no
  `failureReason`; `RUNNING` requires `startedAt` and has no
  `finishedAt`, no `summary`, and no `failureReason`; `SUCCEEDED`
  requires `startedAt`, `finishedAt`, and `summary`, and has no
  `failureReason`; `FAILED` requires `startedAt`, `finishedAt`, and
  `failureReason`, with optional `summary`; `CANCELED` requires
  `finishedAt` and has no `startedAt`, no `summary`, and no
  `failureReason`.
- Request parameters are optional and strictly validated:
  `maxScrolls`, `maxDurationMs`, and `maxPosts`.
- Persisted summaries and failure reasons are sanitized allowlists:
  summary count/boolean fields only, and failure `{ code, message }`
  only. The exact summary fields are `capturedPayloads`,
  `extractorCandidates`, `sourcePublishersObserved`,
  `contentItemsSubmitted`, `failedPublisherObservations`,
  `failedContentSubmissions`, and `leaseReleased`; count fields must be
  non-negative integers and unknown fields are rejected.
- `ProfileReferencePort` is used only to confirm profile existence,
  reject mismatched profile ids, and record `accountStageAtRequest`.
  Sprint 065B does not duplicate Profile Manager checkout,
  authentication health, account-stage, or eligibility rules.
- PostgreSQL enforces at most one `QUEUED` or `RUNNING` home-feed run
  per profile with a partial unique index.
- `claimNextQueued` is atomic, oldest-first by `requestedAt` then `id`,
  and safe under concurrent claimers with `FOR UPDATE SKIP LOCKED`.
- Terminal lifecycle transitions use persistence-level compare-and-set:
  cancel updates only rows still `QUEUED`, while succeed and fail update
  only rows still `RUNNING`. A stale expected status returns a typed
  status-transition conflict, not-found remains distinct, and terminal
  rows cannot be overwritten by another terminal result.
- Internal application seams exist for claim-next, mark-succeeded, and
  mark-failed. They are not exposed as public HTTP routes.

## HTTP Surface

Safe operator routes:

- `POST /collector/profile-home-feed-collection-runs`
- `GET /collector/profile-home-feed-collection-runs`
- `GET /collector/profile-home-feed-collection-runs/:id`
- `POST /collector/profile-home-feed-collection-runs/:id/cancel`

The DTO allowlist includes only run identity, profile id,
trigger/status, request-time account stage, strict target, safe
parameters, safe summary/failure fields, and timestamps.

## Persistence

Sprint 065B adds the `profile_home_feed_collection_runs` table with:

- dedicated status and trigger PostgreSQL enum types;
- `profile_id`, strict `target`, strict `parameters`, optional
  `summary`, optional `failure_reason`, and lifecycle timestamps;
- indexes on `status`, `profile_id`, `created_at`, and
  `(requested_at, id)`;
- correction indexes on `(status, requested_at, id)` for atomic claim
  selection and `(profile_id, requested_at DESC, id DESC)` for profile
  history listing;
- partial unique index
  `profile_home_feed_collection_runs_active_profile_uidx` on
  `profile_id` where `status IN ('QUEUED', 'RUNNING')`.
- The repository port exposes an **insert-only** `create(run)` operation
  for new run creation. `create` performs a plain `INSERT` (no
  `onConflictDoUpdate`) and rejects duplicate run ids by throwing a
  typed `ProfileHomeFeedCollectionRunAlreadyExistsError`. Lifecycle
  updates are exclusively owned by `claimNextQueued` and
  `transitionStatus`, which perform compare-and-set at the persistence
  layer. Creation never replaces a running or terminal aggregate.
- Durable and in-memory list ordering is `requestedAt DESC`, then
  `id DESC` for deterministic ties.

## Security

The run model, DTOs, logs, docs, tests, and migration must not expose or
persist cookies, localStorage, tokens, authorization headers, proxy
credentials, fingerprint values, trusted runtime configuration, raw
HTML, raw GraphQL payloads, raw upstream exceptions, private screenshots,
or viewer data.

## Out Of Scope

- Browser execution or Facebook navigation.
- Profile checkout and lease release.
- Payload capture.
- Sprint 065A extractor invocation.
- `SourcePublisher` observation.
- Content Manager submission or provenance changes.
- Workers and schedulers.
- Web UI.
- Docker service changes.
- Manual live-Facebook validation.
- Scheduled triggers.
- Sprint 065C activation.
- Generalizing existing run abstractions.
- Unrelated refactoring.

## Verification Commands

```bash
pnpm exec vitest run \
  src/collector-runtime/application/profile-home-feed-collection-run-application.test.ts \
  src/infrastructure/database/mappers/profile-home-feed-collection-run.mapper.test.ts \
  src/infrastructure/database/schema/collector-runtime.schema.test.ts \
  src/interfaces/http/profile-home-feed-collection-run.server.test.ts \
  src/composition/collector-runtime/collector-runtime.container.test.ts
pnpm exec vitest run \
  src/infrastructure/database/repositories/drizzle-profile-home-feed-collection-run.repository.integration.test.ts
pnpm exec vitest run \
  src/interfaces/http/profile-home-feed-collection-run.server.test.ts
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:http:db
git diff --check
git status --short
```

Database and HTTP database tests remain opt-in and require the existing
PostgreSQL environment variables described by repository scripts.

## Status

Sprint 065A was accepted at
`28906556bffa2b4052cd429b0bf5634cf74de875`.

Sprint 065B is **accepted** at
`b9d84cad6d48f4ef94efb5be037550a7409afa05`.

Sprint 065C1 is the **currently authorized** next slice and is recorded
in `docs/SPRINTS/active.md`.

Sprint 065C2 and Sprint 065C3 remain **inactive and unauthorized** and
must not be activated by Sprint 065C1 or by this acceptance record.

Sprint 065B makes no browser or live-Facebook validation claim. It does
not invoke the Sprint 065A extractor, does not capture payloads, and
does not perform `SourcePublisher` observation or Content Manager
submission.
