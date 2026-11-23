# Implementation Status — RailwayVision AI

Last updated: 2026-11-23
Current release: `0.7.0` (Phase 7: findings, work orders, notifications).
Working tree also contains unreleased `0.8.0-dev` work: operational dashboard, PDF/Excel
reports, AI model lifecycle registry, dataset registry, the `/models` console, configurable
inspection checklists, the red-identity design system (`docs/DESIGN_SYSTEM.md`), and the
Flutter field application (Fase B–C).

Kepatuhan terhadap master prompt produksi dan status validasi KCIC dicatat di
`docs/10_PROJECT_GOVERNANCE/PROMPT_COMPLIANCE.md` dan
`docs/10_PROJECT_GOVERNANCE/KCIC_VALIDATION_REGISTER.md`. Audit kondisi nyata dan
kesenjangan fitur ada di `docs/10_PROJECT_GOVERNANCE/EXISTING_PROJECT_AUDIT.md` dan
`docs/10_PROJECT_GOVERNANCE/IMPLEMENTATION_GAP_MATRIX.md`.

## Phase status

| Phase | Scope | Status | Evidence |
|---|---|---|---|
| 0 | Repository audit, requirements validation, plan, ADRs | Complete | `docs/REPOSITORY_AUDIT.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ADR/0001–0004` |
| 1 | Project foundation (repo, Docker, API, worker, web, mobile, DB, CI) | Complete (local) | `docs/PHASE_1_REPORT.md`, 6/6 Compose services healthy |
| 2 | Authentication, sessions, RBAC, scopes, users, audit, password recovery (API + web) | Complete (local), 0.6.0 | `docs/PHASE_2_REPORT.md`, `docs/PHASE_2_3_COMPLETION_REPORT.md`, 54 API tests, live browser verification |
| 3 | Asset register, reference data, inspection capture and 9-status workflow | Complete (local), 0.6.0 | `docs/PHASE_3_REPORT.md`, `docs/PHASE_2_3_COMPLETION_REPORT.md`, 29/29 live checks |
| 4 | Media evidence, private storage, integrity, demo AI pipeline | Complete (local) | `docs/PHASE_4_REPORT.md`, live upload/preview/job run in browser |
| 5 | AI engine with authorized dataset/model and evaluation | Blocked for accuracy claims | Demo pipeline delivered in Phase 4; no authorized model or dataset |
| 6 | Human verification and review workflow | Complete (local), extended in 0.6.0 | `docs/PHASE_6_REPORT.md`; review start, three-way decision, reopen |
| 7 | Findings, work orders, notifications | Complete (local), 0.7.0 | `docs/PHASE_7_REPORT.md`; 10 API tests, live lifecycle and browser verification |
| 8 | Dashboard KPIs, charts, PDF/Excel reports, inspection checklists | In progress (local, unreleased 0.8.0-dev): dashboard, reports, model/dataset registry, checklist master + snapshot + submit guard delivered; ops-console items pending | `app/api/routes/dashboard.py`, `reports.py`, `ai_registry.py`, `checklists.py`; `/` and `/reports`, `/models`, administration checklist tab; 77 API tests |
| 9 | Flutter field application (login, capture, upload, history, work orders) | Implemented locally (Fase B–C), widget-tested + live API layer; on-screen E2E pending | Login/session with secure storage and refresh rotation, inspection list/detail, checklist edit with optimistic version, offline draft sync, camera/gallery evidence, two-phase upload with client SHA-256, offline upload queue, work-order list/detail with permission-gated transitions; `flutter analyze` clean, 11 Flutter tests, live API smoke, release web build |
| 10 | Integration and security testing (TEST_PLAN/SECURITY_AGENT) | Not started | Phase-level checks only |

## What actually works today

- Docker Compose stack: postgres, redis, minio, api, ai-worker, web — all healthy; ports bound to loopback.
- Health and readiness probes; Celery worker heartbeat.
- Local authentication with Argon2id password hashes and short-lived JWT access tokens.
- Server-side sessions with opaque refresh tokens, rotation, logout revocation, and password-change revocation.
- Login rate limiting (5 failures / 300 s) with 429 responses.
- Self-service password-reset request with non-enumerating responses; administrators issue
  one-time links (SHA-256 digest at rest, 30-minute TTL, single use) and confirming a reset
  revokes all sessions. No e-mail provider: links are copied from the administration UI.
- RBAC with 6 roles and 22 permissions resolved per request from PostgreSQL.
- Hierarchical organizational scopes with prefix enforcement; cross-scope reads return 404.
- Audit trail for authentication, administration, asset, inspection, media, AI, and review
  events, exposed with filtering and pagination.
