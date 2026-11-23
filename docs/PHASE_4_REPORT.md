# Phase 4 Report — Media Evidence and Demo AI Pipeline

Date: 2026-11-23
Release: `0.4.0` (working tree; no git commit created)
Environment: local Docker Compose stack (`railwayvision`), PostgreSQL 16, Redis 7.4, MinIO 2025.7.23.

## 1. Summary

Phase 4 is complete for the local prototype scope. Inspection evidence now flows through a
real pipeline: the browser hashes an image (SHA-256), requests an upload intent, streams the
bytes to the API, and the API recomputes the digest, checks the declared size and the file
signature before writing the object to private MinIO storage. Mismatches are quarantined and
audited, never accepted as evidence. Reads (preview/download) are API-mediated and audited;
no presigned URLs are issued.

A clearly labelled **demo** pipeline exercises the rest of the path: a seeded
`demo-image-quality` model, a Celery queue, and an AI worker that computes deterministic
image-quality metrics. It is **not defect detection**, produces no severity or safe/unsafe
verdict, and makes no accuracy claim. No KCIC infrastructure was accessed; all data is
synthetic DEMO data.

Status: **passed locally**, with the limitations listed in §10.

## 2. Delivered scope

Data model and migration
- `media_objects`: filename, content type, byte size, claimed/verified SHA-256, status
  (`pending_upload` | `ready` | `quarantined`), quarantine reason, bucket/object key,
  inspection, scope, uploader, upload time.
- `ai_models`: code (unique), name, version, modality, description, `is_demo`, status.
- `ai_jobs`: status (`queued` | `running` | `succeeded` | `failed`), error code, JSON result,
  start/finish timestamps, inspection, media, model, requester.
- Alembic migration `3c1f8a7e9b20` (down revision `22f92c1d5602`) with indexes and downgrade.
- Seed registers the `demo-image-quality` model (version `0.1.0-demo`, `is_demo=true`) with a
  description that states it is not a defect detector.

Storage service
- Two private buckets: `railwayvision-media` and `railwayvision-quarantine`; created on first
  use. The API is the only reader/writer exposed to clients.
- Allowlist: JPEG, PNG, WebP. Magic-byte sniffing (`FF D8 FF`, PNG signature, `RIFF…WEBP`) is
  compared with the declared type; filenames are sanitized; SHA-256 is validated as 64
  lowercase hex characters.
- MinIO calls run off the event loop in worker threads; S3/network failures surface as
  `503 service_unavailable`.

Upload API (two-phase, API-mediated)
1. `POST /api/v1/inspections/{id}/media` stores the **claimed** digest with status
   `pending_upload` and audits `media.upload_requested`; oversize intents return `413`.
2. `PUT /api/v1/media/{id}/content` streams the body (64 KiB chunks), recomputes SHA-256, and
   checks, in order: size mismatch → content-type/signature mismatch → checksum mismatch.
   A failure writes the bytes to the quarantine bucket, marks the row `quarantined` with a
   reason, audits `media.quarantined` (outcome `failure`) and returns `422`.
   Success marks the row `ready`, records `uploaded_at`, audits `media.uploaded` with the
   verified digest, and returns the media record.

Read API
- `GET /api/v1/inspections/{id}/media` — scoped page of media metadata.
- `GET /api/v1/media/{id}/content` — inline or `?download=true`; `ready` objects only (else
  `409`); `Content-Disposition` with an RFC 5987 `filename*`; `Cache-Control: private,
  no-store`; **every read audits `media.downloaded`**.
- Cross-scope access returns `404`; the web UI hides controls only as presentation.

Demo AI pipeline
- `POST /api/v1/inspections/{id}/ai-jobs` (`ai:enqueue`): requires `ready` media belonging to
  the inspection; selects the first active demo model; rejects duplicate queued/running jobs;
  audits `ai.demo_job_queued`; enqueues `ai.demo_quality_check` on Celery. If the broker is
  unreachable the job is marked failed (`queue_unavailable`), audited, and the API returns
  `503`. In `APP_ENV=production` or with `DEMO_AI_ENABLED=false` the endpoint returns `409`.
