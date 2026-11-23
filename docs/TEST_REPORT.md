# Test Report — current build (0.7.0)

Date: 2026-11-23
Build: `0.7.0` Phase 7 (working tree; no git commit created)
Environment: Windows 10.0.26300, Docker Compose local stack, Python 3.13, Node.js 24.22.1,
Next.js 16.4.6, Flutter 3.47.7, PostgreSQL 16, Redis 7.4, MinIO 2025.7.23.

This report covers the 0.7.0 Phase 7 pass. The 0.6.0 and 0.5.0 results are retained below as
history. Features that remain unimplemented (reports/exports, real KPIs, authorized model
evaluation, mobile capture) were not run and are listed as gaps, not passes.

## 0.7.0 — Phase 7: findings, work orders, notifications

### Automated

| ID | Area | Command | Result |
|---|---|---|---|
| T-API-LINT | API static checks | `ruff check app tests` (`services/api`) | Pass, 0 findings |
| T-API-UNIT | API unit/integration (ASGI, SQLite in-memory, autoflush disabled) | `pytest` | **64 passed** |
| T-WRK-LINT | Worker static checks | `ruff check worker tests` (`services/ai-worker`) | Pass, 0 findings |
| T-WRK-UNIT | Worker unit tests | `pytest` | **8 passed** |
| T-WEB-TYPES | Web typecheck | `tsc --noEmit` | Pass |
| T-WEB-LINT | Web lint | `eslint src` | Pass |
| T-WEB-UNIT | Web unit tests | `vitest run` | **38 passed / 5 files** |
| T-WEB-BUILD | Web production build | Docker `next build` | Success |
| T-DB-MIGRATE | Migration state | `alembic current` in the API container | `7d2a4c9e3b10 (head)` |
| T-STACK | Runtime | `docker compose ps`, `GET /api/v1/meta` | 6/6 healthy; version `0.7.0` |

Mobile (Flutter) tests were not modified and were not rerun for 0.7.0.

0.7.0 API coverage (`services/api/tests/test_phase7.py`, 10 tests):
- Finding creation from a reviewed inspection, `finding.created` notification to the root
  supervisor, and `finding.created` audit.
- Findings blocked for unreviewed inspections (`409`) and for roles without `findings:write`
  (`403`).
- Full lifecycle: work order created by a supervisor, assigned to an inspector, started,
  completed, self-verification denied (`403`), verified by the supervisor, and the finding
  closed with `closed_at`.
- Invalid transitions and stale versions return `409`; cancel reverts the derived finding
  status; reject/reopen round-trip.
- Cross-scope: reviewer read `404`, reviewer work-order write `403`, out-of-subtree assignee
  `404`.
- Assignee candidates follow the caller's subtree (north inspector visible to the root
  supervisor, AI engineer excluded) and require `work_orders:write` (`403` for reviewers).
- Notifications are private per user and markable; auditors are read-only.

### Live integration (API, running stack)

Synthetic DEMO records only. Reviewer accepted the submitted `DEMO-INS-0001`, then:
reviewer finding → supervisor `finding.created` notification → supervisor work order assigned to
`DEMO Inspector` (assignee list now shows the north inspector) → inspector start
(`in_progress`) → complete (`awaiting_verification`) → inspector self-verify `403` → supervisor
verify → work order `completed` and finding `closed` with `closed_at`. Inspector and reviewer
received `work_order.verified` notifications; `POST /notifications/read-all` returned unread 0.
Auditor could list findings (`200`) but create one (`403`). `GET /api/v1/meta` reported
`0.7.0`; the migration head is `7d2a4c9e3b10`.

### Browser checks

- Overview marks Phase 7 delivered; the notification bell shows the unread count.
- `/findings`: scoped list with status/priority/search filters, summary cards, advisory banner.
- `/findings/[id]`: edit form, reject/reopen forms, linked work orders, and the assign-work-order
  panel listing subtree assignees.
- `/work-orders` and `/work-orders/[id]`: list filters and the action card for start, complete,
  verify, and cancel with note validation.
- `/notifications`: unread filter, open-record links, mark-one and mark-all read.
- `/inspections/[id]`: findings panel appears for reviewers on a reviewed record.

### Defects found and fixed

- D-23: with production `autoflush=False`, start/complete/verify/cancel read the active
  work-order set before the status change was flushed; a verified work order left its finding in
  `awaiting_verification`. Fixed by flushing before the query and by disabling autoflush in the
  test session factory so the suite matches production (no regression test depended on it).
- D-24: `/work-orders/assignees` resolved up the scope ancestry, so a root supervisor could not
  see child-scope inspectors. Candidate resolution now walks the subtree, with a test asserting
  the north inspector is listed and the AI engineer is not.
- Minor: two web detail pages called `setLoading(true)` inside an effect (eslint
  `react-hooks/set-state-in-effect`); the redundant call and an unused `reload` helper were
  removed.

