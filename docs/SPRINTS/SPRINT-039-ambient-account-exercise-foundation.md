# Sprint 039: Ambient Account Exercise Foundation

## Goal

Add the foundation for Ambient Account Exercise so operators can run low-risk, read-only browser sessions for `READY` profiles that are not yet eligible for normal collection.

Ambient Exercise validates account and session stability. It must not collect or submit content items.

## Scope

- Add a Collector Profile Manager lease purpose model with `COLLECTION` and `AMBIENT_EXERCISE`.
- Keep existing normal checkout behavior as `COLLECTION` by default.
- Keep normal collection checkout gated on `status = READY`, `accountStage = COLLECTION_READY`, existing temporal/cooldown/safety checks, and no active lease.
- Add an exercise checkout use case for a specified profile.
- Allow exercise checkout for `READY` profiles whose `accountStage` is `NEW_ACCOUNT`, `WARMING`, `LIMITED`, or `COLLECTION_READY`.
- Reject exercise checkout for `NEEDS_REVIEW` and `RETIRED`.
- Keep runtime configuration access lease-scoped and compatible with both lease purposes.
- Add Ambient Exercise Run records under Collector Runtime.
- Add a one-shot operator command for `AMBIENT_ACCOUNT` exercise runs.
- Store only safe summaries and sanitized failure reasons.
- Always release profile leases after an exercise attempt.
- Update operator/runtime documentation and command scripts.

## Ambient Exercise Run Model

Exercise run fields:

- `id`
- `profileId`
- `leaseId`
- `exerciseType`
- `status`
- `stageAtStart`
- `actionBudget`
- `safeSummary`
- `failureReason`
- `requestedAt`
- `startedAt`
- `finishedAt`
- `createdAt`
- `updatedAt`

Exercise types:

- `AMBIENT_ACCOUNT`

Statuses:

- `QUEUED`
- `RUNNING`
- `SUCCEEDED`
- `FAILED`
- `CANCELED`

Allowed transitions:

- `QUEUED -> RUNNING`
- `QUEUED -> CANCELED`
- `RUNNING -> SUCCEEDED`
- `RUNNING -> FAILED`

Terminal:

- `SUCCEEDED`
- `FAILED`
- `CANCELED`

## Safety Boundaries

Ambient Exercise must not:

- submit content items
- join groups
- post, comment, like, share, message, or send friend requests
- solve CAPTCHAs
- bypass checkpoints, rate limits, or access controls
- automate credentials
- change `accountStage` automatically

Exercise records, logs, docs, and safe reads must not include:

- cookies
- localStorage
- raw Facebook payloads
- proxy credentials
- session headers
- provisioning tokens
- trusted runtime configuration
- browser fingerprint secrets
- checkpoint page HTML

## Operator Command

Canonical command:

```bash
pnpm operator:profile:exercise -- \
  --profile-id <profile-id> \
  --base-url http://localhost:8081 \
  --max-duration-ms 120000 \
  --max-scrolls 2
```

Alias:

```bash
pnpm profile:exercise:run -- --profile-id <profile-id>
```

The command should:

1. Create an Ambient Exercise Run record.
2. Checkout the specified profile for `AMBIENT_EXERCISE`.
3. Fetch runtime configuration by `leaseId`.
4. Launch the selected browser provider.
5. Open a safe Facebook home/feed URL.
6. Wait briefly for page stability.
7. Perform only light read-only dwell and scroll actions.
8. Detect sanitized states such as page loaded, login required, and checkpoint detected.
9. Mark the exercise run `SUCCEEDED` or `FAILED`.
10. Always release the profile lease.

## Out Of Scope

- Category Browse Exercise
- Group Access Check
- Assisted Group Access Session
- Profile-source access state
- Scheduler
- Auto stage promotion
- Auto stage demotion
- Web UI exercise history
- Run History UI
- Group joining
- Content collection or submission
- Likes, comments, posts, shares, friend requests, or messages
- CAPTCHA solving
- Checkpoint bypass
- Credential automation
- BullMQ or Redis

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm operator:profile:exercise -- --help`
- `pnpm profile:exercise:run -- --help`
- `pnpm test:http:db` when `DATABASE_URL` is available

Manual checks:

- Create and provision a profile until `status = READY`.
- Keep `accountStage = NEW_ACCOUNT`.
- Confirm normal collection checkout is blocked.
- Run `pnpm operator:profile:exercise -- --profile-id <profile-id> --base-url http://localhost:8081 --max-duration-ms 120000 --max-scrolls 2`.
- Confirm exercise checkout succeeds for `NEW_ACCOUNT`.
- Confirm the browser opens through stored runtime configuration.
- Confirm no content items are submitted.
- Confirm the exercise run ends `SUCCEEDED` or `FAILED` with only safe summary or failure data.
- Confirm the lease is released.
- Confirm normal collection checkout is still blocked until `accountStage = COLLECTION_READY`.