- Worker (`ai.demo_quality_check`, `max_retries=0`): transitions `queued → running`, loads the
  object with its internal MinIO client, decodes it with Pillow, and stores a result:
  `kind=demo_image_quality`, `advisory=true`, explicit disclaimer, width/height, mean
  luminance, contrast (std dev), edge variance, quality flags (`low_light`, `low_contrast`,
  `possible_blur`, `low_resolution`), and the demo thresholds used. It audits
  `ai.demo_job_completed`; failures set `media_unavailable`, `storage_unavailable`,
  `unsupported_image`, or `analysis_failed` and audit `ai.demo_job_failed` as
  `system:ai-worker`. **No detections, severity, confidence, or accuracy are produced.**
- `GET /api/v1/inspections/{id}/ai-jobs` (`detections:read`) lists jobs for the inspection.
- Model registry: `GET /api/v1/models` (`models:manage` or `detections:read`) and
  `POST /api/v1/models` (`models:manage`, duplicate code `409`), audited `model.registered`.
  Only demo models are consumed by the demo worker; no artifact is downloaded or executed.
- Inspection detail now returns real `media_count` (ready objects) and `pending_detections`
  (queued/running jobs).

Web evidence panel (`/inspections/[id]`)
- Attach form for the assigned inspector or `inspections:manage` holders while the record is
  not completed/cancelled: client-side type/size checks, browser SHA-256, intent POST, XHR PUT
  with an accessible progress bar, and success/error notices.
- Media rows show filename, size, content type, uploader, time, status chip, and the
  server-verified SHA-256 (full digest in the tooltip). Quarantined rows show the reason and
  are not analysable or downloadable.
- Preview loads the image through an authorised, audited API read into a blob URL; download
  requests `?download=true`. Buttons carry text labels, never colour alone.
- "Run demo check" queues a job; the panel polls every 3 s while a job is queued/running and
  renders metrics and flags with the disclaimer and "fixed demo constants" note. The sidebar
  pending counter refreshes when the queue drains.
- Read-only roles (reviewer, auditor, AI/ML engineer for evidence) see media and results but
  no upload or run controls; permission-denied states are explicit.

Configuration and Compose
- API: `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY`,
  bucket names, `MEDIA_MAX_BYTES` (10 MiB default), `DEMO_AI_ENABLED`; onboarding waits for
  MinIO health. Non-local environments require MinIO credentials and reject a localhost
  endpoint.
- Worker: `DATABASE_URL`, MinIO endpoint/credentials; waits for MinIO health.
- Media request-body override: `PUT /api/v1/media/*/content` is bounded by
  `MEDIA_MAX_BYTES`; all other JSON bodies remain at the 1 MiB limit.

## 3. Database changes

Migration `3c1f8a7e9b20` — `media_objects`, `ai_models`, `ai_jobs`.

| Table | Key columns | Indexes / constraints |
|---|---|---|
| `media_objects` | `filename`, `content_type`, `size_bytes`, `sha256` (nullable until verified), `status`, `bucket`, `object_key` (unique), `quarantine_reason`, `uploaded_at`, FKs inspection/scope/uploader (RESTRICT) | `status`; unique `object_key` |
| `ai_models` | `code` (unique), `name`, `version`, `modality`, `description`, `is_demo`, `status` | unique `code` |
| `ai_jobs` | `status`, `error_code`, `result` (JSON), `started_at`, `finished_at`, FKs inspection/media/model/requester | `status`; FKs |

The seed adds one `ai_models` row (`demo-image-quality`, `is_demo=true`). No existing table was
altered destructively; the migration has a matching downgrade.

## 4. API changes

| Method & path | Permission | Behaviour |
|---|---|---|
| `POST /api/v1/inspections/{id}/media` | `media:upload` | `201` upload intent (`pending_upload`); `413` over the limit; `409` when the inspection is completed/cancelled; `403` unless owner or `inspections:manage` |
| `PUT /api/v1/media/{id}/content` | `media:upload` | Uploader or `inspections:manage`; `409` if not pending; `422` Content-Type mismatch, malformed image, size/checksum mismatch (quarantined); `503` storage outage |
| `GET /api/v1/inspections/{id}/media` | `media:read` | Scoped `Page[MediaOut]` |
| `GET /api/v1/media/{id}/content` | `media:read` | `200` bytes (`inline` or `attachment`), every read audited; `409` unless `ready`; `404` cross-scope |
| `POST /api/v1/inspections/{id}/ai-jobs` | `ai:enqueue` | `201` queued job; `409` demo disabled/media not ready/duplicate/no model; `503` queue unavailable (job marked failed) |
| `GET /api/v1/inspections/{id}/ai-jobs` | `detections:read` | Scoped `Page[AIJobOut]` |
| `GET /api/v1/models` | `models:manage` or `detections:read` | Model registry page |
| `POST /api/v1/models` | `models:manage` | `201`; duplicate code `409`; audit `model.registered` |

