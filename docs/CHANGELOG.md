# Changelog

All notable changes to RailwayVision AI are recorded here. Dates are UTC. This project is a decision-support prototype; nothing here implies production approval.

## [0.8.0] — 2026-11-23 — Fase D: operations console, honest ops status, synthetic reset

### Added
- Operations console (`/operations`) backed by real endpoints:
  - `GET /api/v1/ops/ai-jobs` — paginated AI job history with status/search filters,
    scope-subtree filtering, and `detections:read`.
  - `GET /api/v1/ops/logs` — bounded in-process log buffer with level/search filters and
    redaction of passwords, bearer tokens, and signed URLs; `audit:read` required.
  - `GET/POST /api/v1/ops/deployments` — manual deployment records validated against
    `APP_ENV`, stamped with the authenticated operator and `deployment.recorded` audit.
  - `GET /api/v1/ops/backup` — status reported verbatim from `BACKUP_STATUS_FILE`
    (`ok`, `stale`, `unavailable`, `invalid`, `not_configured`); never infers health.
  - `GET /api/v1/ops/synthetic-reset/preview` and `POST /api/v1/ops/synthetic-reset` —
    phrase-confirmed (`HAPUS DATA SINTETIS`), `ops:manage`, local/test only, limited to
    `SINTETIS-*` transaction rows, audited as `synthetic_data.reset`; storage cleanup is
    best-effort and reported separately.
- Web tabs for AI jobs, logs, deployments, backup, and synthetic reset with loading, empty,
  and error states; operations navigation entry for supervisor, auditor, and administrator.
- New permission `ops:manage` (administrator) and `audit:read` use for the console.
- Alembic `d1e2f3a4b5c6` relabels existing rows from `DEMO` to `SINTETIS` and renames worker
  model identifiers (`synthetic-image-quality`, `0.1.0-sintetis`, `synthetic_only`).
- Regression test ensuring `seed_rbac` grants newly introduced permissions to existing roles.

### Changed
- All user-facing `DEMO` wording replaced with `SINTETIS` across API, web, worker, Flutter,
  tests, seed data, and environment variable names (`SEED_SYNTHETIC_DATA`, `SEED_PASSWORD`,
  `SYNTHETIC_AI_ENABLED`). Internal `is_demo` columns keep their names.
- Worker modules renamed to `worker/synthetic_ai.py` and `worker/synthetic_jobs.py`.
- Release version bumped to `0.8.0` in API settings, `/api/v1/meta`, `package.json`, and the
  lockfile.
- Navigation: "Konsol Operasi" visible to supervisor, auditor, and administrator.

### Security
- Log redaction runs before serialization; reset is refused outside local/test, without
  `ops:manage`, or without the exact confirmation phrase.
- Removed the literal seed password from the login page and both `.env.example` files; the
  password now comes only from `SEED_PASSWORD` at runtime.

### Previously delivered in the 0.8.0 cycle
- Configurable inspection checklists: `checklist_templates`, `checklist_template_items`,
  and `inspection_checklist_results` (Alembic `c4d5e6f7a8b9`). Master API
  `GET/POST/PATCH /master/checklist-templates` requires `inspections:manage` for writes and
  keeps at most one active template per inspection type. Inspection creation snapshots the
  active template; `PATCH /inspections/{id}/checklist` records per-item results/notes while
  the record is a draft; submit returns `422 checklist_incomplete` while required items are
  unanswered. Template changes never mutate existing snapshots. Audit events:
  `checklist_template.created/updated`, `inspection.checklist_updated`.
- Web checklist panel on inspection detail (progress, per-item result/notes, optimistic
  version check) and an administration tab for template creation/activation.
- Design tokens aligned to the mandated palette (`#C61F33`, `#A8192D`, `#FCECEF`, `#F8F9FB`,
  `#101820`, `#667085`, `#E5E7EB`); AI/focus accents moved into the red family. Active
  sidebar navigation, header accent, primary actions, Flutter app bar, filled buttons, FAB,
  and navigation indicator now carry the red identity. Documented in `docs/DESIGN_SYSTEM.md`.
