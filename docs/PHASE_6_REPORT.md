# Phase 6 Report — Human Verification and Review Workflow

Date: 2026-11-23
Release: `0.5.0`
Scope: reviewer decisions on submitted inspection records, server-enforced state rules,
separation of duties, review notes, review history, and audit of every decision. Phase 5
(authorized AI model, dataset, evaluation, registry console) remains blocked; no detection,
severity, confidence, or accuracy claim exists.

## 1. Summary

Phase 6 adds a human review step to the inspection lifecycle. A reviewer or supervisor holding
`review:decide` can accept a submitted inspection as complete, or return it for clarification.
Accepting closes the record as `completed` and read-only. Returning reopens it as a `draft`
for the assigned inspector to revise and resubmit. Every decision is persisted with reviewer
notes, shown in the record, and written to the audit trail.

The decision concerns record completeness only. It is not a safety clearance, does not certify
infrastructure condition, and does not approve any AI output. The demo AI pipeline from Phase 4
remains advisory and is not reviewed per result in this phase.

## 2. Delivered scope

- New `inspection_reviews` table (Alembic `6b7f2e4d9a10`) with decision, notes, reviewer, and
  inspection references.
- `POST /api/v1/inspections/{id}/review` with `accepted` / `returned`, reviewer notes
  (5–2,000 characters), and optional optimistic `version`.
- Server-enforced rules: `review:decide` permission, organizational scope, submitted-only,
  assigned inspector cannot decide on their own record, and version conflicts return `409`.
- Inspect detail responses now include the latest 20 review decisions (newest first), including
  reviewer name, decision, notes, and timestamp.
- Audit actions `inspection.review_accepted` and `inspection.review_returned` with reference,
  decision, resulting status, and version.
- Review panel on `/inspections/[id]`: decision selector, required reviewer notes, confirmation,
  decision history, and returned/reopened guidance.
- Inspector view after a return: draft editing and submission are re-enabled; the returned
  decision and notes remain visible.
- Overview delivery status, banner, KPI hint, and phase labels updated for Phase 6; version
  `0.5.0` across API and web.
- API tests (8 new), a web helper test, and live API/browser verification.

## 3. Database changes

Migration `6b7f2e4d9a10` (down revision `3c1f8a7e9b20`):

- `inspection_reviews`: `decision` (`accepted`/`returned`, stored as text), `notes` text,
  `inspection_id` FK → `inspections.id` (RESTRICT), `reviewer_id` FK → `users.id` (RESTRICT),
  primary key, and timestamps.
- Indexes on `inspection_id` and `reviewer_id`.
- `created_at` is set in the API with microsecond precision so newest-first ordering is stable
  on SQLite and PostgreSQL.
- No change to the inspection status list; `submitted`, `draft`, and `completed` are reused.
  `review_pending` remains defined but is not used by this workflow.

## 4. API changes

`POST /api/v1/inspections/{inspection_id}/review` (`review:decide`):

```json
{
  "decision": "accepted",
  "notes": "Record and evidence reviewed; complete.",
  "version": 4
}
```

Behaviour:

- `accepted` → inspection status `completed`; record becomes read-only.
- `returned` → inspection status `draft`; the assigned inspector or a supervisor may edit and
  resubmit. The prior submission stays in the audit trail.
- `inspection.version` is incremented and returned in the detail response.
- The assigned inspector receives `403` when attempting to decide on their own record.
- Non-submitted records return `409`; already-completed records cannot be decided again.
- A stale `version` returns `409` and creates no review row.
- Cross-scope inspection IDs return `404` (existence is not disclosed).
- Notes shorter than 5 or longer than 2,000 characters return `422`.
- Response is the full inspection detail, including `reviews` and the updated status/version.

`GET /api/v1/inspections/{id}` now returns `reviews` (newest 20). The list endpoint is
unchanged. No review list/filter endpoint was added; reviewers use the existing inspection
status filter (`submitted`) to find work.

## 5. UI changes

- New client `ReviewPanel` on the inspection detail page:
  - visible decision form only for `review:decide` holders on submitted records they did not
    inspect;
  - accepts or returns with required notes and a confirmation step;
  - displays decision history with distinct chips, reviewer, timestamp, and notes;
  - explains that the decision is about record completeness and is not a safety clearance.
- The assigned inspector sees why self-review is blocked when viewing their own submitted
  record.
- Returned records show the draft editing and submit controls again; the page notice states
  the record was reopened for revision.
- Completed records show a completed next-step explanation and remain read-only.
- Overview: Phase 6 marked Delivered, Phase 7 Next, banner and KPI hint updated; inspections
  pages now use the Phase 6 eyebrow.
- Version `0.5.0` in `package.json`, the lockfile, API settings, and `/api/v1/meta`.

## 6. Verification performed

Automated:

- API: `ruff check app tests` clean; `pytest -q` → **49 passed**, including 8 review tests
  (accept, return→revise→resubmit→accept, submitted-only, self-review blocked, permission
  denied, version conflict creates nothing, notes bounds, cross-scope `404`).
