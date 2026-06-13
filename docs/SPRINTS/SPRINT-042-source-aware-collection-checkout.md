# Sprint 042: Source-Aware Collection Checkout Gate

## Goal

Extend normal collection checkout to require a source group and enforce profile-source access eligibility.

Checkout must lease only profiles whose durable profile-source access state for the requested source group is either `PUBLIC_ACCESSIBLE` or `JOINED_ACCESSIBLE`.

## Background

Collector Runtime already passes `sourceGroupId` to `ProfileLeasePort.checkoutProfile()` when performing collection. However:

- `ProfileManagerHttpClient.checkoutProfile()` ignores its input and sends `{}`.
- Collector Profile Manager `CheckoutProfileInput` only contains optional `profileId`.
- Checkout currently selects generic eligible profiles without consulting profile-source access records.

Sprint 042 closes this gap so normal collection respects durable profile-source access state.

## Scope

- Add required `sourceGroupId` to normal collection `CheckoutProfileInput`.
- Keep optional explicit `profileId` support if currently supported.
- Extend the strict HTTP checkout body schema to require `sourceGroupId`.
- Validate source-group existence through the existing `SourceGroupReferencePort`.
- Do not import Content Manager repositories into Collector Profile Manager.
- Missing/malformed `sourceGroupId` must return `400`.
- Unknown source group must return `404`.
- Collection checkout may use only access states:
  - `PUBLIC_ACCESSIBLE`
  - `JOINED_ACCESSIBLE`
- Missing access records and every other state must fail closed.
- Preserve all existing profile eligibility rules, including `READY` status, `COLLECTION_READY` account stage, authentication/configuration, temporal routine, cooldown, safety thresholds, and active-lease checks.
- For explicit profile checkout, return a typed safe ineligibility reason when source access is missing or unsuccessful.
- For automatic selection, preserve existing candidate ordering while filtering to profiles with successful source access.
- Extend the application-owned `ProfileSourceAccessRepository` with an efficient query for profile IDs by `sourceGroupId` and access states.
- Implement the query in the in-memory and Drizzle repositories.
- Make the source-access repository available through transaction-scoped checkout wiring.
- Verify an index suitable for `source_group_id + access_state` filtering. Add a migration only if necessary.
- Update `ProfileManagerHttpClient.checkoutProfile()` to serialize `sourceGroupId` instead of sending an empty object.
- Do not add the runtime purpose string to the HTTP request. Normal checkout remains a `COLLECTION` lease.
- Checkout must not create, update, refresh, or otherwise mutate profile-source access records.
- Reuse the domain helper/definition for successful access states rather than duplicating the rule.

## Requirements

1. **Add required `sourceGroupId` to `CheckoutProfileInput`**: The application DTO must require `sourceGroupId` for normal collection checkout. Keep optional `profileId` if currently supported.

2. **Extend HTTP request validation**: The strict Zod schema for `POST /collector/profiles/checkout` must require `sourceGroupId` as a non-empty string.

3. **Validate source group existence**: Use the existing `SourceGroupReferencePort.exists()` to verify the source group before checkout. Unknown source groups return `404`.

4. **Define successful access states**: Reuse or create a domain helper that defines successful access states as `PUBLIC_ACCESSIBLE` and `JOINED_ACCESSIBLE`.

5. **Fail closed for missing/unsuccessful access**: Profiles without access records or with any access state other than the two successful states are ineligible for the requested source group.

6. **Extend `ProfileSourceAccessRepository`**: Add a method to query profile IDs by `sourceGroupId` and access states efficiently:
   ```ts
   findProfileIdsBySourceGroupAndStates(
     sourceGroupId: string,
     accessStates: ProfileSourceAccessState[]
   ): Promise<string[]>
   ```

7. **Implement in-memory query**: The in-memory repository must filter records by `sourceGroupId` and access state membership.