- Flutter field application (Fase B): login/session restore with secure token storage and
  single-flight refresh rotation; Indonesian workspace shell with live readiness and
  server-computed workload; inspection list and detail with status chips; checklist editing
  with optimistic versioning plus `checklist_incomplete` handling; offline checklist drafts
  with explicit sync and version-conflict recovery; camera/gallery evidence with client
  SHA-256; two-phase media upload; offline upload queue (persistent on native, in-memory on
  web). Verified with `flutter analyze`, 7 Flutter tests, a release web build, and a live
  `ApiClient` smoke test against the local Compose stack (login, readiness, inspections,
  detail, assets, logout). On-screen UI and physical-device end-to-end testing remain pending.
- Flutter work orders (Fase C): replaced the planned-module placeholder with a live
  work-order list ("assigned to me" / scoped, status filters, refresh, empty/error states)
  and detail screen (finding, priority, asset, assignee, instructions, completion and
  verification notes). Start, complete, verify, and cancel actions are shown only with the
  matching permission, require confirmation, enforce minimum note length client-side, and
  rely on server-validated transitions (version conflicts surface the API message with a
  reload action). Added work-order API client methods, status/priority chips, and four widget
  tests; extended the live smoke to list/fetch work orders. 11 Flutter tests pass, analyze is
  clean, and the release web build succeeds.
- `GET /api/v1/dashboard/overview`: live KPI counts (inspections, findings, work
  orders), status breakdowns, six-month inspection trend bucketed in Asia/Jakarta,
  and the five most recent inspections — all scope-filtered from PostgreSQL.
- Web operational overview (`components/operational-overview.tsx`) replacing the phase
  placeholder: KPI cards, trend chart with accessible label, status distribution bars,
  recent-inspections table, loading/empty/error states, and a refresh action.
- Reports API (`reports:read`): `GET /reports/summary`, `GET /reports/inspections.xlsx`,
  `GET /reports/inspections.pdf`; PDF/Excel exports include period, scope note, and the
  AI advisory disclaimer. Exports are audit-recorded (`report.exported`).
- Web reports page (`/reports`) with Jakarta date defaults, totals, status breakdowns,
  detail table, PDF/Excel download, and print styles.
- AI model lifecycle API (`ai_registry`): submit for approval, approve/reject with notes,
  deploy (retires active peers in the same family, enabling rollback), retire, and
  lifecycle history from the audit trail. Approval requires recorded evaluation metrics;
  submission requires checksum, dataset version, and class mapping.
- Dataset registry API: create, submit, approve/reject; source and license note are
  mandatory before submission.
- Web model and dataset console (`/models`): registration forms, status/approval chips,
  metrics display (only recorded values), deployment actions, decision dialog with
  mandatory notes, and per-model history.
- Alembic `8f1c2d3e4a50`: `datasets` table and AI lifecycle columns on `ai_models`
  (family, approval status/notes/by, dataset version, checksum, class mapping, training
  config, evaluation, deploy/retire timestamps); backfills `family` and `synthetic_only` for
  existing seeded models. Reversible downgrade included.
- Dependencies: `openpyxl==3.1.5`, `reportlab==4.2.5`.

### Changed
- Navigation: "Pengelolaan Model AI" now routes to `/models` (AI engineer, administrator,
  auditor); reports item marked delivered.
- Synthetic registry seed records family, `synthetic_only` approval, and known limitations.
- Print stylesheet hides navigation and chrome for report printing.

### Security
- Removed the literal seed password from the login page and both `.env.example`
  files; the password now comes only from `SEED_PASSWORD` at runtime.

### Tests
- API suite: 83 passed (console permissions, log redaction, scope-filtered jobs, deployment
  audit, backup status transitions, reset guards, RBAC reconciliation).
