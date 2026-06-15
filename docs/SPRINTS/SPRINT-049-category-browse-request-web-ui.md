# Sprint 049: Category Browse Request Web UI

## Goal

Allow an operator to request either Ambient Account Exercise or Category Browse Exercise from the existing Account Exercise Runs page using existing APIs only.

## Scope

- Replace loose Web request schema with strict discriminated/union schema in `apps/web/src/lib/api/collector-runtime-client.ts`.
- Extend the request-form view model with `exerciseType`, `sourceGroupId`, and `entryRouteId` in `apps/web/src/features/collector-runtime/account-exercise-run-view-model.ts`.
- Add pure tested request builders for Ambient and Category Browse exercise requests.
- Load active source groups and content categories in the Web UI page.
- Add selectors for Exercise Type, Source Group, and Entry Route.
- Clear selectors/errors and preserve budgets on exercise type change.
- Display availability hints in source group selector options.
- Show pagination warnings if more active groups than loaded.
- Handle loading/error/empty query states for Category Browse.
- Reset the form back to `AMBIENT_ACCOUNT` and refresh the list on successful run creation.

## Out Of Scope

- Backend changes.
- Database migrations.
- Worker or browser execution changes.
- Automatic profile/source selection.
- Affinity matching.
- Account-stage automation.
- Source-access mutation.
- Entry-route editing.
- Batch requests or content collection.
