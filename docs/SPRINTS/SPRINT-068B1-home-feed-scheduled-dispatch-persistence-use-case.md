# Sprint 068B1: Home-Feed Scheduled Dispatch Persistence + Use Case

## Goal

Implement the internal Collector Runtime dispatch path that converts one due
`ProfileHomeFeedCollectionSchedule` into either one queued
`ProfileHomeFeedCollectionRun` with `triggerType = "SCHEDULED"` or a safe
skip/defer outcome.

This sprint does not wire a scheduler poller, worker, browser execution, Docker
service, HTTP execution route, Web UI behavior, Content Manager behavior,
Content Builder behavior, or Content Publisher behavior.

## Capability Summary

- Adds `SCHEDULED` to the profile home-feed collection run trigger type.
- Adds schedule dispatch tracking to
  `collector_profile_home_feed_collection_schedules`:
  `last_attempted_at`, `last_dispatch_status`, `last_failure_reason`, and
  `consecutive_failures`.
- Extends `ProfileHomeFeedCollectionSchedule` and safe schedule DTOs with
  dispatch tracking fields while preserving create/update request semantics.
- Adds
  `DispatchNextDueProfileHomeFeedCollectionScheduleUseCase` and
  `DispatchNextDueProfileHomeFeedCollectionScheduleRepositoryPort`.
- Performs Profile Manager lookup through `ProfileReferencePort` outside
  PostgreSQL transactions.
- Uses deterministic no-jitter transient lookup backoff:
  `1m, 2m, 4m, 8m, 15m cap`.

## Dispatch Outcomes

- `NO_DUE_SCHEDULE`: no enabled due schedule is eligible.
- `DISPATCHED`: creates one queued `SCHEDULED` home-feed run and advances the
  schedule cadence.
- `SKIPPED_ACTIVE_RUN`: creates no run, records the skip, and advances cadence.
- `PROFILE_NOT_FOUND`: disables the schedule through compare-and-set and
  creates no run.
- `PROFILE_LOOKUP_FAILED`: records a sanitized retryable failure and creates no
  run.
- `RACE_LOST`: another dispatcher or schedule mutation changed the expected
  state before persistence.

## Status

Sprint 068B1 is **active**. Do not mark accepted until verification is
complete. Do not start Sprint 068B2 from this sprint.