- Web: 39 passed; TypeScript and ESLint clean. Worker: 8 passed. Flutter: 11 passed.
- Live checks: dashboard counts, `/models` rendering, PDF/XLSX export, `/operations` tabs in
  the browser with screenshots; migration `d1e2f3a4b5c6` applied to PostgreSQL; containers
  rebuilt; all services healthy.


## [0.7.0] — 2026-11-23 — Phase 7: findings, work orders, notifications

### Added
- Alembic `7d2a4c9e3b10` (additive): `findings`, `work_orders`, and `notifications` tables with
  unique references, scope/foreign-key indexes, and `notifications.read_at`. The migration also
  inserts the `work_orders:read` permission and grants it to the `inspector` role when missing.
  Existing rows are preserved.
- Findings API: scoped list/summary/detail with filters; `POST /findings` from a `reviewed` or
  `inconclusive` inspection; version-checked edit while `confirmed`; reject (blocked by active
  work orders) and reopen. References `FND-YYYYMMDD-XXXXXX`.
- Work-order API: scoped list/summary/detail with filters; assignee candidate list limited to the
  caller's subtree; create/update with server-validated assignee; start, complete, verify, and
  cancel transitions. References `WO-YYYYMMDD-XXXXXX`.
- Derived finding status from active work orders; verification closes the finding when no active
  work order remains. Rules live in `app/core/maintenance_workflow.py` as provisional DEMO rules.
- In-app notifications for finding creation, work-order assignment/reassignment, verification
  requests, and verification outcomes. Recipients resolve up the scope ancestry by permission;
  users only ever read and mark their own notifications.
- Web: `/findings` and `/findings/[id]` (edit, reject, reopen, assign work order), `/work-orders`
  and `/work-orders/[id]` (edit, start, complete, verify, cancel), `/notifications` with an
  unread badge in the header, and a findings panel on the inspection detail page.
- Tests: `services/api/tests/test_phase7.py` (10 tests); web domain and navigation tests for the
  new labels, tones, notification links, and role visibility.

### Changed
- RBAC: inspectors gain `work_orders:read`; reviewers, supervisors, administrators, and auditors
  keep their read/manage combinations (`reviewer` has no work-order write; supervisor and
  administrator hold write and verify).
- Scope semantics: notification recipients match the resource scope and its ancestors, while
  work-order assignee candidates match the caller's scope and its descendants; assignment still
  requires the assignee to sit inside the finding's subtree.
- Test session factory now disables autoflush to mirror production session settings.
- Release version `0.7.0` in API settings, `/api/v1/meta`, `package.json`, and the lockfile.

### Fixed
- Work-order start/complete/verify/cancel read the active-work-order set before flushing the
  status change, so with production `autoflush=False` a verified work order could leave its
  finding stuck in `awaiting_verification`. Each transition now flushes first (D-23).
- Work-order assignee candidates resolved up the scope ancestry, hiding child-scope inspectors
  from a root supervisor. Candidates now resolve down the scope subtree (D-24).

### Security
- Every maintenance route checks a backend permission; cross-scope finding/work-order reads and
  writes return `404`, and notifications for other users return `404`.
- Self-verification is blocked unless the caller also holds `work_orders:write`; findings cannot
  be created from unreviewed inspections; closed/rejected findings cannot receive work orders.
- All finding and work-order mutations are audit-recorded with actor, scope, and version.

## [0.6.0] — 2026-11-23 — Phase 2/3 completion: workflow, recovery, reference data

### Added
- Alembic `9c4e1a2b7f30` (additive): `inspections.inspection_type`,
  `inspections.location_reference`, and `password_reset_requests` (status, token digest,
  expiry, issuer, timestamps) with indexes. Existing rows preserved.