New audit actions: `media.upload_requested`, `media.uploaded`, `media.quarantined`,
`media.downloaded`, `ai.demo_job_queued`, `ai.demo_job_completed`, `ai.demo_job_failed`,
`model.registered`.

**Design decision:** no presigned URLs. Presigned links cannot be tied to the per-request
authorisation/audit model and would expose object keys directly. All reads are proxied by the
API so scope checks and read auditing stay server-side.

## 5. UI changes

- New `MediaPanel` on `/inspections/[id]` replacing the Phase 3 explanatory card, with upload,
  progress, preview, download, quarantine display, job history, and automatic polling.
- API client additions: `uploadMediaContent` (XHR with progress and structured errors) and
  `fetchMediaBlob` (authorised blob reads for preview/download); media/AI types.
- Shared helpers in `src/lib/media.ts` (status labels/tones, size formatting, digest
  shortening, quarantine/job error labels, active-job predicate) with unit tests.
- Copy updates across overview, inspections list/capture, asset detail, and the AI registry
  navigation entry (registry API is live; console UI deferred to Phase 6). No dead buttons were
  added; unavailable navigation entries remain disabled and labelled.

## 6. Verification performed

Automated:
- API: `ruff check .` clean; `pytest -q` → **41 passed** (9 new media API tests, 9 new adapter
  regression tests, plus existing suites).
- Worker: `ruff check .` clean; `pytest -q` → **8 passed** (3 new demo-analysis tests).
- Web: `eslint` clean; `tsc --noEmit` clean; `vitest` → **30 passed** (7 new media-helper
  tests); `next build` success; Docker image rebuilt.
- Mobile: `flutter analyze` clean; **6 passed** (unchanged this phase).
- `docker compose config -q` valid; all six services healthy; migration `3c1f8a7e9b20` applied;
  `/api/v1/meta` reports `0.4.0`.
- Total automated tests: **85 passed** (41 API, 8 worker, 30 web, 6 mobile).

Live API round-trip (script against the running stack):
- Inspector login → intent `201` (`pending_upload`) → `PUT` `200` status `ready` with matching
  server-computed SHA-256 → job `201` `queued` → worker transitioned to `succeeded`; result
  reported 800×600, mean luminance 127.6, contrast 47.7, edge variance 12708, no flags, with
  the disclaimer "not defect detection… no accuracy claim"; inspection counters returned
  `media_count=1`, `pending_detections=0`; content read returned identical bytes and digest.
- Scope/RBAC/quarantine paths are covered by API tests: auditor `403`, cross-scope `404`,
  non-owner upload `403`, wrong signature/size/header type and checksum mismatch quarantined,
  duplicate job `409`, queue outage marks the job failed.

Live browser verification (`http://127.0.0.1:3000`, DEMO accounts):
- Inspector: attached a 960×640 PNG through the UI (progress bar, SHA-256 computed in-browser),
  saw "Stored & verified" with the hash, previewed the blob (natural size 960×640), ran the
  demo check, and received a completed result with metrics, flags, and disclaimer.
- Sidebar pending counter initially stayed at 1 after completion; fixed by notifying the page
  when the jobs list drains (D-18), then re-verified → 0.
- Reviewer: the same record showed stored media, preview/download, and completed job details,
  but no upload form and no "Run demo check" (server permissions remain the control).
- Administrator: audit trail listed `media.upload_requested`, `media.uploaded`,
  `ai.demo_job_queued`, `ai.demo_job_completed`, and `media.downloaded` for the test media.
- Verification media/jobs/objects were deleted afterwards; the database returned to the seed
  state (0 media, 0 jobs, 1 demo model, inspection `DEMO-INS-0001` submitted).

Screenshots: still unavailable (`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`); evidence is
accessibility-tree snapshots and DOM assertions. Layout/responsive behaviour remains
unverified visually.

## 7. Security checks performed

- **No presigned URLs.** Object storage is private; every read goes through the API, which
  enforces scope (`404` outside scope), record state (`409` unless `ready`), and audits
  `media.downloaded`. Object keys are server-generated; clients never choose bucket/key.
- **Two-phase integrity.** The claimed digest is stored at intent time and compared with the
  recomputed digest during upload; size and magic-byte signature are also enforced. Mismatches
  go to a separate quarantine bucket, are marked non-downloadable/non-analysable, and are
  audit-recorded with a reason.
