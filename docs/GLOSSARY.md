# Glossary

## Content Video Pipeline

The full system that collects source content, builds videos, and publishes completed videos.

## Content Collector

The pipeline stage responsible for obtaining source content and managing the operational profiles required for collection.

## Collector Profile Manager

The first core module in the Content Collector. It owns profile lifecycle, profile property rules, provisioning, session ingestion, and checkout eligibility.

Naming note: `Collector Profile Manager` is the canonical module name. `Profile Property Manager` appears in seed requirement documents and should be treated as an earlier/legacy name for the same module unless future requirements say otherwise.

## Collector Runtime

The future runtime module that will use eligible profiles to perform collection work. It will check out profiles, visit Facebook groups and posts, extract post data and top comments, submit collected content to Content Manager, and release profile leases. It must consume Collector Profile Manager and Content Manager capabilities through explicit application interfaces.

## Content Manager

The Content Collector module that owns collected content as the central business object of the pipeline. It owns source groups, managed group categories, content items, engagement counts, top high-engagement comments, lifecycle status, deduplication/upsert behavior, safe reads, and future Content Builder handoff shape.

## Source Group

A configured external group that Collector Runtime may visit in the future. The first source groups are Facebook knowledge groups.

## Group Category

A managed Content Manager entity used to classify source groups. Categories are not free text.

## Content Item

A collected source record owned by Content Manager. The first content item type is a Facebook rich text post.

## High-Engagement Comment

A top comment selected by reaction count for a content item. V1 stores only the top N comments, defaulting to 10, rather than full comment history.

## Content Status

The lifecycle state of a content item. Initial statuses are `COLLECTED`, `SELECTED`, `REJECTED`, and `USED`.

## Content Deduplication

The Content Manager rule that duplicate collected posts update an existing content item instead of creating another item. V1 deduplicates by `platform + externalPostId`.

## Profile Manager Web UI

The future user interface for managing profiles and observing profile state.

## Content Builder

The future pipeline stage that transforms collected source material into video-ready outputs.

## Content Publisher

The future pipeline stage that distributes completed videos to target publishing destinations.

## Profile

An automated identity shell with lifecycle status, network context, hardware fingerprinting, authentication state, behavioral persona, temporal routine, safety thresholds, and content affinities.

## Provisioning

The process of preparing a profile for login and session capture by issuing a one-time token and exposing locked configuration to an authorized consumer.

## Session Ingestion

The process of accepting cookies and local storage for a provisioned profile, storing that authentication state, invalidating the provisioning token, and promoting the profile toward readiness.

## Checkout Eligibility

The decision that a profile may be leased for operation based on status, local time window, cooldowns, and safety thresholds.

## Port

An interface owned by the application core that describes a needed capability without depending on a specific adapter technology.

## Adapter

An implementation of a port that connects the application to external technology such as storage, HTTP, browser automation, queues, or framework code.