- Nine-status inspection workflow with server-side transition sets in
  `app/core/inspection_workflow.py`: `draft`, `submitted`, `ai_processing`, `ai_processed`,
  `under_review`, `reviewed`, `ai_failed`, `cancelled`, `inconclusive`.
- `POST /api/v1/inspections/{id}/review/start` (`submitted`/`ai_processed` → `under_review`)
  and `POST /api/v1/inspections/{id}/reopen` (`reviewed`/`inconclusive` → `draft`).
- Three-way review decisions: `accepted` → `reviewed`, `returned` → `draft`,
  `inconclusive` → `inconclusive`; self-review and invalid states rejected.
- Password recovery: non-enumerating `POST /auth/password-reset/request` (`202`),
  administrator-issued one-time tokens (`GET /password-reset-requests`,
  `POST /users/{id}/password-reset-token`, 30-minute TTL, hashed at rest), and
  `POST /auth/password-reset/confirm` that revokes all sessions.
- `GET /api/v1/inspections/summary` and `GET /api/v1/assets/summary` status counts.
- User list filters `role_code` and `is_active`; asset list filter `location_id`.
- Reference-data writes: `POST/PATCH /api/v1/asset-categories` and
  `POST/PATCH /api/v1/locations` (scope-validated, audited).
- Web: `/forgot-password`, `/reset-password`, password-reset tab in administration, user
  detail panel with reset-link issuing, `/assets/reference` (categories and locations),
  asset summary cards and location filter, inspection type/location fields, review start,
  reopen action, inconclusive decision option, and an upload retry button.
- Tests: `services/api/tests/test_phase23.py`; web unit tests for the new domain helpers.

### Changed
- Inspection creation/edit accepts `inspection_type` (routine/detailed/follow_up/emergency)
  and `location_reference` (≤200 chars); list/detail responses include both.
- Media upload and demo-AI queue gates now use the 9-status sets (terminal statuses
  `reviewed`/`cancelled`/`inconclusive`; AI queue from `submitted`/`ai_processed`/`ai_failed`).
- Administration Users tab rewritten with filters, pagination, detail panel, and one-time
  reset links; Roles/Scopes tabs unchanged.
- Release version `0.6.0` in API settings, `/api/v1/meta`, `package.json`, and the lockfile.

### Fixed
- Password-reset list called a non-existent path (`/api/v1/users/password-reset-requests`);
  corrected to `/api/v1/password-reset-requests` and the web image rebuilt (D-19/D-20).
- Login and reset pages triggered `react-hooks/set-state-in-effect` for URL-derived notices;
  targeted, documented eslint disables added (D-22).

### Security
- Reset tokens are random, stored only as SHA-256 digests, single use, 30-minute TTL, and
  invalidated on use; confirming a reset revokes all active sessions.
- Reset requests do not reveal whether an email exists; the admin list is scope-filtered.
- Every workflow transition, review start, reopen, reset action, and reference-data change is
  audit-recorded. Permission and scope checks remain server-side.
- Reset links are delivered manually by an administrator; no e-mail provider, rate limit, or
  expiry sweep exists yet. See `docs/KNOWN_LIMITATIONS.md`.

### Known limitations
No e-mail delivery for reset links; no MFA, refresh-token reuse detection, or session UI.
Inspection types and statuses are provisional DEMO taxonomy. No findings, work orders,
notifications, reports, video, or real AI detection. See
`docs/PHASE_2_3_COMPLETION_REPORT.md` and `docs/KNOWN_LIMITATIONS.md`.

## [0.5.0] — 2026-11-23 — Phase 6 human verification and review workflow

### Added
- `inspection_reviews` table (Alembic `6b7f2e4d9a10`) storing decision, reviewer notes,
  reviewer, inspection, and timestamps, with indexes on inspection and reviewer.
- `POST /api/v1/inspections/{id}/review`: `accepted` completes the record, `returned`
  reopens it as a draft for revision; reviewer notes (5–2,000 chars) and optional optimistic
  `version` are required/supported.
