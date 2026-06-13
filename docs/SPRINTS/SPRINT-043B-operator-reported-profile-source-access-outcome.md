# Sprint 043B: Operator-Reported Profile-Source Access Outcome

## Goal

After a successfully observed assisted group access browser session has ended and
cleanup has been attempted, allow the operator to explicitly select and persist
the observed profile-source access outcome through the existing Collector Profile
Manager API.

## Scope

- Keep the Sprint 043A assisted browser runner focused on browser execution and
  cleanup.
- Add a testable operator workflow around the runner for post-session reporting.
- Prompt only when the page loaded and the session completed with
  `OPERATOR_COMPLETED`.
- Add an injectable operator outcome prompt port.
- Add an operator-owned profile-source access outcome reporter port.
- Extend the Collector Runtime Profile Manager HTTP client with
  `upsertProfileSourceAccess`.
- Use the existing `PUT /collector/profiles/:profileId/source-access/:sourceGroupId`
  route.
- Support reportable outcomes:
  - `PUBLIC_ACCESSIBLE`
  - `JOIN_REQUIRED`
  - `JOINED_ACCESSIBLE`
  - `ACCESS_DENIED`
  - `LOGIN_REQUIRED`
  - `CHECKPOINT_REQUIRED`
- Support `SKIP` as a non-mutating operator choice.

## Out Of Scope

- Browser access-state detection.
- DOM, page-text, URL, or network-response inspection.
- Joining groups or requesting membership.
- Automated clicks or platform actions.
- New server routes, domain changes, schema changes, database fields, or
  migrations.
- Web UI changes.
- Content extraction.
- Operator notes.
- Run-history or audit storage.
- Lease-linked outcome records.
- Account-stage changes.
- Worker changes.
