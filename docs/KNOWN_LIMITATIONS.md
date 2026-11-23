# Known Limitations — RailwayVision AI (0.8.0)

This file is updated every phase. It reflects the working tree on 2026-11-23.

## Functional scope

- Authentication is local-credential only (email + password). Password recovery exists, but it
  is administrator-mediated: a user requests a reset from `/forgot-password`, an administrator
  verifies identity, issues a one-time link (30 minutes, single use), and delivers it manually.
  There is no e-mail/SMS provider, no reset-request rate limit, and no automatic expiry sweep.
  MFA and e-mail verification are not implemented, and there is no external KCIC identity
  provider.
- No refresh-token reuse detection or session/device management UI. Logout revokes the current
  session only; password change and password reset revoke all sessions.
- RBAC and organizational scope are enforced in the backend, but the role/permission matrix is
  the prototype's proposal, not an approved KCIC model. Administrators can edit role
  permissions (except the `administrator` role) and create scopes from the UI.
- Assets: scoped list with search/status/category/location filters and pagination, status
  summary counters, create, edit, detail with recent inspection history (latest 20), categories
  (create/rename), and locations (create/edit) on `/assets/reference`. No deletion or
  archiving, no asset QR codes (needs KCIC approval), no status-history timeline, no
  attachments, and asset updates are last-write-win (only inspections are version-checked).
- Inspections: nine statuses (`draft`, `submitted`, `ai_processing`, `ai_processed`,
  `under_review`, `reviewed`, `ai_failed`, `cancelled`, `inconclusive`) validated in the
  backend; list with status/owner filters and per-status summary; draft create/edit with
  optimistic `version` (409 + manual reload); inspection type and free-text location reference;
  submit, cancel, review start, accept/return/inconclusive decisions, and supervisor reopen;
  audit-backed history. Findings and corrective-action work orders now exist (below), but
  per-media or per-AI-result review, reviewer assignment/queue, and multi-stage approval do not.
- Inspection types (`routine`, `detailed`, `follow_up`, `emergency`) and the status model are
  provisional synthetic taxonomy pending KCIC approval. No defect taxonomy or severity model exists.
- Review decisions cover record completeness only. They are not safety clearances, do not
  approve AI output, and do not verify infrastructure condition. Reviewer notes are visible to
  any reader with `inspections:read` in the same scope. Reopening is a single-step action by
  an `inspections:manage` holder with no dual control.
- Findings: recorded only by `findings:write` holders on `reviewed` or `inconclusive`
  inspections; categories, severity, priorities, and the derived status model are provisional
  workflow rules, not KCIC maintenance procedures. No finding photos, defect taxonomy, or
  automated severity. A finding is scoped to its inspection/asset scope.
- Work orders: one assignee per work order, subtree-limited candidate list, and server-validated
  transitions (`open` → `in_progress` → `awaiting_verification` → `completed`, plus `cancel`).
  Completion or verification notes are required; self-verification is blocked. There are no
  due dates, overdue tracking, scheduling, cost/parts fields, attachments, or multi-assignee
  work. The derived finding status is a convenience rollup, not a condition assessment.
- Notifications are in-app only (no e-mail/SMS/push), per-user read state, and no deletion.
  Recipients are resolved up the scope ancestry by permission at event time; there is no
  subscription/opt-out model and no delivery retry outside the request.
- Media evidence is limited to JPEG/PNG/WebP up to 10 MiB (`MEDIA_MAX_BYTES`), with no video,
  resumable/multipart uploads, client-side resizing, thumbnails, or range requests. Browser
  SHA-256 requires a secure context (HTTPS or localhost).
- Evidence is private and API-mediated (no presigned URLs); every preview/download is an
  audited full-object read. There is no malware scanning, image re-encoding, EXIF/GPS stripping,
  media deletion, captions, per-inspection media limit, or quarantine list/release/purge
  workflow. Quarantine retention is undefined.
- The web app calls the API through a same-origin Next.js proxy; deployments must keep the
  proxy and refresh-cookie path consistent.
- The operational dashboard aggregates live counts and a six-month trend, and PDF/Excel exports
  exist, but there are no configurable date-range presets beyond the report page, no scheduled
  reports, and no warehouse/BI layer.
- Mobile app covers Fase B–C (login/session, inspections, checklist, capture, upload queue,
  work orders). There is no on-screen E2E automation, no physical-device verification, and the
  offline queue is memory-only on Flutter web.
- AI worker runs a clearly labelled synthetic image-quality heuristic
  (`synthetic-image-quality`) plus heartbeat. It produces no detections, severity, confidence,
  accuracy, or safety verdict; no real model, dataset, evaluation, or deployed artifact exists.
  Jobs have `max_retries=0` and require an explicit re-run after failure; synthetic endpoints are
  disabled in production.