- Server guards: `review:decide` permission, organizational scope, submitted-only records,
  assigned inspector cannot decide on their own record, and stale versions return `409`.
- Inspection detail responses include the newest 20 review decisions with reviewer, notes, and
  timestamp.
- Audit actions `inspection.review_accepted` and `inspection.review_returned`.
- Web review panel with decision selector, notes, confirmation, decision history, and
  returned/reopened guidance; returned drafts regain edit/submit controls for the inspector.
- API tests for accept, return/revision/resubmission, permission and self-review denials,
  version conflicts, notes bounds, and cross-scope `404`.

### Changed
- Overview delivery status: Phase 6 Delivered, Phase 7 Next; banner and KPI hint describe the
  review workflow honestly (KPI values still arrive in Phase 8). Inspections pages use the
  Phase 6 eyebrow.
- Release version `0.5.0` in API settings, `/api/v1/meta`, `package.json`, and the lockfile.

### Security
- Review decisions are permission- and scope-checked in the backend; hiding the UI form is not
  the control. Separation of duties blocks self-review.
- Every decision is audited with actor, target, decision, resulting status, and version;
  reviewer notes are stored on the review row and rendered as text.
- The decision is a record-completeness check only — no safety clearance, no AI approval, and
  no detection or accuracy claim.

### Known limitations
No reviewer assignment or review queue, no notifications, no per-media or per-AI-result review,
no multi-stage approval, and no reopen path for completed records. Reviewer notes are visible to
readers in scope. See `docs/KNOWN_LIMITATIONS.md` and `docs/PHASE_6_REPORT.md`.

## [0.4.0] — 2026-11-23 — Phase 4 media evidence and demo AI pipeline

### Added
- Schema and Alembic migration `3c1f8a7e9b20`: `media_objects` (claimed/verified SHA-256,
  status, quarantine reason, bucket/key), `ai_models` (registry), and `ai_jobs` (queue status,
  error code, JSON result).
- Private MinIO buckets (`railwayvision-media`, `railwayvision-quarantine`) with an async
  storage adapter; JPEG/PNG/WebP allowlist and magic-byte signature sniffing.
- Two-phase, API-mediated upload: `POST /inspections/{id}/media` intent, then
  `PUT /media/{id}/content` with server-side size, signature, and SHA-256 re-verification.
  Mismatches are quarantined (`size_mismatch`, `content_type_mismatch`,
  `checksum_mismatch`), audited, and never accepted as evidence.
- Scoped media listing and authorised content reads (`inline` / `?download=true`) with
  per-read audit (`media.downloaded`) and RFC 5987 filenames. No presigned URLs are issued.
- Demo AI pipeline: seeded `demo-image-quality` model, Celery task `ai.demo_quality_check`,
  worker computing deterministic image-quality metrics and flags with an explicit
  "not defect detection / no accuracy claim" disclaimer.
- Model registry endpoints (`GET /api/v1/models`, `POST /api/v1/models`) with audit.
- Inspection detail now returns real `media_count` and `pending_detections`.
- Web evidence panel on `/inspections/[id]`: browser SHA-256, XHR upload with progress,
  integrity status and digest display, authorised blob preview/download, quarantine reasons,
  "Run demo check" with 3 s status polling and labelled metrics.
