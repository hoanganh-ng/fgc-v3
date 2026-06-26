# Sprint 073 — Command Surface Cleanup Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the Sprint 073 command-surface cleanup is complete and produce a final report listing changed files, verification results, and unverified items.

**Architecture:** No source, schema, contract, runtime, capture, extractor, checkout, or worker behavior changes. The previous cleanup turns already performed the three required string replacements and the optional `docs/RUNTIME.md` "Removed legacy aliases" table polish. This plan is a **verification + reporting** plan: re-confirm end state, run the canonical verification commands, and emit the handoff report.

**Tech Stack:** Markdown, grep, git, pnpm, vitest, tsc, vite.

## Global Constraints

- Sprint 073 is `active, not accepted`. Do not commit, push, or advance the sprint pointer.
- No domain, schema, migration, HTTP contract, runtime, browser capture, extractor, profile checkout, lease, account-stage, authentication health, or provisioning behavior changes.
- No new product features.
- No removal of Content Builder persistence, HTTP routes, or routes/pages already in `apps/web/src/app/router.tsx`.
- No editing of `docs/SPRINTS/*` historical sprint documents — they may retain old `pnpm profile:home-feed:run-next` references.
- No new dependencies.
- No exposure of sensitive material (cookies, localStorage, tokens, auth headers, proxy credentials, raw Facebook payloads, viewer IDs, screenshots, private payload examples).
- Verification set is the Sprint 073 small verification set: `pnpm typecheck`, `pnpm test` (via `pnpm exec vitest run`), `pnpm web:typecheck`, `pnpm web:build`, `git diff --check`, `git status --short`.

---

## File Map

This plan produces no file edits. It produces one Markdown report written to stdout (or a single ephemeral scratch file if the executing agent prefers).

Files previously modified by prior cleanup turns that this plan re-verifies:

- `docs/PROJECT_SNAPSHOT.md` — milestone note for Sprint 065C3 now references `pnpm operator:profile-home-feed:run-next`.
- `docs/MODULE_BOUNDARIES.md` — one-shot executor description now references `pnpm operator:profile-home-feed:run-next`.
- `tests/e2e/profile-home-feed-run-next.spec.ts` — header comment now references `pnpm operator:profile-home-feed:run-next`.
- `docs/RUNTIME.md` — "Removed legacy aliases" section is now an `Old command | Canonical command` table; the `profile:home-feed:run-next` -> `operator:profile-home-feed:run-next` row is present and unambiguous.

---

### Task 1: Re-confirm end state of the four files

**Files:**
- Verify only: `docs/PROJECT_SNAPSHOT.md`, `docs/MODULE_BOUNDARIES.md`, `tests/e2e/profile-home-feed-run-next.spec.ts`, `docs/RUNTIME.md`

**Interfaces:**
- Consumes: grep tool
- Produces: an end-state confirmation snippet suitable for the final report

- [ ] **Step 1: Confirm `docs/PROJECT_SNAPSHOT.md` uses the canonical verb**

Run:

```bash
grep -nE "operator:profile-home-feed:run-next|profile:home-feed:run-next" /home/vi0l3tsc0rpi0n/coding/fgc-v3/docs/PROJECT_SNAPSHOT.md
```

Expected: a single line containing `operator:profile-home-feed:run-next` on or near line 36 (the Sprint 065C3 milestone line). No matches for the bare `profile:home-feed:run-next`.

- [ ] **Step 2: Confirm `docs/MODULE_BOUNDARIES.md` uses the canonical verb**

Run:

```bash
grep -nE "operator:profile-home-feed:run-next|profile:home-feed:run-next" /home/vi0l3tsc0rpi0n/coding/fgc-v3/docs/MODULE_BOUNDARIES.md
```

Expected: a single line containing `operator:profile-home-feed:run-next` near line 204 (one-shot executor description). No matches for the bare `profile:home-feed:run-next`.

- [ ] **Step 3: Confirm `tests/e2e/profile-home-feed-run-next.spec.ts` header comment uses the canonical verb**

Run:

```bash
grep -nE "operator:profile-home-feed:run-next|profile:home-feed:run-next" /home/vi0l3tsc0rpi0n/coding/fgc-v3/tests/e2e/profile-home-feed-run-next.spec.ts
```

Expected: a single line containing `operator:profile-home-feed:run-next` near line 6 (Sprint 065C3 header comment). No matches for the bare `profile:home-feed:run-next`.

- [ ] **Step 4: Confirm `docs/RUNTIME.md` table includes the home-feed row**

Run:

```bash
grep -nE "profile:home-feed:run-next" /home/vi0l3tsc0rpi0n/coding/fgc-v3/docs/RUNTIME.md
```

Expected: one or two lines, all containing the canonical form `operator:profile-home-feed:run-next`, including a table row of the shape `| \`pnpm profile:home-feed:run-next\` | \`pnpm operator:profile-home-feed:run-next\` |` under the `### Removed legacy aliases (Sprint 073)` section.

- [ ] **Step 5: Confirm no remaining bare-alias references in current-state docs/source**

Run:

```bash
grep -RIn "profile:home-feed:run-next" \
  /home/vi0l3tsc0rpi0n/coding/fgc-v3/docs \
  /home/vi0l3tsc0rpi0n/coding/fgc-v3/README.md \
  /home/vi0l3tsc0rpi0n/coding/fgc-v3/tests \
  /home/vi0l3tsc0rpi0n/coding/fgc-v3/src \
  /home/vi0l3tsc0rpi0n/coding/fgc-v3/apps \
  /home/vi0l3tsc0rpi0n/coding/fgc-v3/package.json \
  2>/dev/null | grep -vE "operator:profile-home-feed:run-next"
```

Expected: only matches inside `docs/SPRINTS/SPRINT-065C3-bounded-facebook-home-feed-execution.md` (historical sprint doc, out of scope per spec). Zero matches in `docs/PROJECT_SNAPSHOT.md`, `docs/MODULE_BOUNDARIES.md`, `docs/RUNTIME.md`, `README.md`, `tests/`, `src/`, `apps/`, or `package.json`.

---

### Task 2: Run the Sprint 073 verification set

**Files:** none modified

**Interfaces:**
- Consumes: `pnpm`, `vitest`, `tsc`, `vite`, `git`
- Produces: clean exit codes from each verification command

- [ ] **Step 1: Root TypeScript typecheck**

Run:

```bash
pnpm typecheck
```

Expected: no output, exit code 0.

- [ ] **Step 2: Web TypeScript typecheck**

Run:

```bash
pnpm web:typecheck
```

Expected: no output, exit code 0.

- [ ] **Step 3: Web production build**

Run:

```bash
pnpm web:build
```

Expected: `✓ built in <duration>s`, exit code 0. A `chunks larger than 500 kB` advisory is acceptable (pre-existing).

- [ ] **Step 4: Vitest run via background task, redirect log**

Run:

```bash
pnpm exec vitest run > /tmp/vitest-s073-verify.log 2>&1; echo "rc=$?"
```

Expected: `rc=0`.

- [ ] **Step 5: Read vitest summary lines**

Run:

```bash
grep -E "Test Files|^FAIL|Failed Tests" /tmp/vitest-s073-verify.log | tail -5
grep -E "^ +Tests " /tmp/vitest-s073-verify.log | tail -3
```

Expected:

- `Test Files  142 passed | 17 skipped (159)` (or a later green number; the exact counts may grow if suites were added since this plan was written — what matters is **zero failed**).
- `Tests  <N> passed | <M> skipped (1921)` with no `FAIL` line and no `Failed Tests` block.

- [ ] **Step 6: `git diff --check` whitespace validation**

Run:

```bash
git diff --check
```

Expected: no output, exit code 0.

- [ ] **Step 7: `git status --short` snapshot**

Run:

```bash
git status --short
```

Expected: list of modified files. Acceptable contents (current known set from the previous cleanup turn):

```
 M docs/MODULE_BOUNDARIES.md
 M docs/PROJECT_SNAPSHOT.md
 M docs/RUNTIME.md
 M tests/e2e/profile-home-feed-run-next.spec.ts
```

If `git status --short` is empty, the worktree was already committed by a prior turn — note that explicitly in the report and skip the "modified files" list. Do not commit during this plan.

---

### Task 3: Confirm CLI --help still references canonical verbs

**Files:** none modified

**Interfaces:**
- Consumes: root `package.json` scripts (must contain `operator:profile-home-feed:run-next`)
- Produces: --help output blocks that name only canonical verbs

- [ ] **Step 1: Confirm the canonical runner script is registered in `package.json`**

Run:

```bash
node -e "const p=require('/home/vi0l3tsc0rpi0n/coding/fgc-v3/package.json'); console.log(p.scripts['operator:profile-home-feed:run-next']);"
```

Expected: `tsx src/operator-tools/profile-home-feed-runner/cli.ts`.

- [ ] **Step 2: Spot-check three CLI help outputs**

Run:

```bash
pnpm operator:profile:provision -- --help 2>&1 | head -2
pnpm operator:collector:facebook -- --help 2>&1 | head -2
pnpm operator:profile-home-feed:run-next -- --help 2>&1 | head -2
```

