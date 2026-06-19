# Active Sprint

Sprint 063A — Source Publisher Domain and Application is **accepted**.
It defined the Content Manager-owned `SourcePublisher` identity and
pure observation behavior and the Content Manager application layer
(ports, use cases, typed application error, and in-memory
repository). No persistence, HTTP, UI, browser, or feed execution.

- [Sprint 063A - Source Publisher Domain and Application](SPRINT-063A-source-publisher-domain-and-application.md)

Sprint 063B — Source Publisher Persistence and Atomic Observation is
**accepted**. It added PostgreSQL persistence for the Content
Manager-owned `SourcePublisher` aggregate, the Drizzle schema and
migration, the durable repository implementation, the atomic
observation algorithm, the durable status update, the durable read
operations, and the Content Manager composition wiring. The
durable outcome: `SourcePublisher` persistence is
PostgreSQL-backed; observation is atomic and concurrency-safe;
observation and status writes own separate fields; domain rules
remain the source of truth. HTTP routes, DTOs, Docker E2E coverage,
the Web UI review surface, `SourceGroup` promotion, the extractor
and browser behavior, and the future Content Builder / Content
Publisher pipeline stages remain out of scope and were not part of
Sprint 063B.

- [Sprint 063B - Source Publisher Persistence and Atomic Observation](SPRINT-063B-source-publisher-persistence-and-atomic-observation.md)

Sprint 063C — Source Publisher HTTP Contract and E2E is
**accepted**. It exposes safe HTTP contracts for observing,
listing, and reading Content Manager-owned `SourcePublisher`
aggregates and proves the flow through Nginx web-gateway →
Fastify HTTP adapter → Content Manager application → PostgreSQL
using only synthetic fixtures. Status mutation (approve / ignore /
block) remains deferred to Sprint 066.

- [Sprint 063C - Source Publisher HTTP Contract and E2E](SPRINT-063C-source-publisher-http-contract-and-e2e.md)

Sprint 064A — Content Collection Provenance Model is
**awaiting definition**. It is not active and is not authorized.

`SourcePublisher` is the Content Manager-owned publishing-source
identity (a Facebook group or page observed while reading the feed)
and is not the future Content Publisher pipeline stage; it does
not model drafts, publications, videos, publishing schedules, or
published artifacts.

The roadmap in `docs/ROADMAP.md` records the remaining feed discovery
sequence (Sprint 063C–068) as documentation placeholders. The
long-term `Future: Content Builder` and `Future: Content Publisher`
pipeline stages are retained and are not removed or redefined by the
feed discovery sequence.

Sprint 062 is accepted and recorded as the feed discovery delivery plan
and Docker E2E foundation:

- [Sprint 062 - Feed Discovery Delivery Plan And Docker E2E Foundation](SPRINT-062-feed-discovery-delivery-plan-and-docker-e2e-foundation.md)

Sprint 061 is accepted and recorded as the operator collection schedule
management surface foundation for Sprint 062:

- [Sprint 061 - Operator Collection Schedule Management Surface](SPRINT-061-operator-collection-schedule-management-surface.md)

Sprint 060 is accepted and recorded as the containerized scheduler
foundation for Sprint 061:

- [Sprint 060 - Collection Scheduler Containerization and Stack Integration](SPRINT-060-collection-scheduler-containerization.md)

Sprint 059 is accepted and recorded as the scheduled dispatch poller
foundation for Sprint 060:

- [Sprint 059 - Scheduled Collection Dispatch Poller](SPRINT-059-scheduled-collection-dispatch-poller.md)

Sprint 058 is accepted and recorded as the atomic scheduled dispatch
foundation for Sprint 059:

- [Sprint 058 - Atomic Scheduled Collection Dispatch](SPRINT-058-atomic-scheduled-collection-dispatch.md)

Sprint 057 is accepted and recorded as the schedule persistence foundation
for Sprint 058:

- [Sprint 057 - Collection Schedule Domain and Persistence Foundation](SPRINT-057-collection-schedule-domain-and-persistence-foundation.md)

Sprint 056 is accepted and recorded as the operator authentication
health filtering and profile inventory pagination foundation for
Sprint 057:

- [Sprint 056 - Operator Authentication Health Filtering and Profile Inventory Pagination](SPRINT-056-operator-authentication-health-filtering-and-profile-inventory-pagination.md)

Sprint 055 is accepted and recorded as the operator recovery
foundation for Sprint 056:

- [Sprint 055 - Operator Authentication Recovery and Reprovisioning](SPRINT-055-operator-authentication-recovery-and-reprovisioning.md)

Sprint 054B is accepted and recorded as the runtime authentication
health foundation for Sprint 055 and Sprint 056:

- [Sprint 054B - Runtime Authentication Health Reporting and Checkout Enforcement](SPRINT-054B-runtime-authentication-health-reporting-and-checkout-enforcement.md)

Sprint 054A is accepted and recorded as the profile authentication
health model foundation for Sprint 054B, Sprint 055, and Sprint 056:

- [Sprint 054A - Profile Authentication Health Foundation](SPRINT-054A-profile-authentication-health-foundation.md)