### Verdict

0.7.0 gate: **passed locally** for the implemented DEMO scope. No KCIC validation, safety
clearance, detection, or accuracy claim is made; no KCIC infrastructure was accessed. The
findings and work-order rules are provisional DEMO rules, not KCIC maintenance procedures.

---

The sections below cover 0.6.0 and earlier and are retained as history.

## 0.6.0 — Phase 2/3 completion verification

### Automated

| ID | Area | Command | Result |
|---|---|---|---|
| T-API-LINT | API static checks | `ruff check app tests` (`services/api`) | Pass, 0 findings |
| T-API-UNIT | API unit/integration (ASGI, SQLite in-memory) | `pytest -q` | **54 passed** |
| T-WRK-LINT | Worker static checks | `ruff check worker tests` (`services/ai-worker`) | Pass, 0 findings |
| T-WRK-UNIT | Worker unit tests | `pytest -q` | **8 passed** |
| T-WEB-TYPES | Web typecheck | `tsc --noEmit` | Pass |
| T-WEB-LINT | Web lint | `eslint src` | Pass |
| T-WEB-UNIT | Web unit tests | `vitest run` | **32 passed / 5 files** |
| T-WEB-BUILD | Web production build | Docker `next build` | Success |
| T-DB-MIGRATE | Migration state | `alembic current` in the API container | `9c4e1a2b7f30 (head)` |
| T-STACK | Runtime | `docker compose ps`, `GET /api/v1/meta` | 6/6 healthy; version `0.6.0` |

Mobile (Flutter) tests were not modified and were not rerun for 0.6.0.

0.6.0 API coverage (`services/api/tests/test_phase23.py`):
- Nine-status workflow: review start (`submitted`/`ai_processed` → `under_review`), accept
  (`reviewed`), return (`draft`), inconclusive, and supervisor reopen (`reviewed`/`inconclusive`
  → `draft`); invalid transitions return `409`.
- Self-review blocked (`403`); stale version returns `409` and writes nothing.
- Inspections/assets summary endpoints return zero-filled counts.
- Password reset: non-enumerating request (`202`), admin issue, one-time confirm (`204`),
  reuse rejected (`400`), password policy (`422`), all sessions revoked on reset.
- User list `role_code`/`is_active` filters; asset `location_id` filter.
- Category and location create/update with scope validation and audit.

### Live integration (29/29 checks)

A temporary HTTP harness (removed after the run) exercised the running stack with a synthetic
64×64 PNG: admin login → create scoped inspector → inspector login → `403` on `/users` →
scoped asset visibility (2 vs 3) → cross-scope `404` → inspection create (`detailed`) → media
intent/upload (`ready`, SHA-256 match) → draft edit (`version` increment) → submit →
post-submit edit `409` → summary with 9 status keys → reviewer starts review → accept
(`reviewed`) → supervisor reopen (`draft`) → audit trail contains
created/updated/submitted/review_started/review_accepted/reopened → password-reset request
(`202`) → admin pending list → issue token → confirm (`204`) → old password `401` → new
password `200`. **All 29 checks passed.**

PostgreSQL after the run: inspections `2 draft / 1 submitted`; media `2 ready`; password
reset requests `1 completed / 1 issued`; audit events include the full inspection lifecycle.

### Browser checks

- `/inspections`: summary cards, 9 status options, Type column.
- `/inspections/[id]` as reviewer: type/location, Start review, three-way decision including
  Inconclusive.
- `/administration`: Users filters, pagination, Detail panel, Issue reset link; Password
  resets tab lists the pending request, issues a link, and displays the copyable URL.
- `/reset-password?token=…` and `/forgot-password` render and submit.
- `/assets`: counters, location filter; `/assets/reference`: category/location forms and lists.
- DEMO labeling and advisory footer present on all pages.

### Defects found and fixed

- D-19: password-reset list used a non-existent path (`/api/v1/users/password-reset-requests`)
  → corrected to `/api/v1/password-reset-requests`.
- D-20: the web image was stale after the path fix → rebuilt and redeployed; the pending
  request now renders.
- D-22: URL-derived state triggered `react-hooks/set-state-in-effect` in login/reset pages →
  targeted documented eslint disables.
- Verification note: some programmatic clicks did not dispatch React handlers in the in-app
  browser; form submission used `requestSubmit()` for automation only. The underlying flows
  are covered by API tests and now verified again in the UI.

### Verdict

0.6.0 gate: **passed locally** for the implemented DEMO scope. No KCIC validation, safety
clearance, detection, or accuracy claim is made; no KCIC infrastructure was accessed.

---

The sections below cover Phase 6 (0.5.0) and are retained as history.

## 1. Automated tests