- User administration: list with search/role/scope/status filters and pagination, create,
  detail panel, edit roles/scope/active state, deactivate, issue one-time reset links,
  self-protection rules.
- Role permission matrix; scope creation; category and location reference-data maintenance.
- REST resources from the database: assets (with status summary and location filter),
  locations, categories, inspections.
- Inspection workflow: 9 statuses (`draft`, `submitted`, `ai_processing`, `ai_processed`,
  `under_review`, `reviewed`, `ai_failed`, `cancelled`, `inconclusive`), inspection type,
  location reference, generated reference, draft edit with optimistic locking, submit,
  cancel, review start, accept/return/inconclusive decisions, and supervisor reopen —
  all transitions validated in the backend.
- Web: login, forgot/reset password, guarded routes, session restore via HttpOnly cookie,
  profile page, administration console with five tabs, audit viewer, role-driven navigation,
  real audit activity on the overview.
- Asset register UI: summary counters, scoped list with search/status/category/location
  filters and pagination, asset detail with inspection history, create/edit forms, and a
  categories & locations reference screen.
- Inspection UI: list with status/mine filters and per-status summary, draft capture with
  asset preselect, type, and location reference, detail with version-checked editing,
  submit/cancel/reopen, review start and three-way review panel, and audit-backed history.
- Inspection checklists: administrator-managed templates (one active per inspection type),
  automatic item snapshot when a draft is created, per-item result/notes with optimistic
  versioning, and backend enforcement on submit (`422 checklist_incomplete`). Template edits
  never mutate existing snapshots; all changes are audited.
- Visual identity: mandated red palette (`#C61F33`/`#A8192D`/`#FCECEF`) with red active
  navigation, header accent, primary actions, and a red Flutter app bar/FAB/navigation;
  tokens documented in `docs/DESIGN_SYSTEM.md`.
- Same-origin web → API proxy (`/api/v1`, `/health`) so the refresh cookie stays first-party.
- Media evidence: private MinIO buckets, API-mediated two-phase upload, client+server SHA-256,
  signature/size validation, quarantine of mismatches, scoped preview/download with per-read
  audit, upload progress, retry after failure, and demo-job polling in the inspection detail.
- Demo AI pipeline: seeded `demo-image-quality` model, Celery queue, worker computing
  deterministic image-quality metrics with an explicit "not defect detection / no accuracy"
  disclaimer; job statuses, error codes, and audit events. Registry and lifecycle endpoints
  plus the `/models` console are available; artifacts themselves are not uploaded.
- Operational dashboard: live, scope-filtered KPI aggregation from PostgreSQL for inspections,
  findings, and work orders, a six-month Asia/Jakarta trend, recent inspections, and
  loading/empty/error states (`GET /dashboard/overview`).
- Reports: period summary plus PDF and Excel exports with advisory disclaimer and audit event
  `report.exported`, and a print layout (`/reports`).
- AI model governance: registration with checksum/dataset/class mapping, submit → approve
  (requires recorded evaluation metrics) or reject with mandatory notes, deploy with automatic
  retirement of the active peer in the same family (rollback path), retire, and lifecycle
  history. Dataset registry with source/license validation and approval workflow. Console at
  `/models`; migration `8f1c2d3e4a50` is applied locally.
- Findings from reviewed/inconclusive inspections, scoped and audited: create, version-checked
  edit, reject with active-work-order guard, reopen, filters, and per-status summary.
- Work orders with server-validated transitions (`open`, `in_progress`,
  `awaiting_verification`, `completed`, `cancelled`), subtree-limited assignees, reassignment,
  completion notes, verification by a non-assignee holder of `work_orders:verify`, and a derived
  finding status that closes the finding when no active work order remains.
- In-app notifications resolved up the scope ancestry by permission (finding created, work order
  assigned/reassigned/awaiting verification/verified), with per-user read state and an unread
  badge in the web shell. No e-mail/SMS transport.
- Web: `/findings`, `/findings/[id]`, `/work-orders`, `/work-orders/[id]`, `/notifications`, and
  a findings panel on the inspection detail page. The overview marks Phase 7 delivered.
- Demo seed: 6 users, 3 scopes, 6 categories, 2 locations, 3 assets, 1 inspection,
  1 demo AI model — all labelled DEMO.
- Flutter field application (Fase B–C): secure token storage, login gate with demo-account hints,
  session restore and refresh rotation with 401 fallback, Indonesian workspace shell with live
  readiness and server-computed workload, inspection list/detail, checklist editing with
  optimistic version checks and `checklist_incomplete` messaging, offline checklist drafts with
  explicit sync/conflict handling, camera/gallery capture with client-side SHA-256, two-phase
  media upload, and an offline upload queue (persistent on native, in-memory on web).
  Work orders: "assigned to me" / scoped list with status filters, detail (finding, priority,
  asset, assignee, instructions, notes), and start/complete/verify/cancel actions with
  required notes and confirmation. Actions are shown only when the session holds the matching
  permission; every transition remains server-validated and audited. All access decisions
  remain server-enforced.

