# Sprint 040: Source Group Entry Routes Foundation

## Goal

Add source group entry route metadata to Content Manager so future account warm-up, group access, and category browse workflows can choose safer or more natural paths toward a target source group.

This sprint models and manages route metadata only. It must not run browser automation or add profile-source access state.

## Scope

- Add `entryRoutes` to the Content Manager source group model.
- Store entry routes as JSONB on source groups for v1 unless existing schema constraints require a different shape.
- Expose safe `entryRoutes` on source group list and detail reads.
- Treat existing source groups without explicit routes as having a derived default direct route from the source group URL.
- Create a default route for newly created source groups:
  - `type = DIRECT_GROUP_URL`
  - `url = source group URL`
  - `riskLevel = MEDIUM`
  - `isDefault = true`
- Add validation for route type, URL, risk level, default uniqueness, and route update/delete behavior.
- Add application use cases for adding, updating, and removing source group entry routes.
- Add HTTP endpoints for source group entry route CRUD.
- Update the Web UI source group manager to display entry routes and support small CRUD flows if practical.
- Update documentation for ownership and safety boundaries.

## Entry Route Model

Route fields:

- `id`
- `type`
- `url`
- `label`
- `notes`
- `riskLevel`
- `isDefault`
- `createdAt`
- `updatedAt`

Route types:

- `DIRECT_GROUP_URL`
- `CATEGORY_ENTRY_URL`
- `PUBLIC_PAGE_THEN_GROUP`
- `OPERATOR_ASSISTED_SEARCH`
- `SAVED_REFERRAL_URL`

Risk levels:

- `LOW`
- `MEDIUM`
- `HIGH`

The derived direct group URL route uses `MEDIUM` risk because jumping directly to a final group is valid but should not be treated as the safest future warm-up path by default.

## Behavior

- Entry routes are Content Manager source group metadata.
- Entry routes do not grant access to a group.
- Entry routes do not imply that any profile can access a group.
- Profile-source access state is deferred to a later sprint.
- Collector Runtime may consume route metadata later through explicit contracts, but it must not own or mutate the metadata directly.
- Profile Manager is not involved.
- If a source group has no explicit default route, the source group URL is treated as the default `DIRECT_GROUP_URL`.
- Setting a new route as default clears the previous default route.
- Deleting the current default route is rejected so the source group keeps an obvious entry path.

## HTTP Routes

Add:

- `POST /collector/source-groups/:sourceGroupId/entry-routes`
- `PATCH /collector/source-groups/:sourceGroupId/entry-routes/:entryRouteId`
- `DELETE /collector/source-groups/:sourceGroupId/entry-routes/:entryRouteId`

Existing source group reads must include safe `entryRoutes`:

- `GET /collector/source-groups`
- `GET /collector/source-groups/:sourceGroupId`

## Safety Boundaries

This sprint must not add or encourage:

- browser automation
- profile checkout
- profile-source access state
- assisted group access sessions
- category browse exercise
- scheduler behavior
- automatic group joining
- automatic search behavior
- likes, comments, posts, shares, messages, or friend requests
- CAPTCHA solving
- checkpoint bypass
- credential automation
- account-stage changes
- runtime run history UI
- content item UI changes unless required by a shared component adjustment

Source group entry route reads must not expose:

- cookies
- localStorage
- proxy credentials
- session headers
- provisioning tokens
- token hashes
- raw Facebook payloads
- trusted runtime configuration
- browser fingerprint secrets

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm web:typecheck`
- `pnpm web:build` if Web UI changed
- `pnpm test:http:db` when `DATABASE_URL` is available

Manual checks when the Web UI is changed:

- Existing source groups still display.
- Each source group shows default direct route behavior.
- A `CATEGORY_ENTRY_URL` route can be added.
- A route can be edited.
- A default route is visible.
- Route deletion behavior follows the documented policy.
- `GET /collector/source-groups/:sourceGroupId` returns safe `entryRoutes`.
- No profile, session, runtime, or platform secret data is exposed.
