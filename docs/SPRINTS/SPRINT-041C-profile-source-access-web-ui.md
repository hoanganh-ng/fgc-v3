# Sprint 041C: Profile-Source Access Web UI

## Goal

Add operator-facing profile-source access management to the existing Web UI profile detail page.

This sprint is frontend-only. It consumes the Sprint 041B HTTP endpoints and does not add platform automation or backend behavior.

## Scope

- Extend the Web UI Profile Manager API client with strict profile-source access schemas and only the client methods needed by this UI.
- Add profile-source access query and mutation hooks.
- Add a profile-source access card to the profile detail main column below the configuration summary.
- Join access records with Content Manager source groups client-side by `sourceGroupId`.
- Provide a responsive access-record list with safe status, timestamp, failure reason, and notes display.
- Provide a create/update editor for profile-source access records.
- Surface backend validation errors through existing frontend error patterns.

## Product Decisions

- The access UI belongs on the profile detail page.
- Do not add a source-group-centric profile-access screen in this sprint.
- Keep historical access records visible even when their source group is no longer returned by the source-group list.

## API Consumption

Use only:

- `GET /collector/profiles/:profileId/source-access`
- `PUT /collector/profiles/:profileId/source-access/:sourceGroupId`

Both path parameters must be URL encoded by the frontend client.

Do not add unused frontend wrappers for the other Sprint 041B endpoints.

## UI Requirements

The profile-source access card must include:

- title and explanation
- refresh
- loading state
- error/retry state
- empty state
- responsive access-record list
- create/update editor

Each access record must display:

- source group name
- source group ID
- source group status
- access-state badge
- last checked
- last successful
- join requested
- failure reason
- notes
- edit action

If an access record references a source group absent from the source-group list:

- display the raw ID
- label it unavailable or removed
- keep the historical record visible
- disable editing for that record

If the source-group query fails:

- keep access records visible by ID
- show a warning and retry action
- disable the editor

## Editor Requirements

Fields:

- source group
- access state
- failure reason code
- failure reason message
- notes
- save
- cancel/reset when editing

Selecting a source group with an existing record must populate the record. New records default to `UNKNOWN`.

Use button labels:

- `Create Access`
- `Update Access`

The source-group select should include all returned statuses and display:

```text
Source Group Name - STATUS
```

## Failure Reason Behavior

For `PUBLIC_ACCESSIBLE` or `JOINED_ACCESSIBLE`:

- hide or disable failure fields
- always submit `lastFailureReason: null`

For other states:

- failure code and message are optional as a pair
- if either is present, require both
- creating with both empty omits `lastFailureReason`
- editing an existing non-null reason and clearing both sends `lastFailureReason: null`
- editing an already-null reason with both empty omits it

Validation limits:

- code maximum 64
- code pattern `^[A-Z0-9_:-]+$`
- message maximum 500
- notes maximum 2000

Do not copy the backend unsafe-term blacklist.

## Notes Behavior

The backend cannot explicitly clear notes.

- prefill existing notes
- submit trimmed non-empty notes
- omit blank notes for new records
- if an existing note is cleared, block submission and explain:

```text
Clearing existing notes is not supported by the current API.
```

Do not change the backend contract in this sprint.

## Out Of Scope

- Backend behavior changes.
- Source-group-centric profile-access screens.
- Browser automation.
- Assisted group access.
- Group access checking.
- Group joining.
- Category browsing.
- Scheduler behavior.
- Collection worker behavior changes.
- Account-stage auto-promotion or auto-demotion.
- CAPTCHA solving.
- Checkpoint bypass.
- Credential automation.
- Posting, commenting, liking, sharing, messaging, or friend requests.

## Verification

After implementation:

- `pnpm --filter @fgc/web typecheck`
- targeted or full frontend tests if available
