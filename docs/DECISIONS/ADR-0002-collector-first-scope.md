# ADR-0002: Collector-First Scope

## Status

Accepted

## Context

The Content Video Pipeline has three stages: Content Collector, Content Builder, and Content Publisher. The downstream stages depend on collected source material and operational profile behavior. The current seed requirements describe the Collector Profile Manager under the earlier/source name `Profile Property Manager`, which belongs to the Content Collector stage.

## Decision

Focus first on Content Collector, specifically the Collector Profile Manager.

The Collector Profile Manager is the first core module because it defines profile lifecycle, profile properties, provisioning, session ingestion, and checkout eligibility. These capabilities establish the operational foundation that Collector Runtime will later consume.

## Consequences

- Content Builder and Content Publisher remain recognized stages but are out of implementation scope for now.
- Collector Runtime is not implemented before the profile management rules are clarified.
- Database selection, browser automation framework selection, UI implementation, and runtime execution are deferred.
- Initial requirements are organized around the Collector Profile Manager.