- Config/Compose: `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `MINIO_*`, `MEDIA_MAX_BYTES`,
  `DEMO_AI_ENABLED`; worker database/storage settings; MinIO health gating; non-local guards
  require MinIO credentials and reject localhost storage.
- Media request-body limit: only the media content PUT is bounded by `MEDIA_MAX_BYTES`.

### Fixed
- Storage adapter forwarded `content_type` as a keyword to `anyio.to_thread.run_sync`, which
  only accepts positional args; uploads failed with `500` (D-16).
- Queue adapter forwarded `args=[job_id]` to `run_sync` instead of `send_task`, so every AI
  job was marked `queue_unavailable` (D-17). Both adapters now use `functools.partial` and are
  covered by new regression tests (`tests/test_adapters.py`).
- The inspection sidebar kept showing a pending AI job after the worker finished; the evidence
  panel now refreshes the page counters when its job list drains (D-18).

### Security
- Evidence is private and reachable only through scope-checked, audited API reads; object keys
  are server-generated and clients cannot choose buckets or keys.
- Upload validation covers declared size, file signature, and SHA-256 against the intent; the
  media body limit is enforced by middleware rather than the JSON parser.
- Demo AI is disabled by configuration in production and returns labelled advisory output
  only; no detections, severity, or accuracy values exist.
- `pip-audit`: no known vulnerabilities (includes `minio`, `celery`); `npm audit --omit=dev`:
  0 vulnerabilities.

### Known limitations
No trained model, dataset, evaluation, or detection output; demo image-quality heuristics only.
No malware scanning, EXIF stripping, thumbnails, media deletion, or quarantine purge workflow;
previews/downloads are audited full-object reads. No model console UI. See
`docs/KNOWN_LIMITATIONS.md` and `docs/PHASE_4_REPORT.md`.

## [0.3.0] — 2026-11-23 — Phase 3 asset register and inspection capture UI

### Added
- `/assets`: scoped asset list with search, status/category filters, pagination, DEMO badges,
  and a registration form for `assets:write` holders.
- `/assets/[id]`: asset detail with record metadata, recent inspection history, edit action,
  and a "New inspection" shortcut that preselected the asset.
- `/inspections`: server-filtered list (status, only-mine) with pagination and record links.
- `/inspections/new`: draft capture with scope-limited asset select, `?asset=` preselection,
  `datetime-local` → UTC conversion, and a 4,000-character notes limit.
- `/inspections/[id]`: version-checked draft editing with an explicit `409` reload path,
  submit and cancel with confirmation, read-only post-submission view, record version, and
  audit-backed history with a lifecycle fallback for users without `audit:read`.
- Shared UI primitives (DEMO badge, status chips, pagination) and domain helpers with tests.
- Same-origin proxy in `apps/web/next.config.ts`: browser calls `/api/v1/*` and `/health/*`,
  Next.js rewrites to `API_PROXY_TARGET` (`http://api:8000` in Compose).
- Navigation unlocks Inspections and Assets & Locations (Phase 3) for permitted roles.

### Fixed
- Session was lost on reload when the app was opened via a different hostname than the one
  that set the refresh cookie; the same-origin proxy keeps the cookie first-party (D-12).
- Inspection history did not refresh after save/submit/cancel; a refresh key now re-queries
  audit events (D-13).
- TypeScript build errors in the new screens (`latest_inspection` not on the list schema;
  possibly-undefined asset in the editor) (D-14).
- Verification-only records (test asset, test inspections, temporary scope) removed from the
  local database so the demo starts from the seed state (D-15).

### Security
- The web app no longer makes cross-origin credentialed requests; CORS remains only for
  direct/native API clients. Access tokens stay in memory; no new token storage was added.
- All new screens rely on backend RBAC and scope enforcement; the inspector live check
  confirmed UI hiding is not the control.

### Known limitations
No asset deletion/QR, no media or AI yet, no findings/work orders/reports, asset updates are
last-write-win, and screenshots could not be captured in the in-app browser. See
`docs/KNOWN_LIMITATIONS.md` and `docs/PHASE_3_REPORT.md`.

## [0.2.0] — 2026-11-23 — Phase 2 identity, RBAC, scopes, audit

### Added
- Local identity adapter: Argon2id password hashing, HS256 access tokens (15 min) bound to
  server-side sessions, opaque refresh tokens (7 days) stored as SHA-256 digests, rotation on
  refresh, logout revocation, and password-change session revocation.
- HttpOnly `SameSite=Lax` refresh cookie for the web app; `X-Refresh-Transport: body` for
  native clients. Session restore on page reload.
- Login rate limiting: 5 attempts / 300 s per email digest (Redis).
- RBAC: 6 roles, 22 permissions, database-resolved per request; administrator role fixed.
- Hierarchical scopes with prefix enforcement across assets, inspections, users, and audit events.
- Administration API: users CRUD/deactivate, roles and permission matrix, scopes.
- Assets and inspections API: categories, locations, scoped lists, detail, drafts with optimistic
  versioning (409), submit, cancel, assignment rules.
- Append-only audit events for authentication and administration actions with filtering/pagination.
- Web: `/login`, guarded dashboard route group, authenticated app shell, `/profile`,
  `/administration` (users, roles, scopes), `/audit`, role-driven navigation, real recent activity.
- Alembic migration `22f92c1d5602` and DEMO seed (6 users, scopes, categories, locations,
  assets, one inspection) gated to local/test environments.
- API tests for auth, rate limiting, rotation, logout, RBAC, scope isolation, inspection
  lifecycle, and audit records (9 new; 25 total API tests).

### Fixed
- Demo emails moved from the special-use `.local` domain to `@demo.railwayvision.example`
  (email validation rejected `.local`); existing rows migrated.
- Validation error responses no longer strip `value_error` details, so clients can show
  actionable messages without echoing input.
- Autogenerated migration imports and line lengths corrected; `ruff format` applied.

### Security
- Cross-scope resource access returns 404 to avoid existence disclosure.
- Self-protection rules prevent administrators from locking themselves out.
- Audit outcomes are recorded for failed logins without exposing whether the account exists.

### Known limitations
Refresh-token reuse detection, MFA, password reset, and CSRF tokens are not implemented.
DEMO accounts and data only. See `docs/KNOWN_LIMITATIONS.md` and `docs/PHASE_2_REPORT.md`.

## [0.1.0] — 2026-11-23 — Phase 1 foundation

### Added
- Monorepo layout: `apps/web` (Next.js 16 + TypeScript + Tailwind v4), `apps/mobile` (Flutter 3), `services/api` (FastAPI), `services/ai-worker` (Celery), `docs`, `infra`.
- FastAPI foundation: settings with environment guards, JSON logging with request IDs, security headers, JSON body limit, CORS allowlist, consistent error envelope, `/health/live`, `/health/ready`, `/api/v1/meta`, OpenAPI available outside production.
- PostgreSQL connection via SQLAlchemy async + Alembic baseline revision `0001_baseline` (applied locally).
- Celery worker on Redis with `system.ping` task, heartbeat key `rvai:worker:heartbeat`, container healthcheck.
- Next.js dashboard with live status panel, system-status page, role-aware navigation model, DEMO labeling, loading/error/retry/empty states, design tokens from `UI_UX_DESIGN.md`.
- Flutter app shell with live status, theme tokens, and honest planned-module screens.
- Docker Compose stack with six services, healthchecks, localhost-only ports, non-root/read-only API, worker, and web containers.
- GitHub Actions CI baseline, Makefile, `.env.example`, `.gitignore`, ADRs 0001–0004, repository audit and implementation plan.
- Test suites: API 16, worker 5, web 14, mobile 6 — all passing locally.

### Fixed
- Worker heartbeat was written to the Celery broker DB (1) while the API read DB 0; introduced `HEARTBEAT_REDIS_URL` shared with the API.
- Dashboard could not call the API from `127.0.0.1:3000`; added loopback origins to the explicit CORS allowlist.
- Replaced an unavailable MinIO image tag with `bitnamilegacy/minio:2025.7.23-debian-12-r5` for local development only.

### Known limitations
See `docs/KNOWN_LIMITATIONS.md`. Domain media, AI inference, findings, and work orders are not implemented yet.

## [Unreleased]
- Phase 7: findings, work orders, and notifications.
