# Phase 7 Report — Findings, Work Orders, Notifications

Date: 2026-11-23
Release: `0.7.0`
Scope: reviewer-recorded findings on reviewed/inconclusive inspections, server-validated
corrective-action work orders with independent verification, a derived finding status, and
per-user in-app notifications. Phase 5 (authorized AI model, dataset, evaluation, registry
console) remains blocked; no detection, severity, confidence, or accuracy claim exists.

## 1. Summary

Phase 7 adds the maintenance follow-up loop after human review. A reviewer or supervisor holding
`findings:write` records a finding against an asset from an inspection that is `reviewed` or
`inconclusive`. A supervisor then assigns a work order to a technician inside their scope
subtree. The assignee starts and reports completion; an independent holder of
`work_orders:verify` confirms it. When no active work order remains, the finding closes
automatically with `closed_at`.

Findings and work orders track internal follow-up. They are not safety instructions, not a
dispatch system, and never declare a track, signal, or structure safe or unsafe. Statuses,
priorities, and rules are provisional DEMO rules pending KCIC approval.

## 2. Delivered scope

Backend:

- `findings`, `work_orders`, and `notifications` tables (Alembic `7d2a4c9e3b10`).
- Findings API: list (filters, pagination), per-status summary, create/update (version-checked),
  reject, and reopen. Creation is restricted to `reviewed`/`inconclusive` inspections; scope is
  derived from the inspection and enforced on every read/write.
- Work-order API: list, summary, subtree-limited assignee candidates, create, update, start,
  complete, verify, cancel. Transitions live in the backend; stale `version` returns `409` and
  writes nothing. Verification requires `work_orders:verify` and rejects the assignee.
- Derived finding status (`confirmed` → `assigned` → `in_progress` → `awaiting_verification` →
  `closed`, plus `rejected`) recomputed from active work orders on every transition.
- Notification service: recipients resolved up the scope ancestry by permission at event time;
  kinds for finding created/rejected/reopened and work-order assigned/reassigned/
  awaiting verification/verified/cancelled; per-user read state and unread summary.
- Audit actions for every finding and work-order change; notifications are not audited.

Web:

- `/findings` (filters, summary cards, advisory banner) and `/findings/[id]` (edit, reject,
  reopen, linked work orders, assign panel).
- `/work-orders` and `/work-orders/[id]` (start, complete, verify, cancel with required notes,
  status meaning in human-readable labels).
- `/notifications` (unread filter, open-record links, mark-one and mark-all read) plus an unread
  bell badge in the shell.
- Findings panel on `/inspections/[id]` for reviewers on reviewed records.
- Overview marks Phase 7 delivered; navigation roles extended (findings to reviewer/supervisor/
  administrator/auditor, work orders to inspector, notifications to all signed-in users).

## 3. Database changes

Migration `7d2a4c9e3b10` (down revision `9c4e1a2b7f30`):

- `findings`: unique reference, title, description, priority, status, resolution notes, version,
  `closed_at`, and FKs to inspection, asset, scope, and creator.
- `work_orders`: unique reference, title, instructions, status, completion and verification
  notes, version, `completed_at`, `verified_at`, and FKs to finding, scope, assignee, and creator.
- `notifications`: kind, title, body, optional target type/id, `read_at`, and FK → users
  (CASCADE).
- Indexes on reference/status/FKs and on `read_at`.

## 4. API changes

- `GET/POST /api/v1/findings`, `GET/PATCH /api/v1/findings/{id}`,
  `POST /api/v1/findings/{id}/reject`, `POST /api/v1/findings/{id}/reopen`,
  `GET /api/v1/findings/summary`.
- `GET/POST /api/v1/work-orders`, `GET/PATCH /api/v1/work-orders/{id}`,
  `POST /api/v1/work-orders/{id}/start|complete|verify|cancel`,
  `GET /api/v1/work-orders/summary`, `GET /api/v1/work-orders/assignees`.
- `GET /api/v1/notifications`, `GET /api/v1/notifications/summary`,
  `POST /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/read-all`.

Server-enforced rules:

- `findings:read`/`findings:write` on every route; cross-scope access returns `404`.
- Findings only from `reviewed`/`inconclusive` inspections (`409` otherwise); reject is blocked
  while an active work order exists.