- **Upload bounds.** `MEDIA_MAX_BYTES` (10 MiB) is enforced at intent (`413`) and while
  streaming; only the media content PUT gets the larger body limit; JSON stays at 1 MiB.
  Filenames are sanitized; content type is allowlisted and re-checked against the bytes.
- **Queue safety.** Demo AI is disabled in production and can be disabled by configuration;
  errors mark the job failed rather than pretending success; duplicates are rejected.
- **Demo output labelling.** The worker result contains `advisory=true`, an explicit disclaimer,
  and demo thresholds flagged as "fixed demo constants, not KCIC-approved values". No
  detections, severity, confidence, or accuracy are produced or displayed.
- **Secrets/config.** MinIO credentials come from the environment; non-local environments
  require credentials and reject a localhost storage endpoint; Celery broker URLs follow the
  same pattern. Containers keep non-root/read-only hardening from Phase 1.
- **Dependency audit.** `pip-audit` (API requirements incl. `minio`, `celery`) → no known
  vulnerabilities; `npm audit --omit=dev` → 0 vulnerabilities.
- **Worker trust boundary.** The worker connects directly to PostgreSQL/MinIO with internal
  credentials (no public API), and only touches rows for queued jobs, with the disclaimers
  above. It never executes model artifacts.

## 8. Documentation updated

`docs/IMPLEMENTATION_STATUS.md`, `docs/CHANGELOG.md`, `docs/API_DOCUMENTATION.md`,
`docs/TEST_REPORT.md`, `docs/SECURITY_AUDIT_REPORT.md`, `docs/KNOWN_LIMITATIONS.md`,
and this report.

## 9. Blockers encountered

- Storage adapter passed `content_type` as a keyword to `anyio.to_thread.run_sync`, which
  accepts positional args only → uploads returned `500`. Fixed with `functools.partial`;
  covered by new adapter regression tests (D-16).
- Queue adapter passed `args=[job_id]` to `run_sync` instead of `send_task`, so every enqueue
  failed with `queue_unavailable`. Fixed the same way; the live job then completed (D-17).
- The verification script failed to initialise httpx because a malformed proxy environment
  variable was read by `trust_env`. Scripts now disable environment proxies; no product code
  changed.
- Sidebar pending counter was not refreshed when the worker finished (D-18), fixed in the
  panel's polling path.

No blocker requires a stakeholder decision to continue Phase 5.

## 10. Limitations (must not be overstated)

- **No real AI model, dataset, or evaluation.** The demo computes image-quality statistics only.
  There is no defect detection, no defect taxonomy, no severity, no confidence, and no accuracy
  or validation claim. Thresholds are demo constants, not KCIC-approved.
- Evidence storage is private but not hardened for production: no malware/AV scanning, no image
  re-encoding, EXIF/GPS metadata is retained, no virus quarantine workflow or purge UI, and no
  upload rate limiting.
- Uploads are limited to JPEG/PNG/WebP up to 10 MiB; no video, no multipart/resumable uploads,
  no client-side resizing. Browser SHA-256 requires a secure context (HTTPS or localhost).
- Media can be attached to non-terminal inspections including submitted records; there is no
  per-inspection media limit, ordering, captions, or deletion.
- Previews/downloads fetch the full object (no thumbnails or range requests) and each read adds
  an audit event; the audit list itself has no retention policy or tamper-evidence.
- Job execution has `max_retries=0`; failures require an explicit new run. Only one demo model
  is consumed (first active demo model); the registry has API access but no console UI.
- The demo AI endpoints are disabled in production by design; no deployment wiring for object
  storage, queue, or worker scaling has been validated outside local Compose.
- Not validated for safety inspection and not to be represented as a safety clearance tool.

## 11. Next phase

Phase 6 — human verification and review workflow: reviewer decisions on submitted inspections
and demo job results, a review-pending state, reviewer notes, and audit of every decision, all
server-enforced. Phase 5's authorized model/evaluation work remains blocked until a dataset,
model artifact, and evaluation protocol are approved. The demo AI output must continue to be
presented as advisory input; any accuracy or detection claim remains blocked.

## 12. Phase 4 gate

**Passed locally.** Media uploads are validated for size, signature, and SHA-256; accepted
objects are private and only reachable through audited, scope-checked API reads; mismatches are
quarantined; a clearly labelled demo pipeline runs end to end through Celery and the worker
without producing detections or accuracy claims. No claim is made about production readiness,
model validity, or KCIC validation.
