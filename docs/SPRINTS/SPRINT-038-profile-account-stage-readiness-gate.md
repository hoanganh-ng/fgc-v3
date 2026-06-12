# Sprint 038: Profile Account Stage Readiness Gate

## Goal

Add an account maturity/readiness stage to Collector Profile Manager and require `COLLECTION_READY` for normal collection checkout, without changing the existing operational profile status flow.

## Scope

- Add `accountStage` to the Collector Profile domain model.
- Default new profiles to `NEW_ACCOUNT`.
- Add account stage persistence, repository mapping, schemas, safe profile DTOs, and tests.
- Add account stage transition policy for manual/operator updates.
- Add an application use case for manual account stage updates.
- Add `PATCH /collector/profiles/:profileId/account-stage`.
- Include `accountStage` in safe profile list/detail responses.
- Require `accountStage = COLLECTION_READY` during normal profile checkout.
- Keep provisioning able to progress profiles through `PENDING_CONFIG -> PENDING_LOGIN -> READY`; a provisioned profile should remain `NEW_ACCOUNT` until manually promoted.
- Update minimal Web UI profile list/detail display for `accountStage` if it fits the existing surface safely.
- Update project, architecture, module-boundary, and runtime documentation.

## Account Stages

- `NEW_ACCOUNT`: logged in but not trusted for normal collection.
- `WARMING`: stable enough for light preparation, not normal scheduled collection.
- `COLLECTION_READY`: eligible for normal collection checkout when all existing readiness, temporal, cooldown, lease, and safety checks pass.
- `LIMITED`: restricted or unstable; not eligible for normal collection.
- `NEEDS_REVIEW`: requires manual attention; not eligible for automated collection.
- `RETIRED`: terminal; never eligible for collection.

## Transition Rules

Allowed transitions:

- `NEW_ACCOUNT -> WARMING`
- `NEW_ACCOUNT -> NEEDS_REVIEW`
- `WARMING -> COLLECTION_READY`
- `WARMING -> LIMITED`
- `WARMING -> NEEDS_REVIEW`
- `COLLECTION_READY -> LIMITED`
- `COLLECTION_READY -> NEEDS_REVIEW`
- `COLLECTION_READY -> RETIRED`
- `LIMITED -> WARMING`
- `LIMITED -> COLLECTION_READY`
- `LIMITED -> RETIRED`
- `NEEDS_REVIEW -> WARMING`
- `NEEDS_REVIEW -> RETIRED`

`RETIRED` is terminal. `NEW_ACCOUNT -> COLLECTION_READY`, `NEW_ACCOUNT -> RETIRED`, `NEEDS_REVIEW -> COLLECTION_READY`, `LIMITED -> NEW_ACCOUNT`, and `COLLECTION_READY -> NEW_ACCOUNT` are not allowed in this sprint.

## Out Of Scope

- Ambient Exercise runner.
- Category Browse Exercise.
- Group Access Check.
- Assisted Group Access Session.
- Automatic group joining.
- Scheduler.
- Run Now UI.
- Run History UI.
- Profile health scoring.
- Automatic promotion.
- Automatic demotion from worker failures.
- CAPTCHA solving, checkpoint bypass, credential automation, or fake likes/comments/posts/shares.
- Source group access state or profile-source access matrix.

## Future Roadmap

Future readiness work may add Ambient Exercise, Profile-Source Access State, Assisted Group Access, Category Browse Exercise, and Scheduler behavior. Those features must remain separate from this sprint's manual account stage gate.

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:http:db` when `DATABASE_URL` is available

Manual checks:

- Create a profile and confirm `accountStage = NEW_ACCOUNT`.
- Provision/login until `status = READY` and confirm `READY + NEW_ACCOUNT` is not normal checkout eligible.
- Promote to `WARMING` and confirm normal checkout is still blocked.
- Promote through valid transitions to `COLLECTION_READY` and confirm checkout can succeed when all existing rules pass.
- Confirm `RETIRED` cannot transition back.
- Confirm safe profile list/detail responses include `accountStage` and continue to omit sensitive profile/session/runtime material.