- Web: `tsc --noEmit` and `eslint` clean; `npm test` → **31 passed** (new review-decision
  labels/tones test); `next build` succeeded and the container was rebuilt.
- Worker and Flutter suites unchanged: 8 and 6 passed.
- Total automated tests: **94 passed** (49 API, 8 worker, 31 web, 6 mobile).

Live (local Docker stack):

| ID | Check | Observed |
|---|---|---|
| I-38 | Migration and metadata | `6b7f2e4d9a10` applied; `/api/v1/meta` reports `0.5.0`; all six services healthy |
| I-39 | API return | Reviewer returned `DEMO-INS-0001`; status `draft`, review recorded, version incremented |
| I-40 | API revision and resubmission | Inspector edited the reopened draft and resubmitted; status `submitted` |
| I-41 | API accept | Reviewer accepted; status `completed`; history `[accepted, returned]`; repeat decision `409`; audit contains both review actions |
| I-42 | Browser return | Reviewer selected Return, entered notes, confirmed; page showed Draft, reopened notice, and the returned decision |
| I-43 | Inspector view | Inspector saw the returned reason, Edit draft, and Submit controls |
| I-44 | Browser accept | After resubmission, reviewer accepted; page showed Completed, accepted history above the returned decision, and read-only state |
| I-45 | Cleanup | Review rows removed, inspection reset to submitted v1 with seed notes, verification audit rows removed |

Browser verification used accessibility-tree snapshots and DOM assertions. No screenshots were
captured for Phase 6.

## 7. Security checks performed

- Review permission (`review:decide`) is enforced by the API on every decision; the UI form is
  only a convenience and hiding it is not the control.
- Organizational scope is enforced with the same prefix predicate as other inspection routes;
  cross-scope decisions return `404`.
- Separation of duties: the assigned inspector cannot record the decision for their own record,
  even when they hold `review:decide` (supervisor test).
- State machine: only submitted records can be decided; completed records cannot be re-decided;
  returned records become drafts and require the normal edit/submit rules.
- Optimistic concurrency: a stale version returns `409` without writing a review or changing
  status.
- Notes are trimmed and bounded (5–2,000 characters), rendered as text (no HTML injection).
- Every decision writes an audit event with actor, scope, target, reference, decision, new
  status, and version. Notes live on the review row, not in audit metadata.
- No safety or approval semantics are attached to the decision; the disclaimer remains on the
  record and in the API metadata.

## 8. Documentation updated

- `docs/PHASE_6_REPORT.md` (this file).
- `docs/CHANGELOG.md` — `0.5.0` entries.
- `docs/IMPLEMENTATION_STATUS.md` — Phase 6 complete, Phase 7 next, counts and capabilities.
- `docs/API_DOCUMENTATION.md` — review endpoint, payload, errors, permission, and detail field.
- `docs/TEST_REPORT.md` — Phase 6 results and remaining gaps.
- `docs/SECURITY_AUDIT_REPORT.md` — review authorization, separation of duties, and residual
  risks.
- `docs/KNOWN_LIMITATIONS.md` — review scope and unimplemented review features.

## 9. Blockers encountered

- No feature blockers. Phase 5 remains blocked by the absence of an approved dataset, model
  artifact, and evaluation protocol; nothing in Phase 6 creates an accuracy or detection claim.
- Verification tooling: programmatic clicks on some client buttons did not dispatch React
  handlers in the in-app browser; form submission was invoked through `requestSubmit()` and the
  confirmation dialog was overridden for automation only. The same paths were exercised through
  the API tests.

## 10. Limitations (must not be overstated)

- No reviewer assignment, review queue, notifications, or multi-stage approval; reviewers find
  submitted records through the existing status filter.
- One decision closes or reopens the record; there is no separate "in review" claim state and
  no per-media or per-AI-result review. Findings arrive in Phase 7.
- Reviewer notes are visible to any user with `inspections:read` in scope.
- Completed records cannot be reopened through the UI; correcting them requires a new record or
  direct database work.
- No dual-control, change approval, or review SLA.
- No screenshot evidence; responsive/cross-browser checks remain unverified.
- The workflow documents completeness only. No KCIC approval, safety clearance, or model
  validation is implied.

## 11. Next phase

Phase 7 — findings, work orders, and notifications: convert reviewed observations into
structured findings, track corrective actions and verification, and notify the right roles,
all server-enforced and audited. Phase 5's authorized model/evaluation work remains blocked.

## 12. Phase 6 gate

**Passed locally** for the implemented scope. Review decisions are permission- and
scope-checked, self-review and state violations are rejected, conflicts write nothing, and every
decision is auditable. The workflow was exercised end to end through the API and the browser on
synthetic DEMO data. Not approved for pilot, staging, production, or any KCIC operational use.
No KCIC infrastructure was accessed or tested.
