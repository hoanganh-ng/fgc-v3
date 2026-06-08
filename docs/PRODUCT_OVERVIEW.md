# Product Overview

The Content Video Pipeline is a staged system for collecting source content, building videos from that content, and publishing completed videos.

## Stage 1: Content Collector

The Content Collector is responsible for gathering source material, managing the operational profiles needed to collect that material, and storing collected content for later video building.

The first module, Collector Profile Manager, manages profile lifecycle, profile properties, provisioning, session ingestion, checkout eligibility, and leasing.

The next module, Content Manager, owns collected content as the central business object of the pipeline. It will define Facebook source groups, managed group categories, content items, engagement counts, top high-engagement comments, content lifecycle status, deduplication/upsert behavior, safe read contracts, and the future handoff shape for Content Builder.

Collector Runtime is a future module that will check out profiles, visit Facebook groups and posts, extract post data and top comments, submit collected content to Content Manager, and release profile leases.

## Stage 2: Content Builder

The Content Builder will transform collected source material into video-ready assets and assembled video outputs. Its future responsibilities may include content planning, script or asset preparation, video assembly, metadata generation, and quality checks.

## Stage 3: Content Publisher

The Content Publisher will distribute completed videos to target publishing destinations. Its future responsibilities may include destination-specific formatting, publishing workflows, schedule management, and publishing status tracking.

## Current Product Priority

Only the Content Collector stage is in current focus. Collector Profile Manager is complete through Sprint 013. Sprint 014 defines Content Manager requirements and boundaries before implementation begins. Web UI, Collector Runtime execution, Content Builder, and Content Publisher remain deferred.
