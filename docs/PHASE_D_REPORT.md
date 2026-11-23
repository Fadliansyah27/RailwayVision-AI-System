# Fase D Report — Operations Console and Synthetic-Data Reset

Date: 2026-11-23
Release: `0.8.0`
Scope: scoped AI job history, role-restricted API log viewer with secret redaction, manual
deployment records, honest backup status, and a guarded reset of synthetic data. The release
also removes the remaining `DEMO` wording from UI, seed data, tests, and worker naming, replacing
it with `SINTETIS` and `synthetic-*` identifiers. Phase 5 (authorized model, dataset, evaluation)
remains blocked; no detection, severity, confidence, or accuracy claim exists.

## 1. Summary

Fase D adds the platform-operations surface on top of the existing inspection workflow. A new
`/operations` page exposes five tabs, each backed by a real endpoint:

- **Riwayat job AI** — paginated AI jobs filtered by the caller's scope subtree.
- **Log API** — bounded in-process log buffer with level/search filters and redaction of
  passwords, bearer tokens, and signed URLs.
- **Deployment** — manual deployment records validated against the API's `APP_ENV`, written to
  the audit trail as `deployment.recorded`.
- **Backup** — status read from an administrator-configured status file; never infers health.
- **Reset data sintetis** — preview counts and a phrase-confirmed deletion limited to
  `SINTETIS-*` scopes, available only in `local`/`test` and audited as `synthetic_data.reset`.

Access is backend-enforced: `audit:read` opens the console; only `ops:manage` can record
deployments and run the reset. The console never claims a subsystem is healthy without evidence
from that subsystem.

## 2. Delivered scope

Backend (`services/api`):

- `GET /api/v1/ops/ai-jobs` with status filter, search, pagination, and scope-subtree filtering.
- `GET /api/v1/ops/logs` with level validation (`422` for unknown levels), search, and redaction
  of credential-like values before serialization.
- `GET/POST /api/v1/ops/deployments`; the server rejects an environment that differs from
  `APP_ENV` (`422`) and records the authenticated operator plus an audit event.
- `GET /api/v1/ops/backup` reporting `ok`, `stale`, `unavailable`, `invalid`, or
  `not_configured` from `BACKUP_STATUS_FILE`; checksum, size, and restore-test timestamps are
  passed through verbatim.
- `GET /api/v1/ops/synthetic-reset/preview` and `POST /api/v1/ops/synthetic-reset` requiring the
  exact phrase `HAPUS DATA SINTETIS`. Deletion is limited to transaction rows in `SINTETIS-*`
  scopes; accounts, scopes, categories, and checklist templates are kept. Storage cleanup runs
  best-effort after the database commit and is reported separately.

Web (`apps/web`):

- `/operations` with tabs, loading/empty/error states, and an access card for roles without
  `audit:read` or `ops:manage`.
- Operations navigation entry visible to supervisor, auditor, and administrator.
- Indonesian labels, `id-ID`/Asia-Jakarta timestamps, and the red `#C61F33` identity.

Naming and RBAC:

- `ops:manage` permission added; `seed_rbac` now reconciles existing roles so newly introduced
  permissions are granted on upgrade instead of requiring a database reset.
- Alembic `d1e2f3a4b5c6` relabels pre-existing rows (`DEMO` → `SINTETIS`, `@demo.` →
  `@sintetis.`, `demo-image-quality` → `synthetic-image-quality`, `demo_only` →
  `synthetic_only`, `[DEMO]` → `[SINTETIS]`) across scopes, users, assets, inspections, findings,
  work orders, notifications, models, jobs, and audit metadata.
- Worker modules renamed to `synthetic_ai.py` / `synthetic_jobs.py`; environment flags renamed to
  `SEED_SYNTHETIC_DATA`, `SEED_PASSWORD`, and `SYNTHETIC_AI_ENABLED`.

## 3. Database changes

Migration `d1e2f3a4b5c6` (down revision `c4d5e6f7a8b9`) performs data-only relabeling plus the
permission-name update. No schema is altered. A best-effort `downgrade()` restores the previous
tokens for local rollback; the production path is forward-only.

## 4. Permissions

- `ops:manage` (administrator only): deployment records and synthetic reset.
- `audit:read` (supervisor, auditor, administrator): operations console and logs.
- `detections:read` (inspector and above): AI job history endpoint, still scope-filtered.

The API resolves permissions from PostgreSQL on every request; the UI merely hides controls.

## 5. Verification