- Work-order transitions: `open` → `in_progress` → `awaiting_verification` → `completed`, plus
  `cancelled` from active states; invalid transitions return `409`.
- Assignees must be active holders of `work_orders:read` inside the caller's scope subtree
  (outside the subtree → `404`).
- Verification by the assignee is rejected (`403`); every transition bumps `version` and writes
  an audit event.

## 5. Permissions

New codes: `findings:read`, `findings:write`, `work_orders:read`, `work_orders:write`,
`work_orders:verify`, `notifications:read`.

- Inspector: `work_orders:read`, `notifications:read`.
- Reviewer: `findings:read`/`write`, `work_orders:read`, `notifications:read`.
- Supervisor: `findings:read`/`write`, `work_orders:read`/`write`/`verify`,
  `notifications:read`.
- Administrator: all (including the new codes).
- Auditor: `findings:read`, `work_orders:read`, `notifications:read` (read-only).

## 6. Verification

Automated:

- API `ruff check app tests`: pass; `pytest`: **64 passed** (10 Phase 7 tests).
- Worker `ruff check worker tests`: pass; `pytest`: **8 passed**.
- Web: `tsc --noEmit` pass, `eslint src` pass, `vitest run` **38 passed / 5 files**,
  Docker `next build` success.
- Migration head confirmed as `7d2a4c9e3b10`; 6/6 Compose services healthy; `/api/v1/meta`
  reports `0.7.0`.

Live (synthetic DEMO data only):

- Reviewer accepted `DEMO-INS-0001`, created finding FND-20261123-C22D8C, and the supervisor
  received a `finding.created` notification.
- Supervisor created WO-20261123-813E58 assigned to DEMO Inspector; the inspector started and
  reported completion (v3, awaiting verification); the inspector's self-verify attempt returned
  `403`; the supervisor verified (v4, completed), and the finding closed with `closed_at`.
- `work_order.assigned`, `work_order.awaiting_verification`, and `work_order.verified`
  notifications were delivered; `POST /notifications/read-all` cleared the unread count.
- The auditor could read findings (`200`) but not create (`403`).

Browser (same lifecycle, driven through the UI):

- Inspector: opened the work order, entered completion notes, "Report completion" → Awaiting
  verification, v3, completion notes and timestamp rendered.
- Supervisor: "Verify completion" with notes → Completed, v4, verification notes and timestamp;
  the finding page shows Closed with `closed_at` and the completed work order linked.
- `/findings`, `/work-orders`, `/notifications`, and the inspection findings panel rendered
  correctly, including human-readable status labels.

## 7. Defects found and fixed

- D-23: with production `autoflush=False`, start/complete/verify/cancel read the active
  work-order set before the status change was flushed, so a verified work order could leave its
  finding in `awaiting_verification`. Fixed by flushing before the query and by mirroring
  `autoflush=False` in the test session factory.
- D-24: `/work-orders/assignees` resolved up the scope ancestry, hiding child-scope inspectors
  from a root supervisor. Fixed with subtree (`Scope.path == X OR Scope.path LIKE 'X/%'`)
  resolution and a regression test.
- Minor: two detail pages called `setLoading(true)` inside an effect (eslint
  `react-hooks/set-state-in-effect`); the redundant call and an unused helper were removed.

## 8. Limitations and safety boundary

- No due dates, overdue tracking, scheduling, cost/parts, attachments, multi-assignee work, or
  SLA/escalation; one assignee per work order.
- No dual control for verification, no assignment queue, and no out-of-app notification
  transport (in-app only, no e-mail/SMS/push, no delete).
- Finding severity/priority and the status model are provisional DEMO rules, not KCIC
  maintenance procedures.
- No per-media or per-AI-result review; the demo AI output remains advisory with no detection or
  accuracy claim.
- No claim of production readiness, KCIC validation, or safety clearance. No KCIC infrastructure
  was accessed or tested.

## 9. Verdict

Phase 7 gate: **passed locally** for the implemented DEMO scope. Findings are gated to reviewed
records, work-order transitions and assignment are enforced server-side, self-verification is
rejected, stale versions write nothing, notifications are private per user, and every material
action is audited.