8. **Implement Drizzle query**: The Drizzle repository must use a WHERE clause with `source_group_id = ? AND access_state IN (...)`.

9. **Verify/add index**: Check that an index on `(source_group_id, access_state)` exists. Add a migration if missing.

10. **Wire source-access repository into checkout**: Make `ProfileSourceAccessRepository` available through transaction-scoped checkout use case wiring.

11. **Extend checkout eligibility logic**: After existing eligibility checks, filter candidates to those with successful source access for the requested source group.

12. **Explicit profile checkout rejection**: When an explicit `profileId` is requested but lacks successful source access, return a typed ineligibility reason such as `PROFILE_SOURCE_ACCESS_REQUIRED` or `SOURCE_ACCESS_UNSUCCESSFUL`.

13. **Automatic selection filtering**: When automatically selecting a profile, apply source-access filtering to the candidate pool after existing eligibility rules.

14. **Preserve candidate ordering**: Do not change the existing candidate selection order. Apply source-access filtering as an additional gate.

15. **Update `ProfileManagerHttpClient.checkoutProfile()`**: Serialize `sourceGroupId` in the HTTP request body instead of sending `{}`.

16. **Keep lease purpose implicit**: Do not add a `purpose` field to the HTTP request. Normal checkout remains a `COLLECTION` lease by default.

17. **No access-record mutation**: Checkout must not create, update, or refresh profile-source access records. It is a read-only gate.

18. **Safe ineligibility reasons**: Use sanitized, typed ineligibility codes. Do not expose raw SQL errors, stack traces, or sensitive internal details.

19. **Preserve all existing eligibility rules**: Source-access filtering is additive. All existing rules (status, account stage, authentication, configuration, temporal routine, cooldown, safety thresholds, active lease) remain enforced.

20. **Transactional consistency**: Checkout eligibility checks, including source-access queries, must run within the existing checkout transaction.

## Testing Requirements

Add tests covering:

- `PUBLIC_ACCESSIBLE` success
- `JOINED_ACCESSIBLE` success
- Missing access record rejection
- `UNKNOWN` state rejection
- `JOIN_REQUIRED` state rejection
- `JOIN_REQUESTED` state rejection
- `ACCESS_DENIED` state rejection
- `LOGIN_REQUIRED` state rejection
- `CHECKPOINT_REQUIRED` state rejection
- `NEEDS_MANUAL_REVIEW` state rejection
- Explicit inaccessible profile rejection with typed reason
- Automatic skipping of inaccessible candidates
- Accessible profile still failing ordinary eligibility (e.g., `BUSY` status)
- No access-record mutation during checkout
- Required HTTP `sourceGroupId` validation (missing returns `400`)
- Malformed `sourceGroupId` validation
- Unknown source-group `404`
- Safe no-eligible-profile response when all candidates are filtered
- Runtime HTTP client request-body serialization
- In-memory repository query behavior
- Drizzle repository query behavior
- Transaction-scoped checkout behavior with source-access filtering
- Existing lease invariants remain enforced

## Out Of Scope

- Assisted group access
- Automated group access checks
- Group joining
- Category browsing
- Entry-route execution
- Scheduler changes
- Account-stage automation
- Browser-provider changes
- Web UI feature additions
- Access-state freshness/expiration rules
- CAPTCHA solving
- Checkpoint bypass
- Credential automation
- Platform engagement actions

## Safety Boundaries

Checkout responses must not expose:

- SQL errors or raw database details
- Internal stack traces
- Cookies, localStorage, or session headers
- Proxy credentials
- Provisioning token material
- Trusted runtime configuration
- Browser fingerprint secrets
- Raw Facebook payloads
- Raw page HTML
- Screenshots

## Verification

Before implementation, verify current state:

- `pnpm typecheck`
- `pnpm test`

After implementation:

- `pnpm typecheck`
- `pnpm test`
- `pnpm db:migrate`
- `pnpm test:http:db`

Report verification results, including any commands not run and why.