Automated (2026-11-23):

- API: `ruff check app tests alembic` clean; `pytest` **83 passed**, including new tests for
  console permissions, log redaction, scope-filtered job history, deployment operator/audit
  recording, backup status transitions, synthetic reset phrase/environment guards, and the
  `seed_rbac` permission-reconciliation regression.
- Worker: `ruff check` clean; `pytest` **8 passed**.
- Web: `tsc --noEmit` clean, ESLint clean, Vitest **39 passed / 5 files**, Docker `next build`
  success with `/operations` prerendered.
- Flutter: `flutter analyze` clean, **11 tests passed**; the live smoke test was skipped in this
  run because `SEED_PASSWORD` was not exported in the test shell (it passed in the previous
  run and is not claimed again here).

Live and browser (synthetic data only):

- Administrator login returned `scope = Sintetis — Jaringan ilustratif`, role `administrator`,
  and permissions including `ops:manage` and `audit:read` after the rebuilt container re-ran the
  seed. Role totals: administrator 23, supervisor 19, auditor 10, inspector 11, reviewer 11,
  AI engineer 9.
- The header shows `Sintetis — Jaringan ilustratif`; no `DEMO` text remains in any page body
  or chrome.
- `/operations` rendered all five tabs for the administrator:
  - AI job history loaded with filters and an empty-state message (no jobs existed at capture
    time).
  - Log viewer showed 46 of 500 buffered entries with timestamps, level, logger, message, and
    request context; the redaction note was present.
  - Deployment form defaulted to `local` (matching `APP_ENV`) and listed no records yet.
  - Backup reported `Belum dikonfigurasi` because `BACKUP_STATUS_FILE` is unset, with every
    value marked unavailable rather than healthy.
  - Reset preview listed 43 rows across inspections, reviews, checklist results, media, findings,
    work orders, and notifications for `SINTETIS-KCIC/NORTH/SOUTH`, with the confirmation phrase
    displayed. The reset was **not executed** during verification.
- Screenshots: `docs/screenshots/ops-console-ai-jobs.png`,
  `ops-console-logs.png`, `ops-console-deployments.png`, `ops-console-backup.png`,
  `ops-console-synthetic-reset.png`.

Migration and stack:

- API log on restart: `Running upgrade c4d5e6f7a8b9 -> d1e2f3a4b5c6`, followed by
  `synthetic_seed_completed`.
- `api`, `ai-worker`, `web`, `postgres`, `redis`, and `minio` all healthy; `/api/v1/meta`
  reports `0.8.0`.

## 6. Defects found and fixed

- D-25: `seed_rbac` only created roles when missing, so a permission introduced later
  (`ops:manage`) was never attached to the existing administrator role. Live login returned
  `ops:manage: False` while the UI expected it. Fixed by extending existing roles with missing
  permissions and updating permission names; regression test
  `test_seed_rbac_restores_missing_role_permissions` added.
- D-26: the web build still served pre-rename prose after the container image was rebuilt from a
  cached layer. Confirmed the Docker build context was unchanged and reloaded the browser; the
  new build reports 0.8.0 and contains no `DEMO` strings.
- D-27: a mechanical rename left awkward doubled prose on the dashboard
  ("Akun dan catatan sintetis bersifat sintetis"). Rewritten to state that the records are
  synthetic and labelled `SINTETIS`.
- D-28: full-page screenshots composed the sticky header in the middle of the page. Captures
  were taken with the header set to static for that page only; this affects screenshots, not the
  running UI.

## 7. Limitations and safety boundary

- The log viewer is a bounded in-process ring buffer; entries are lost on restart and it is not a
  substitute for infrastructure log aggregation. Redaction covers known credential patterns, not
  arbitrary sensitive text.
- Deployment history is manual and does not read the CI pipeline or infer deployment success.
- Backup status is only as truthful as the configured status file; the console never runs a
  backup or restore.
- The reset deletes synthetic-scope transaction rows only and is unavailable outside
  `local`/`test`. There is no schedule, dry-run restore, or storage verification beyond the
  reported best-effort cleanup.
- No e-mail/SMS/push transport, no per-media review, no KCIC validation, and no production
  readiness claim. No KCIC infrastructure was accessed.

## 8. Verdict

Fase D gate: **passed locally** for the implemented scope. Every tab calls the backend with
RBAC and scope enforcement, no status is fabricated, the reset is guarded by permission,
environment, and an exact confirmation phrase, and the synthetic naming is consistent across the
product surface.
