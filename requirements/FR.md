# Functional Requirements: Profile Property Manager

## FR-1: Profile Lifecycle & CRUD Management

* **Creation:** The system must allow the creation of a new automated profile shell. Upon creation, it must default to a state awaiting configuration and login credential injection.
* **Modifiability:** The system must allow independent modification of targeted behavior, routine, and network settings without mutating the active authentication state (cookies/session).
* **State Transitioning:** The profile manager must strictly police the status state machine:
    `[PENDING_CONFIG] -> [PENDING_LOGIN] -> [READY] <-> [BUSY]`
    *(Any unexpected transition, such as a `BUSY` profile trying to undergo provisioning, must be blocked).*

## FR-2: Property Domain Boundaries (The 8 Pillars)

The manager must maintain a structured data model tracking exactly eight distinct categories of properties for each profile:

* **Identity & Metadata:** Core identifying strings, status indicators, and operational system timestamps.
* **Network Context:** Explicit proxy routing parameters (IP, port, authentication credentials) and a global network killswitch configuration.
* **Hardware Fingerprinting:** Deterministic browser signatures (User-Agent, viewport size, language headers, hardware concurrency) bound to the profile.
* **Authentication State:** Extracted runtime session components, specifically serialized browser cookies and local storage snapshots.
* **Behavioral Persona:** Algorithmic properties dictating human simulation variables (scrolling styles, micro-delay thresholds, reverse-scroll probabilities).
* **Temporal Routine:** Local time constraints mapping out when the profile is authorized to operate based on specific chronotypes.
* **Safety Thresholds:** Strict operational ceilings limiting session counts, durations, and maximum macro-actions within a 24-hour window.
* **Content Affinities:** Data structures mapping primary/secondary topics of interest and interaction weights used to dictate simulated human engagement.

## FR-3: Provisioning & Handshake Mechanics

* **Token Generation:** When a profile transitions to a login phase, the manager must issue a secure, cryptographically random, one-time-use provisioning token.
* **Configuration Exposure:** The system must expose the locked hardware fingerprint and network settings to authenticated consumer requests presenting a valid provisioning token.
* **Session Ingestion:** The manager must accept an incoming payload containing cookies and local storage, attach it to the corresponding profile, nullify the provisioning token to prevent reuse, and promote the profile to a operational-ready state.

## FR-4: Temporal Gatekeeping (Checkout Engine)

* **Timezone Localization:** The system must evaluate a profile's current execution eligibility by computing the current global time relative to the profile's designated local IANA timezone.
* **Window Matching:** The engine must inspect the profile's active time windows to verify if the localized current time permits operational activity.
* **Cooldown Verification:** The checkout engine must assert that the profile has surpassed its mandatory cooldown intervals and has not violated its daily safety metrics before granting an operational lease.
