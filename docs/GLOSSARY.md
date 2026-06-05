# Glossary

## Content Video Pipeline

The full system that collects source content, builds videos, and publishes completed videos.

## Content Collector

The pipeline stage responsible for obtaining source content and managing the operational profiles required for collection.

## Collector Profile Manager

The first core module in the Content Collector. It owns profile lifecycle, profile property rules, provisioning, session ingestion, and checkout eligibility.

Naming note: `Collector Profile Manager` is the canonical module name. `Profile Property Manager` appears in seed requirement documents and should be treated as an earlier/legacy name for the same module unless future requirements say otherwise.

## Collector Runtime

The future runtime module that will use eligible profiles to perform collection work. It must consume Collector Profile Manager capabilities through explicit application interfaces.

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