| ID | Area | Command | Result |
|---|---|---|---|
| T-API-LINT | API static checks | `ruff check app tests` (`services/api`) | Pass, 0 findings |
| T-API-UNIT | API unit/integration (ASGI, SQLite in-memory) | `../../.venv/Scripts/python -m pytest -q` | **49 passed** (41 prior + 8 review) |
| T-WEB-LINT | Web lint | `npm run lint` | Pass |
| T-WEB-TYPES | Web typecheck | `npx tsc --noEmit` | Pass |
| T-WEB-UNIT | Web unit tests | `npm test` (Vitest) | **31 passed, 5 files** (30 prior + 1 review-decision test) |
| T-WEB-BUILD | Web production build | `next build` and Docker image rebuild | Success |
| T-WRK-UNIT | Worker unit tests | unchanged from Phase 4 | 8 passed |
| T-MOB-UNIT | Flutter widget/unit tests | unchanged from Phase 4 | 6 passed |

Total automated tests: **94 passed** (49 API, 8 worker, 31 web, 6 mobile). Worker and mobile
suites were not modified in Phase 6.

Phase 6 API coverage (`services/api/tests/test_reviews.py`):
- Reviewer accepts a submitted inspection: status becomes `completed`, version increments,
  review is returned in detail, audit `inspection.review_accepted` exists.
- Return → draft → inspector revision → resubmit → accept: history is
  `[accepted, returned]` newest-first.
- Review requires `submitted`; draft returns `409`; re-reviewing a completed record returns
  `409`.
- A supervisor cannot review an inspection they inspected themselves (`403`).
- An inspector without `review:decide` gets `403`.
- A stale `version` returns `409`, leaves status `submitted`, and creates no review row.
- Notes shorter than 5 or longer than 2,000 characters return `422`.
- A reviewer in another scope gets `404` for a south-corridor inspection.

Phase 6 refactor coverage: `auth_client`, `login`, and `auth_headers` moved to
`tests/conftest.py`; all prior auth/RBAC/media suites still pass.

Phase 6 web coverage (`src/lib/domain.test.ts`):
- Review decision labels and tones (`accepted` → success, `returned` → warning).

## 2. Integration checks executed against the running stack

| ID | Check | Action | Observed |
|---|---|---|---|
| I-38 | Migration and readiness | Rebuild API/web, wait for health | `6b7f2e4d9a10` applied; `/api/v1/meta` reports `0.5.0`; 6/6 services healthy |
| I-39 | API return | Reviewer returns `DEMO-INS-0001` with notes | `200`, status `draft`, review recorded, version incremented |
| I-40 | API revision and resubmission | Inspector edits reopened draft, resubmits | `200` edit; `200` submit; version `4` |
| I-41 | API accept | Reviewer accepts resubmitted record | `200`, status `completed`, decisions `[accepted, returned]`, repeat decision `409`, both audit actions present |
| I-42 | Browser return | Reviewer opens the record, selects Return, enters notes, confirms | Page shows Draft, "reopened as a draft" notice, and the returned decision with reviewer and notes |
| I-43 | Inspector view | Inspector opens the reopened record | Returned reason visible; Edit draft and Submit controls available; no review form |
| I-44 | Browser accept | Reviewer reopens after resubmission and accepts with notes | Page shows Completed, accepted decision above the returned one, read-only state and completed guidance |
| I-45 | Test-data cleanup | Remove verification reviews/audit rows; reset record | `DEMO-INS-0001` back to `submitted` v1 with seed notes; 0 review rows remain |

Browser checks used accessibility-tree snapshots and DOM assertions. No Phase 6 screenshots
were captured; responsive and cross-browser rendering were not verified.

## 3. Not executed (blocked by unimplemented scope)

- Reviewer queue, assignment, notifications, and multi-stage approval (not implemented).
- Per-media or per-AI-result review; findings and work orders (Phase 7).
- Two-session review conflict exercised with simultaneous browser sessions; the `409` version
  path is covered by API tests and code review.
- Reopening a completed record through the UI (no endpoint exists).
- Real inference, defect detection, or accuracy evaluation (no dataset/model).
- Malware scanning, EXIF stripping, upload abuse, quarantine workflow.
- PDF/Excel exports, operational KPIs, load/performance tests, backup/restore drills,
  container scanning, SBOM, secret-history scanning.
- Mobile end-to-end checks; Flutter remains widget-test only.

## 4. Defects found and retested

No product defects were found in Phase 6.

Verification tooling note: programmatic clicks on some client buttons did not dispatch React
handlers in the in-app browser; form submission was triggered with `requestSubmit()` and
`window.confirm` was overridden for automation only. The same workflows were exercised through
API tests, and the browser rendered the resulting state correctly.

## 5. Verdict

Phase 6 gate: **passed locally** for the implemented scope. Review decisions are restricted to
`review:decide` holders in scope, self-review and invalid states are rejected, conflicts write
nothing, returned records reopen as drafts, accepted records close as completed, and every
decision is audited. No claim is made about production readiness, KCIC approval, safety
clearance, findings, or AI validity. No KCIC infrastructure was accessed or tested.