## Not implemented (do not assume)

- Any trained model, dataset, defect taxonomy, detection boxes, severity, confidence, or
  accuracy evaluation. The demo pipeline produces image-quality statistics only.
- E-mail/SMS delivery of reset links; reset-request rate limiting; automatic expiry sweep.
  MFA and refresh-token reuse detection.
- Video processing; EXIF/GPS stripping; malware scanning; media deletion, captions, per-
  inspection limits, or quarantine purge workflow.
- Model artifact upload/download, checksum verification against stored blobs, and artifact
  retention policy.
- Per-media or per-AI-result review; reviewer assignment, review queue, or review SLAs.
- Work-order due dates, overdue tracking, scheduling, or notifications outside the app.
- Operations console: AI job history, role-restricted log viewer, backup status, deployment
  history, and safe DEMO-only reset.
- Mobile: no on-screen/canvas UI automation against the live API and no physical-device
  testing; the live check covers the app's `ApiClient` only. No Android/iOS signed builds;
  web offline queue is memory-only; no push notifications or background sync; no offline
  media preview cache beyond queued bytes. Work orders are read/transition-only on mobile:
  no creation, reassignment, or editing; findings have no dedicated mobile screen.
- Asset deletion/archiving, QR labels, and asset status history.
- Session/device management UI.

## Verification gates

- Phase 1 gate: passed locally on 2026-11-23 (`docs/TEST_REPORT.md`).
- Phase 2 gate: **passed locally on 2026-11-23** — RBAC/scope/audit checks; extended in 0.6.0
  with password recovery and filtered user administration.
- Phase 3 gate: **passed locally on 2026-11-23** — asset/inspection flows and version-conflict
  handling; extended in 0.6.0 with the 9-status workflow, review start, and reopen.
- Phase 4 gate: **passed locally on 2026-11-23** — upload/intent/checksum round-trip,
  quarantine and RBAC denials, browser upload/preview/demo job, audit verification.
- Phase 6 gate: **passed locally on 2026-11-23** — accept/return cycle; extended with
  inconclusive decisions and review start.
- 0.6.0 completion gate: **passed locally on 2026-11-23** — 54 API, 8 worker, 32 web tests;
  web build; migration `9c4e1a2b7f30`; 29/29 live checks; browser verification of all new
  screens (`docs/PHASE_2_3_COMPLETION_REPORT.md`).
- Phase 7 gate: **passed locally on 2026-11-23** — 64 API, 8 worker, 38 web tests; web build;
  migration `7d2a4c9e3b10`; live API lifecycle (finding → work order → start → complete →
  verify → finding closed), notification delivery, and browser verification
  (`docs/PHASE_7_REPORT.md`).
- Unreleased 0.8.0-dev local gate: **passed locally on 2026-11-23** — 77 API, 8 worker,
  38 web tests; ruff, TypeScript, and ESLint clean; containers rebuilt; migration
  `8f1c2d3e4a50` applied; dashboard, report export, and `/models` console verified in the
  browser. This is not a release gate.
- Fase B–C local gate: **passed locally on 2026-11-23** — `flutter analyze` clean, 11 Flutter
  widget tests passed, one live API-layer smoke test passed against the running Compose stack
  (login, readiness, scoped inspections, detail, work orders, assets, logout),
  `flutter build web --release` succeeded, and the existing 77 API / 38 web tests still pass.
  On-screen UI automation and physical-device testing remain pending and are not claimed.
- Release gate: per `TEST_PLAN.md` §4; not satisfied. No KCIC validation exists.

## Known blockers / stakeholder decisions

- Approved identity provider and KCIC role/scope model (local adapter is a placeholder).
- Approved asset master data, location hierarchy, and inspection type/status taxonomy.
- Authorized dataset, model artifacts, and evaluation protocol before any accuracy claim.
- Production object-storage platform and supply-chain posture.
- Data classification, retention (including media evidence and quarantine), backup, and
  incident-response requirements.
- Written authorization before any KCIC infrastructure testing.

## Next step

Fase C work orders are available on mobile (list, detail, permission-gated transitions) on top of
the verified checklist and field-capture foundation. Next: Fase D operations console (AI job
history, role-restricted log viewer, backup status, deployment history, safe DEMO-only reset), with
backup status reported honestly as not configured until environment policy exists. The Phase 5
authorized model/evaluation work remains blocked until a dataset, model artifact, and evaluation
protocol are approved; the demo AI output stays advisory and no detection or accuracy claim is
made.
