# Sprint 022: Collector Runtime Profile-Orchestrated Collection Flow

## Goal

Implement the Collector Runtime orchestration flow that checks out a collector profile, captures already-available Facebook GraphQL payloads through a runtime-owned capture port, submits captured payloads through the Sprint 021 submission use case, and releases the profile lease.

## Scope

- Add Collector Runtime application orchestration code under `src/collector-runtime/application`.
- Add runtime-owned profile lease and Facebook group payload capture ports.
- Reuse the Sprint 021 `SubmitCapturedFacebookPayloadUseCase` for extraction and Content Manager submission.
- Coordinate profile checkout, captured payload processing, submission summary aggregation, and lease release.
- Always attempt profile lease release after successful checkout, including capture failures and partial submission failures.
- Preserve capture warnings, extractor warnings, extraction issues, per-candidate submission failures, and release failures in the orchestration result.
- Add unit tests with fake runtime ports.
- Add boundary tests that Collector Runtime does not import database/repository implementations or browser automation packages.
- Update project state, roadmap, and module boundary documentation for Sprint 022.

## Out Of Scope

- Browser automation.
- Playwright or Puppeteer.
- Real Facebook login, navigation, network interception, or payload capture.
- Scheduler or queue execution.
- Direct database access from Collector Runtime.
- Direct Profile Manager or Content Manager repository access from Collector Runtime.
- Content Manager business-rule changes.
- Profile Manager business-rule changes.
- New database tables, migrations, or Drizzle schema changes.
- Fastify route changes.
- Web UI.
- Content Builder.
- Publisher.

## Acceptance Criteria

- Active sprint documentation identifies Sprint 022 as the active sprint.
- Collector Runtime owns a profile lease port representing only checkout/release behavior needed by runtime orchestration.
- Collector Runtime owns a Facebook group payload capture port.
- The capture port returns captured payloads and warnings but has no real browser/network implementation.
- The orchestrator checks out a profile before capture.
- The orchestrator calls the capture port with source group and lease context.
- The orchestrator processes each captured payload through `SubmitCapturedFacebookPayloadUseCase`.
- Multiple captured payloads are all processed even when a payload has extraction issues or submission failures.
- Zero captured payloads return a successful summary with zero extracted/submitted/failed counts.
- Zero extracted candidates return a successful summary when no other failures occur.
- Partial submission failures are represented per candidate and included in aggregate counts.
- Checkout failure stops before capture, submission, and release.
- Lease release is attempted after successful checkout when capture fails.
- Lease release is attempted after successful checkout when submission has partial failures.
- Release failure is reported without hiding the original capture or submission failure.
- Collector Runtime does not import Profile Manager repositories, Content Manager repositories, Drizzle schema, PostgreSQL adapters, or database code.
- No browser automation imports or packages are added.

## Verification

```bash
pnpm run typecheck
pnpm test
git status --short
```