- Operations console logs are a bounded in-process ring buffer lost on API restart; the console
  does not aggregate infrastructure logs. Deployment records are manual and do not read CI.
  Backup status is read from a configured status file and never runs a backup or restore. The
  synthetic reset is limited to `SINTETIS-*` scopes, local/test only, and there is no schedule
  or dry-run restore.
- MinIO stores media and quarantine objects with API-generated keys; there is no key rotation
  policy, object lifecycle/retention, versioning, or encryption-at-rest configuration
  documented for this build.
- No video processing pipeline.
- Audit trail is queryable but has no export, retention policy, tamper-evidence (hash
  chain/append-only sink), or read-access logging.

## Data and AI governance

- No authorized KCIC dataset or model exists; nothing is trained or evaluated. The synthetic AI
  output is image-quality statistics with fixed thresholds, not KCIC-approved values.
- No defect taxonomy, severity thresholds, inspection-type taxonomy, or safety rules are
  approved. All current taxonomies are provisional placeholders.
- AI confidence, when introduced, will be labeled as model confidence only — never as danger
  or safety.
- Seed data is synthetic and labeled SINTETIS in names/descriptions. Seed accounts use
  `@sintetis.railwayvision.example` and a shared password from `.env` (`SEED_PASSWORD`);
  seeding is blocked outside `local`.
- Assets and inspections created through the UI by a user are not forcibly prefixed SINTETIS;
  operators must not enter real KCIC records until governance approval. The UI warns against
  entering unapproved codes or coordinates.
- Three `integration.inspector.*` users and one integration inspection remain in the local
  database as test artifacts; they are synthetic data.

## Security and operations

- Local development only: HSTS disabled, TLS terminated nowhere, dev credentials in a
  gitignored `.env`.
- CSRF relies on `SameSite=Lax` plus a path-limited refresh cookie; no anti-CSRF token.
- Login rate limiting is per email digest (5 per 300 s) and fails open if Redis is unavailable;
  no per-IP throttling or alerting. Password-reset requests are not rate-limited.
- Reset links are plaintext credentials returned once to an administrator
  (`users:manage`). Administrators must deliver them over an approved channel. Issued and
  expired requests are not shown in the web UI (the API supports a `status` filter), and a
  used token produces no notification.
- Findings and work-order transitions are permission- and scope-checked in the backend, and
  self-verification is rejected, but there is no dual control, assignment queue, SLA, or
  escalation for corrective actions.
- Upload validation covers type/size/signature/SHA-256 and quarantine, but there is no malware
  scanning, upload rate limiting, storage quota, or EXIF stripping. Quarantine objects have no
  operator workflow.
- No dependency update automation, container image scanning, SBOM, or secret-history scan.
  Images are pinned by tag; MinIO comes from a legacy community mirror.
- No backup/restore drill, RPO/RTO agreement, monitoring stack (Prometheus/Grafana), or log
  aggregation.
- The CI workflow exists but has not run on a hosted runner. The repository is public on GitHub
  and pushes are manual.
- OpenAPI docs are disabled only in `production`; staging still exposes `/docs`.

## Verification gaps

- Report export is covered by API tests; the PDF/XLSX files were downloaded and inspected once
  in the browser. There are no automated assertions on PDF layout.
- Findings/work orders/notifications are covered by API tests and live/browser checks, but the
  work-order `409` version-conflict path was not exercised with two simultaneous browser
  sessions, and there is no load test for notification fan-out.
- Password reset was verified through API tests and a live 29-check integration run. In the
  browser, the pending request, link issuing, and reset form were verified; the final password
  change was executed through the API, not the browser form.
- No performance/load testing; list endpoints are paginated but indexes have not been profiled
  under volume.
- No end-to-end test on a mobile device or emulator; Flutter is verified by widget tests and
  analysis only.
- Browser verification used accessibility snapshots plus screenshots for the operations console
  and overview. Responsive layout at mobile/tablet widths and cross-browser rendering were not
  visually verified.
- The quarantine path is verified by API tests but was not exercised through the browser UI.
  The `409` upload-completion conflict and simultaneous cancel/upload race were not exercised
  with two sessions.
- The inspection `409` version-conflict UI path and the review-decisions `409` path are covered
  by API tests and code review, not with two simultaneous browser sessions.
- Review queue/assignment, return/accept notifications, dual-control, review SLAs, and
  multi-stage approval are not implemented.
- Bulk actions and scheduled report delivery are absent.
- PostGIS is provisioned but unused; location precision requirements remain unapproved.

## External blockers (require stakeholder decisions)

- Approved identity provider and KCIC role/scope model, including MFA and account recovery
  expectations.
- Approved asset master data, location hierarchy, inspection types/statuses, and asset status
  definitions.
- Authorized dataset/model artifacts and evaluation protocol.
- Production object-storage platform and supply-chain posture.
- Data classification, retention, backup, and incident-response requirements.
- Approval for QR-code labels and any physical marking on KCIC property.
- Formal approvals before any KCIC system or infrastructure interaction.
