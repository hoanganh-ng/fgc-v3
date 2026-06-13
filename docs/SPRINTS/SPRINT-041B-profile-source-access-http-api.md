# Sprint 041B: Profile-Source Access HTTP API

## Goal

Expose the Sprint 041A profile-source access application use cases through safe Fastify HTTP endpoints.

This sprint is HTTP/API only. It does not add browser automation, assisted group access, source-group access checking, group joining, category browsing, scheduler behavior, or Web UI.

## Scope

- Add Collector Profile Manager HTTP routes for profile-source access upsert and reads.
- Add strict request validation and safe response schemas.
- Verify the referenced Collector Profile Manager profile exists before profile-scoped access operations.
- Verify the referenced Content Manager source group exists through an explicit application port/adapter.
- Keep `sourceGroupId` as an external module reference string with no database foreign key to Content Manager tables.
- Extend HTTP and DB-backed HTTP tests for the new endpoints.
- Update documentation for endpoints, DTOs, and module boundaries.

## HTTP Routes

Add:

- `PUT /collector/profiles/:profileId/source-access/:sourceGroupId`
- `GET /collector/profiles/:profileId/source-access`
- `GET /collector/profiles/:profileId/source-access/:sourceGroupId`
- `GET /collector/source-groups/:sourceGroupId/profile-access`

## Safe DTO

Responses expose profile-source access records only as:

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

Single-record responses use:

```json
{
  "profileSourceAccess": {
    "id": "...",
    "profileId": "...",
    "sourceGroupId": "...",
    "accessState": "JOIN_REQUIRED",
    "lastCheckedAt": "...",
    "lastSuccessfulAt": null,
    "lastFailureReason": {
      "code": "JOIN_REQUIRED",
      "message": "Group membership is required"
    },
    "joinRequestedAt": null,
    "notes": "Optional operator notes",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

List response naming should follow existing HTTP adapter conventions.

## Cross-Module Validation Boundary

Collector Profile Manager must validate source group references through an explicit application-owned port, such as:

```ts
interface SourceGroupReferencePort {
  exists(sourceGroupId: string): Promise<boolean>;
}
```

The implementation may adapt an existing safe Content Manager query contract or composition service. Collector Profile Manager must not import Content Manager repositories, add a database foreign key to Content Manager tables, or copy source group data into profile-source access records.

## Validation

- `profileId` and `sourceGroupId` must be non-empty and follow existing HTTP conventions.
- `accessState` must be one of the domain states.
- `notes` must have a reasonable maximum length.
- `lastFailureReason.code` must be a short sanitized identifier.
- `lastFailureReason.message` must have a reasonable maximum length.
- Unexpected request-body properties should be rejected where existing schemas are strict.
- Raw HTML, screenshots, payloads, cookies, headers, runtime config, and other sensitive platform/session material must never be accepted or persisted.

## Error Behavior

Use existing centralized HTTP error mapping conventions:

- invalid input: `400`
- profile not found: `404`
- source group not found: `404`
- access record not found: `404`
- unexpected persistence/application error: sanitized `500`

## Out Of Scope

- Web UI.
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

## Safety Boundaries

Profile-source access HTTP responses must not expose:

- SQL errors
- internal stack traces
- cookies
- localStorage
- proxy credentials
- session headers
- provisioning token material
- trusted runtime configuration
- browser fingerprint data
- raw Facebook payloads
- raw page HTML
- screenshots

## Verification

Before implementation, verify the Sprint 041A DB gate:

- `pnpm db:migrate`
- `pnpm test:http:db`

After implementation:

- `pnpm typecheck`
- `pnpm test`
- `pnpm db:migrate`
- `pnpm test:http:db`
