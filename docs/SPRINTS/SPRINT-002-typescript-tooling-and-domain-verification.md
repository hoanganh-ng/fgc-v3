# Sprint 002: TypeScript Tooling and Domain Verification

## Goal

Add minimal TypeScript tooling and automated verification for the Collector Profile Manager domain layer created in Sprint 001.

## Scope

- Detect existing project tooling and preserve established choices if present.
- Add minimal Node, TypeScript, and test tooling if none exists.
- Configure strict TypeScript checking for the domain source and tests.
- Add focused automated tests for Collector Profile Manager domain behavior:
  - Allowed profile status transitions.
  - Invalid skipped, reverse, and same-state transitions.
  - Domain errors for invalid transitions and immutable hardware fingerprints.
  - Basic Collector Profile validation behavior.
- Fix TypeScript errors in the existing domain code only where required by strict typechecking.

## Out of Scope

- HTTP APIs or routes.
- Database repositories, schemas, migrations, or persistence adapters.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Checkout engine implementation.
- Provisioning token generation.
- Frontend UI.
- Content Builder or Content Publisher code.
- Application use cases.
- Major Collector Profile Manager domain redesign unless strict typechecking reveals a real issue.
- Introducing runtime schema libraries unless already present in the repository.

## Acceptance Criteria

- `package.json` exists with scripts for typechecking and tests.
- `tsconfig.json` exists and uses strict TypeScript settings suitable for domain code.
- TypeScript is installed as a development dependency.
- A lightweight test framework is installed as a development dependency.
- Domain tests cover allowed and invalid state transitions.
- Domain tests cover fingerprint immutability.
- Domain tests cover basic profile validation behavior.
- Typechecking passes.
- Tests pass.
- No application, adapter, infrastructure, HTTP, database, queue, browser automation, frontend, Content Builder, or Content Publisher layers are introduced.

## Verification Commands

- `pnpm run typecheck`
- `pnpm test`

## Completion Notes

Sprint 002 is complete when minimal TypeScript and test tooling exists, Collector Profile Manager domain behavior is verified by automated tests, project brain docs point to this sprint, and no out-of-scope implementation layers have been introduced.
