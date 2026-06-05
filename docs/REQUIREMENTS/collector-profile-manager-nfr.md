# Non-Functional Requirements: Collector Profile Manager

## NFR-1: Architectural Isolation (Hexagonal Boundaries)

* **Core Independence:** The inner domain logic governing profile properties, state transitions, and validation rules must have zero dependencies on external frameworks, databases, or HTTP routing engines.
* **Contractual Ports:** Any interaction with storage mechanics or third-party fingerprint generation utilities must occur exclusively through abstract interfaces owned by the application core.

## NFR-2: Performance & Queryability

* **Indexed Filtering:** The storage adapter must allow rapid, indexed querying on root-level operational fields (`status`, `token`, `nextAvailableWindowAt`) to ensure profile checkout queries complete under 50ms.
* **Flexible Serialization:** Complex, non-searchable behavioral clusters (like individual cookie objects or micro-delay thresholds) should be serialized efficiently to minimize schema bloat while maintaining fast document parsing speeds.

## NFR-3: Security & Profile Integrity

* **Anti-Replay Assurance:** Session injection routes must throw explicit state-conflict exceptions if an expired or invalid provisioning token is presented.
* **Fingerprint Determinism:** Once a hardware fingerprint is assigned to match a network proxy's geographic location, it must remain immutable across all subsequent automation sessions to avoid triggering anti-fraud mechanisms on target platforms.

## NFR-4: Type Safety & Schema Synchronization

* **Unified Schema Source:** The system must enforce runtime data validation using schemas that directly mirror compile-time TypeScript interfaces.
* **Validation Invariant:** Any data entering the system via public APIs or exiting the system from persistent storage must pass strict schema validation before it interacts with the business use cases.