Expected (order of lines is not significant — what matters is the verb):

```
  pnpm operator:profile:provision -- --token <provisioning-token> [--base-url <url>]
  pnpm operator:collector:facebook -- --source-group-id <source-group-id> ...
  pnpm operator:profile-home-feed:run-next -- --base-url <url> [--browser-provider playwright]
```

No occurrence of the removed aliases `pnpm profile:provision`, `pnpm collector:facebook:run`, `pnpm profile:home-feed:run-next` in any of the three help outputs.

---

### Task 4: Emit the handoff report

**Files:** none modified (report is written to stdout)

**Interfaces:**
- Consumes: outputs of Tasks 1–3
- Produces: a single Markdown report to the user containing changed files, verification results, and unverified items

- [ ] **Step 1: Assemble the report**

The report MUST contain these sections, in this order:

1. **Files changed** — list each path with a one-line description of the edit, drawn from the prior cleanup turns. Use the exact paths:

   - `docs/PROJECT_SNAPSHOT.md` — Sprint 065C3 milestone now references `pnpm operator:profile-home-feed:run-next`.
   - `docs/MODULE_BOUNDARIES.md` — one-shot executor description now references `pnpm operator:profile-home-feed:run-next`.
   - `tests/e2e/profile-home-feed-run-next.spec.ts` — header comment now references `pnpm operator:profile-home-feed:run-next`.
   - `docs/RUNTIME.md` — "Removed legacy aliases (Sprint 073)" section reformatted to an `Old command | Canonical command` table including the `profile:home-feed:run-next` -> `operator:profile-home-feed:run-next` row.

2. **Verification results** — a Markdown table with one row per command from Task 2 and Task 3, columns `Command | Result`. Use these literal command names (the runner column reports the exit code or pass/fail summary):

   - `pnpm typecheck`
   - `pnpm web:typecheck`
   - `pnpm web:build`
   - `pnpm exec vitest run`
   - `git diff --check`
   - `git status --short` (report the modified-file list, or "no modified files" if the worktree is clean)
   - `grep profile:home-feed:run-next` in current-state docs/source (report "no bare matches; only historical sprint doc references remain in `docs/SPRINTS/SPRINT-065C3-…`" if that is what the grep returned)

3. **Unverified items** — call out explicitly:

   - Docker stack, E2E harness, and Playwright `tests/e2e/profile-home-feed-run-next.spec.ts` were not executed (comment-only change, no runtime impact, opt-in Docker E2E excluded from Sprint 073 verification set).
   - Historical sprint doc `docs/SPRINTS/SPRINT-065C3-bounded-facebook-home-feed-execution.md` retains two mentions of the old alias at lines 216 and 371 (out of scope per spec).
   - `git status --short` may be empty if the worktree was committed by a prior turn; in that case note it explicitly rather than fabricating a modified-file list.

4. **No-go confirmations** — one sentence each:

   - "No commits, pushes, or sprint-pointer changes were made."
   - "No domain, schema, migration, HTTP contract, runtime, browser capture, extractor, profile checkout, lease, account-stage, authentication health, provisioning, or Content Builder behavior changes were made."

- [ ] **Step 2: Do NOT commit**

Do not run `git add`, `git commit`, `git push`, or any editor that mutates `docs/SPRINTS/active.md`. The plan's sole deliverable is the report to the user.

---

## Self-Review

**Spec coverage:**

- Finding 1 (`docs/PROJECT_SNAPSHOT.md`) — Task 1 Step 1 confirms end state.
- Finding 2 (`docs/MODULE_BOUNDARIES.md`) — Task 1 Step 2 confirms end state.
- Finding 3 (`tests/e2e/profile-home-feed-run-next.spec.ts`) — Task 1 Step 3 confirms end state.
- Finding 4 (RUNTIME table polish) — Task 1 Step 4 confirms end state.
- Out-of-scope: Task 1 Step 5 grep deliberately confirms historical sprint docs retain old aliases.
- Verification commands — Task 2 covers all six.
- Report — Task 4 specifies exact format and contents.
- "Do not commit/push/advance sprint" — Task 4 Step 2 enforces.

**Placeholder scan:** No `TODO`, `TBD`, "implement later", or generic "add appropriate" phrasing. Each step names the exact command and expected output.

**Type / name consistency:** This plan produces no code, so there are no function, method, or type names to keep consistent across tasks. The two literal strings that appear repeatedly — `operator:profile-home-feed:run-next` and `profile:home-feed:run-next` — are spelled identically across all tasks and the report template.
