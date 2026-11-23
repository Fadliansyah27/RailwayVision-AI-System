# API Documentation (current build)

Version: `0.7.0` (Phase 7: findings, work orders, notifications). Base path: `/api/v1` for business endpoints; health endpoints are unversioned.
Interactive OpenAPI: `/docs`, `/redoc`, `/openapi.json` — enabled when `APP_ENV` is `local`, `test`, or `staging`; disabled in `production`.

## Authentication and authorization

All business endpoints now require a bearer access token. The only public endpoints are `/health/live`, `/health/ready`, `/api/v1/meta`, `/api/v1/auth/login|refresh|logout`, and `/api/v1/auth/password-reset/request|confirm`.

### Token model (ADR-0002)

| Item | Value |
|---|---|
| Access token | HS256 JWT, 15-minute TTL, claims `sub` (user id), `sid` (session id), `type=access`, `exp`, `iat` |
| Refresh token | Opaque random token (48 bytes, URL-safe), 7-day TTL (configurable), stored server-side only as a SHA-256 digest |
| Rotation | Every successful `/auth/refresh` rotates the refresh token; the previous value is invalidated immediately |
| Web transport | Refresh token in an HttpOnly cookie `rv_refresh` (path `/api/v1/auth`, `SameSite=Lax`, `Secure` outside local) |
| Native transport | Send `X-Refresh-Transport: body` on `/auth/login` and `/auth/refresh`; the refresh token is returned in the JSON body and is not required as a cookie |
| Logout | Revokes the session server-side, clears the cookie, and the access token stops validating immediately (session check on every request) |

Passwords are hashed with Argon2id. Login is rate-limited per email digest: 5 failures per 300 seconds, then `429 rate_limited` (fail-open if Redis is unavailable).

### Web integration (same-origin proxy)

The browser never calls the API host directly. `apps/web/next.config.ts` rewrites
`/api/v1/:path*` and `/health/:path*` to `API_PROXY_TARGET` (`http://api:8000` in Compose,
`http://localhost:8000` by default), and `NEXT_PUBLIC_API_BASE_URL` defaults to empty so the
client uses relative URLs. This keeps the `rv_refresh` cookie first-party on any hostname
(`localhost`, `127.0.0.1`, or a deployment domain) and avoids cross-site cookie loss on
reload. CORS still applies to direct API clients and to the WebView/mobile transport, not
to the web app.

### RBAC and scope

Six roles: `administrator`, `inspector`, `reviewer` (Engineering Reviewer), `supervisor`, `ai_ml_engineer`, `auditor`; 22 permissions resolved on every request. Role/permission changes take effect on the next request (no re-login needed).

Each user belongs to one scope with a materialized path (e.g. `/demo-north`, child `/demo-north/km-001`). Reads are restricted to the user's scope and its descendants. Cross-scope object access returns **404**, not 403, so existence is not disclosed. Writes outside scope are rejected the same way.

| Permission | Grants |
|---|---|
| `assets:read` / `assets:write` | View / create and update assets, categories, locations |
| `inspections:read` / `inspections:write` / `inspections:submit` / `inspections:manage` | View / draft and edit / submit / cancel inspections |
| `media:upload` / `media:read` | Request upload intents and send bytes / list, preview, and download evidence |
| `ai:enqueue` / `detections:read` | Queue a demo analysis job / view demo job status and results |
| `review:decide` | Record an accept-or-return human review decision on submitted inspections |
| `findings:read` / `findings:write` | View findings / record findings on reviewed inspections, edit, reject, reopen |
| `work_orders:read` / `work_orders:write` / `work_orders:verify` | View work orders / create, edit, cancel, and manage them / verify completed work |
| `notifications:read` | Read and mark your own in-app notifications |
| `models:manage` | Register models; list the registry |
| `users:manage` | Users, roles, permissions, and scope creation |
| `audit:read` | Audit trail queries |

Report permissions exist in the catalogue but gate no endpoints yet (Phase 8).
Inspectors hold `work_orders:read` so they can see work assigned to them; they do not hold
`findings:read` or any work-order management permission.

Only the assigned inspector (or a holder of `inspections:manage`) may edit or submit a draft.
The assigned inspector may never record the review decision for their own inspection, even when
they hold `review:decide`.

## Endpoints

### Health

#### GET `/health/live`
Process liveness. Always returns `200` when the process can serve requests.

```json
{"status": "ok"}
```

#### GET `/health/ready`
Dependency readiness. Returns `200` when PostgreSQL and Redis are reachable; `503` otherwise. The AI worker heartbeat is informational only and does not gate readiness.

```json
{"status": "ok", "components": {"database": "ok", "redis": "ok", "worker": "ok"}}
```

`status` is `degraded` with HTTP `503` when a gating dependency fails. `worker` values: `ok`, `error` (missing/stale heartbeat or Redis failure).

### Meta

#### GET `/api/v1/meta`
Service identity and safety notice. Public, non-sensitive.

```json
{
  "name": "RailwayVision AI API",
  "version": "0.7.0",
  "environment": "local",
  "api_version": "v1",
  "ai_disclaimer": "AI-generated suggestions are advisory and preliminary. They must be verified by an authorized reviewer. This system does not declare any infrastructure safe or unsafe."
}
```

### Authentication

#### POST `/api/v1/auth/login`
Public. Body: `{"email": "...", "password": "..."}`. Returns `TokenResponse`; refresh token is set as cookie (or returned in body with `X-Refresh-Transport: body`).

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 900,
  "user": {
    "id": "<uuid>",
    "email": "inspector@demo.railwayvision.example",
    "full_name": "Demo Inspector",
    "is_active": true,
    "last_login_at": "2026-11-23T09:00:00Z",
    "scope": {"id": "<uuid>", "code": "DEMO-NORTH", "name": "North Corridor (DEMO)", "path": "/demo-north"},
    "roles": [{"id": "<uuid>", "code": "inspector", "name": "Inspector / Technician"}],
    "permissions": ["assets:read", "inspections:read", "inspections:write", "inspections:submit", "..."]
  },
  "refresh_token": null
}
```

Errors: `401 unauthorized` (invalid credentials or inactive user), `429 rate_limited`.

#### POST `/api/v1/auth/refresh`
Body `{}` (cookie transport) or `{"refresh_token": "..."}` (native). Rotates the refresh token and returns a fresh `TokenResponse`. Reuse of a previously rotated token returns `401`.

#### POST `/api/v1/auth/logout`
Optional body `{"refresh_token": "..."}`. Revokes the current session and clears the cookie. Always `204`, even if the token was already invalid.

#### GET `/api/v1/auth/me`
Returns the current `UserOut` (same shape as `user` above, including resolved permissions).

#### PATCH `/api/v1/auth/me`
Body `{"full_name": "..."}` (2–160 chars). Returns the updated `UserOut`. Audit event `auth.profile_updated`.

#### POST `/api/v1/auth/change-password`
Body `{"current_password": "...", "new_password": "..."}` (new password ≥ 10 chars, must differ). On success revokes **all** active sessions for the user, clears the cookie, returns `204`. The client must sign in again. Errors: `400 bad_request` for a wrong current password, `422 validation_error` for policy failures.

#### POST `/api/v1/auth/password-reset/request`
Public. Body `{"email": "..."}`. Always returns `202 {"status": "accepted"}` — including for
unknown or inactive addresses — so the endpoint cannot be used to enumerate accounts. For an
active account it creates (or reopens) a pending reset request and audits
`auth.password_reset_requested`. **No e-mail is sent**: an administrator issues the link.

#### POST `/api/v1/auth/password-reset/confirm`
Public. Body `{"token": "...", "new_password": "..."}` (password ≥ 10 chars). The token must be
`issued`, unused, and unexpired (30 minutes by default, `PASSWORD_RESET_MINUTES`). On success the
password is replaced, all active sessions are revoked, the request becomes `completed`, audit
`auth.password_reset_completed` is written, and the response is `204`. Errors: `400 bad_request`
for an invalid/expired/used token, `422 validation_error` for policy failures. Tokens are stored
only as SHA-256 digests.

### Assets

#### GET `/api/v1/asset-categories`
List asset categories (`id`, `code`, `name`). Requires `assets:read`.

#### POST `/api/v1/asset-categories`
Requires `assets:write`. Body `{"code": "SIGNAL", "name": "Signal structure"}`. `code` is
uppercased; duplicates return `409 conflict`. `201`; audit `asset_category.created`.

#### PATCH `/api/v1/asset-categories/{category_id}`
Requires `assets:write`. Body `{"name": "..."}`. Audit `asset_category.updated`.

#### GET `/api/v1/locations`
List locations in the caller's scope subtree (`id`, `code`, `name`, `scope_id`, `description`). Requires `assets:read`.

#### POST `/api/v1/locations`
Requires `assets:write`. Body `{"code", "name", "scope_id", "description"}`. The scope must be
inside the caller's subtree (`422` otherwise); duplicate codes return `409`. `201`; audit
`location.created`.

#### PATCH `/api/v1/locations/{location_id}`
Requires `assets:write`. Partial body with `name` and/or `description`. Cross-scope `404`.
Audit `location.updated`.

#### GET `/api/v1/assets`
Requires `assets:read`. Query: `page` (≥1), `page_size` (1–100, default 20), `search` (matches code or name, ≤120 chars), `status` (`active` | `out_of_service` | `retired`), `category_id`, `location_id`. Scoped; ordered by code.

```json
{
  "items": [
    {
      "id": "<uuid>",
      "code": "DEMO-AST-0001",
      "name": "DEMO Track Segment 01",
      "description": "Synthetic demonstration record. Not KCIC operational data.",
      "status": "active",
      "category": {"id": "<uuid>", "code": "TRACK", "name": "Track"},
      "location": {"id": "<uuid>", "code": "KM-001", "name": "DEMO KM 1", "scope_id": "<uuid>", "description": ""},
      "scope": {"id": "<uuid>", "code": "DEMO-NORTH", "name": "North Corridor (DEMO)", "path": "/demo-north"},
      "created_at": "2026-11-23T09:00:00Z",
      "updated_at": "2026-11-23T09:00:00Z"
    }
  ],
  "total": 3,
  "page": 1,
  "page_size": 20
}
```

#### POST `/api/v1/assets`
Requires `assets:write`. Body:

```json
{
  "code": "DEMO-AST-9001",
  "name": "DEMO Track Segment 99",
  "description": "Synthetic demonstration record.",
  "category_id": "<uuid>",
  "location_id": "<uuid> | null",
  "status": "active"
}
```

`code` is uppercased and must match `^[A-Z0-9][A-Z0-9_-]*$` (3–48 chars). A duplicate code returns `409 conflict`. Locations outside the caller's scope return `422 validation_error`. `201` on success; audit `asset.created`.

#### GET `/api/v1/assets/summary`
Requires `assets:read`. Returns `{"total", "active", "out_of_service", "retired"}` counters for
the caller's scope subtree. Used by the asset dashboard cards.

#### GET `/api/v1/assets/{asset_id}`
Requires `assets:read`. Returns the asset plus `inspections` (latest 20, newest first) and `latest_inspection` (or `null`). Cross-scope access returns `404`. Asset detail does not yet include media or findings.

#### PATCH `/api/v1/assets/{asset_id}`
Requires `assets:write`. Partial body with any of `name`, `description`, `category_id`, `location_id` (explicit `null` clears), `status`. Audit `asset.updated` lists changed fields. Note: asset updates do not use optimistic versioning yet.

### Inspections

#### GET `/api/v1/inspections`
Requires `inspections:read`. Query: `page`, `page_size` (1–100), `status` (one of the nine
statuses below), `asset_id`, `mine` (`true` limits to the caller's own inspections). Scoped;
newest `inspected_at` first.

Statuses: `draft`, `submitted`, `ai_processing`, `ai_processed`, `under_review`, `reviewed`,
`ai_failed`, `cancelled`, `inconclusive`.

```json
{
  "items": [
    {
      "id": "<uuid>",
      "reference": "INS-20261123-1A2B3C",
      "status": "draft",
      "inspection_type": "routine",
      "location_reference": "DEMO chainage marker 12+000 (synthetic)",
      "notes": "DEMO inspection note.",
      "inspected_at": "2026-11-23T09:10:00Z",
      "version": 1,
      "asset": {"id": "<uuid>", "code": "DEMO-AST-0001", "name": "DEMO Track Segment 01"},
      "inspector": {"id": "<uuid>", "full_name": "Demo Inspector"},
      "scope": {"id": "<uuid>", "code": "DEMO-NORTH", "name": "North Corridor (DEMO)", "path": "/demo-north"},
      "created_at": "2026-11-23T09:10:00Z",
      "updated_at": "2026-11-23T09:10:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

#### GET `/api/v1/inspections/summary`
Requires `inspections:read`. Returns `{"total": n, "counts": {<status>: n, ...}}` with all nine
status keys present (zero-filled) for the caller's scope subtree.

#### POST `/api/v1/inspections`
Requires `inspections:write`. Body
`{"asset_id": "<uuid>", "inspection_type": "routine", "location_reference": "...", "inspected_at": "ISO-8601 | null", "notes": "..."}`.
`inspection_type` is one of `routine`, `detailed`, `follow_up`, `emergency` (default
`routine`); `location_reference` ≤ 200 chars (free text — do not enter unapproved KCIC
coordinates); notes ≤ 4,000 chars; `inspected_at` defaults to now UTC, naive values are
treated as UTC. Creates a `draft` owned by the caller with a generated reference
`INS-YYYYMMDD-XXXXXX`. If an active checklist template exists for the inspection type, its
items are snapshotted into `inspection_checklist_results` in the same transaction. `201`;
audit `inspection.created` (metadata includes `checklist_items`).

#### GET `/api/v1/inspections/{inspection_id}`
Requires `inspections:read`. Returns `InspectionOut` plus `media_count` (media objects with status `ready`), `pending_detections` (AI jobs with status `queued` or `running`), `reviews` — the newest 20 human review decisions — and `checklist` (or `null`), containing template code/name/version, totals, and per-item `result`, `notes`, `recorded_by`, and `updated_at`.

#### PATCH `/api/v1/inspections/{inspection_id}`
Requires `inspections:write`. Only the assigned inspector (or `inspections:manage` holder) may edit, and only while `status == "draft"`. Body: optional `inspection_type`, `location_reference`, `notes`, `inspected_at`, and `version` for optimistic concurrency. If `version` is supplied and differs from the stored version, the API returns `409 conflict` ("modified by another session"). Changing `inspection_type` re-snapshots the checklist only when no answers exist; otherwise it returns `409 conflict`. A successful edit increments `version`; audit `inspection.updated`.

#### PATCH `/api/v1/inspections/{inspection_id}/checklist`
Requires `inspections:write` and draft ownership (or `inspections:manage`). Body:
`{"version": n, "entries": [{"item_code": "SURFACE", "result": "pass|fail|not_applicable|null", "notes": "..."}]}`.
Codes must belong to the inspection's snapshot (`422 unknown_checklist_item` otherwise);
one entry per code; notes ≤ 2,000 chars. A stale `version` returns `409`. The edit records
`recorded_by_id`, increments the inspection version, audits `inspection.checklist_updated`,
and returns the full inspection detail. If a legacy draft has no snapshot, the API attempts
to snapshot the currently active template; if none exists it returns `409 conflict`.

#### POST `/api/v1/inspections/{inspection_id}/submit`
Requires `inspections:submit`. Transitions `draft` → `submitted`, increments `version`, audit `inspection.submitted`. If any required checklist item is unanswered, returns `422 checklist_incomplete` and does not change status. Editing or submitting a non-draft inspection returns `409 conflict`; a non-owner without `inspections:manage` gets `403 forbidden`.

### Checklist master data

#### GET `/api/v1/master/checklist-templates`
Requires `inspections:read`. Query: `page`, `page_size` (1–100), `inspection_type`, `is_active`.
Returns templates with ordered items.

#### POST `/api/v1/master/checklist-templates`
Requires `inspections:manage`. Body:
`{"code": "ROUTINE-V1", "name": "...", "inspection_type": "routine", "is_active": true, "items": [{"code": "SURFACE", "label": "...", "position": 1, "is_required": true}]}`.
Codes are normalized to uppercase; item codes and positions must be unique. Activating a
template deactivates other active templates of the same inspection type. `201`; audit
`checklist_template.created`.

#### PATCH `/api/v1/master/checklist-templates/{template_id}`
Requires `inspections:manage`. Body: optional `name`, `is_active`. Activating deactivates
active peers for the same type. Templates are never hard-deleted, and edits never mutate
existing inspection snapshots. Audit `checklist_template.updated`.

#### POST `/api/v1/inspections/{inspection_id}/cancel`
Requires `inspections:manage`. Allowed from `draft`, `submitted`, `ai_processing`,
`ai_processed`, or `ai_failed`; `reviewed`, `inconclusive`, and `cancelled` return
`409 conflict`. Audit `inspection.cancelled`.

#### POST `/api/v1/inspections/{inspection_id}/review/start`
Requires `review:decide`. Transitions `submitted` or `ai_processed` → `under_review`,
increments `version`, and audits `inspection.review_started`. Any other status returns `409`;
the assigned inspector cannot start review on their own record (`403`); cross-scope IDs return
`404`. Returns the full inspection detail.

#### POST `/api/v1/inspections/{inspection_id}/reopen`
Requires `inspections:manage`. Transitions `reviewed` or `inconclusive` → `draft`, increments
`version`, and audits `inspection.reopened`. Other statuses return `409`. Used by supervisors
to return a closed record to the inspector.

#### POST `/api/v1/inspections/{inspection_id}/review`
Requires `review:decide` and scope access to the inspection. This records a human
record-completeness decision; it is not a safety clearance and does not approve AI output.

```json
{
  "decision": "accepted",
  "notes": "Record and evidence reviewed; complete.",
  "version": 4
}
```

- `accepted` → status `reviewed` (read-only). `returned` → status `draft`, reopening the
  record for the assigned inspector to revise and resubmit. `inconclusive` → status
  `inconclusive` (can be reopened by a supervisor).
- Decisions are allowed from `submitted`, `ai_processed`, or `under_review` (`409`
  otherwise). The assigned inspector cannot decide on their own record (`403`).
- `notes` is required, trimmed, and 5–2,000 characters. `version` is optional; a stale value
  returns `409` and writes nothing.
- Cross-scope IDs return `404`. Success returns the full inspection detail (including the new
  review and updated `version`).
- Audit: `inspection.review_accepted` or `inspection.review_returned` with decision, new
  status, and version. Reviewer notes are stored on the review row, not in audit metadata.

### Media evidence

Uploads are two-phase and **API-mediated: no presigned URLs are issued**. Objects live in
private buckets; clients never see bucket names or object keys, and every content read is
scope-checked and audited.

#### POST `/api/v1/inspections/{inspection_id}/media`
Requires `media:upload`; the caller must be the assigned inspector or hold
`inspections:manage`, and the inspection must not be terminal (`reviewed`, `cancelled`, or
`inconclusive`). Body:

```json
{
  "filename": "track-joint.png",
  "content_type": "image/png",
  "size_bytes": 204800,
  "sha256": "<64 lowercase hex characters>"
}
```

Allowed `content_type`: `image/jpeg`, `image/png`, `image/webp`. Returns `201` with a media
record in status `pending_upload` (the claimed `sha256` is stored for later comparison).
Errors: `413 payload_too_large` above `MEDIA_MAX_BYTES` (default 10 MiB), `409 conflict` for a
closed inspection, `403 forbidden` for a non-owner without `inspections:manage`. Audit
`media.upload_requested`.

#### PUT `/api/v1/media/{media_id}/content`
Requires `media:upload`; only the uploader or an `inspections:manage` holder may complete it.
Send the raw image bytes with `Content-Type` equal to the intent's type. The API streams the
body (bounded by `MEDIA_MAX_BYTES`), then verifies **size**, **file signature**, and
**SHA-256**. On success the object is written to the private media bucket, the row becomes
`ready`, and `media.uploaded` is audited with the verified digest.

On mismatch the bytes go to the quarantine bucket and the row becomes `quarantined` with a
reason; the response is `422 validation_error` (`Upload rejected: size_mismatch`,
`content_type_mismatch`, or `checksum_mismatch`) and `media.quarantined` is audited with
outcome `failure`. Other errors: `409 conflict` if the upload already completed (or the media
is not `pending_upload`), `503 service_unavailable` if storage is down, `404` outside scope.

#### GET `/api/v1/inspections/{inspection_id}/media`
Requires `media:read`. Scoped page (`page`, `page_size` 1–100, newest first) of media
metadata: `id`, `inspection_id`, `filename`, `content_type`, `size_bytes`, `sha256`, `status`,
`quarantine_reason`, `uploaded_by`, `uploaded_at`, `created_at`.

#### GET `/api/v1/media/{media_id}/content`
Requires `media:read`. Returns the object bytes (`inline` by default) with
`Content-Disposition` (RFC 5987 `filename*`) and `Cache-Control: private, no-store`. Add
`?download=true` for `attachment`. Only `ready` objects are served (`409 conflict`
otherwise; quarantined objects are intentionally unreachable). **Every read audits
`media.downloaded`.** Cross-scope access returns `404`.

### Demo AI pipeline and model registry

The demo pipeline exercises queueing and worker plumbing. Its output is image-quality
statistics only: **no detections, severity, confidence, or accuracy** are produced, and the
result carries an explicit "not defect detection, no accuracy claim" disclaimer.

#### POST `/api/v1/inspections/{inspection_id}/ai-jobs`
Requires `ai:enqueue`. Body `{"media_id": "<uuid>"}` where the media belongs to the inspection
and is `ready`; the inspection must be `submitted`, `ai_processed`, or `ai_failed`. Returns
`201` with the queued job (status `queued`). Runs the first active
`is_demo` model. Errors: `409 conflict` when the demo pipeline is disabled
(`DEMO_AI_ENABLED=false` or `APP_ENV=production`), the media is not ready, a queued/running
job already exists for the media+model, or no demo model is registered; `404` if the media is
not on this inspection; `503` if the broker is unreachable (the job is marked `failed` with
`queue_unavailable` and `ai.demo_job_failed` audited). Audits `ai.demo_job_queued`.

#### GET `/api/v1/inspections/{inspection_id}/ai-jobs`
Requires `detections:read`. Scoped page of jobs: `id`, `inspection_id`, `media_id`, `status`
(`queued` | `running` | `succeeded` | `failed`), `error_code` (`queue_unavailable`,
`media_unavailable`, `storage_unavailable`, `unsupported_image`, `analysis_failed`), `result`,
`model`, `requested_by`, `created_at`, `started_at`, `finished_at`.

A successful `result` looks like:

```json
{
  "kind": "demo_image_quality",
  "advisory": true,
  "disclaimer": "Demo image-quality heuristics only. This is not defect detection, has no accuracy claim, and must not be used for safety or maintenance decisions.",
  "metrics": {"width": 800, "height": 600, "mean_luminance": 127.6, "contrast_stddev": 47.7, "edge_variance": 12708.0},
  "quality_flags": ["low_light", "possible_blur"],
  "thresholds": {"low_light_mean": 60.0, "low_contrast_stddev": 18.0, "possible_blur_edge_variance": 120.0, "low_resolution_width": 640},
  "note": "Thresholds are fixed demo constants, not KCIC-approved values."
}
```

#### GET `/api/v1/models`
Requires `models:manage` or `detections:read`. Returns the registry page (`code`, `name`,
`version`, `modality`, `description`, `is_demo`, `status`, `created_at`).

#### POST `/api/v1/models`
Requires `models:manage`. Body `{"code", "name", "version", "modality": "image", "description",
"is_demo"}`; `code` matches `^[A-Za-z0-9][A-Za-z0-9._-]*$`. `201` on success, `409 conflict`
for a duplicate code. Audit `model.registered`. Registering a model does not download or
execute any artifact; only demo models are consumed by the demo worker.

### Findings, work orders, notifications

Findings record a human-verified observation from a reviewed or inconclusive inspection. Work
orders track corrective action, and notifications deliver in-app workflow events. These are
record-tracking features only: they do not declare infrastructure safe or unsafe, and the
status rules are provisional DEMO rules (`app/core/maintenance_workflow.py`), not KCIC
maintenance procedures. References are human-readable `FND-YYYYMMDD-XXXXXX` and
`WO-YYYYMMDD-XXXXXX`.

#### Findings

| Method & path | Notes |
|---|---|
| GET `/api/v1/findings` | Requires `findings:read`. Query `status`, `priority`, `asset_id`, `inspection_id`, `mine`, `search` (reference/title), `page`, `page_size`; newest first |
| GET `/api/v1/findings/summary` | Per-status counts within scope |
| POST `/api/v1/findings` | Requires `findings:write`. Body `inspection_id`, `title` (3–200), `description` (10–4,000), `priority` (`low`/`medium`/`high`). The inspection must be `reviewed` or `inconclusive`, otherwise `409`. The finding inherits the inspection's scope and asset. Notifies `work_orders:write` holders in the scope ancestry. Audit `finding.created` |
| GET `/api/v1/findings/{id}` | `404` outside scope. Detail includes the linked work orders |
| PATCH `/api/v1/findings/{id}` | Only while `confirmed` (`409` otherwise). Body `title`, `description`, `priority`, `version`; stale version → `409`. Audit `finding.updated` |
| POST `/api/v1/findings/{id}/reject` | Only while `confirmed` and with no active work order (`409`). Body `notes` (5–2,000). Sets `rejected` and notifies the creator. Audit `finding.rejected` |
| POST `/api/v1/findings/{id}/reopen` | `closed`/`rejected` → `confirmed`, clears `closed_at`, notifies the creator. Audit `finding.reopened` |

Finding statuses: `confirmed`, `assigned`, `in_progress`, `awaiting_verification`, `closed`,
`rejected`. After creation a finding is `confirmed`; later statuses are derived on the server
from its active work orders and cannot be set directly.

#### Work orders

| Method & path | Notes |
|---|---|
| GET `/api/v1/work-orders` | Requires `work_orders:read`. Query `status`, `finding_id`, `assignee_id`, `mine`, `search`, `page`, `page_size` |
| GET `/api/v1/work-orders/summary` | Per-status counts within scope |
| GET `/api/v1/work-orders/assignees` | Requires `work_orders:write`. Active users at or below the caller's scope whose roles grant `work_orders:read` |
| POST `/api/v1/work-orders` | Requires `work_orders:write`. Body `finding_id`, `title` (3–200), `instructions` (≤4,000), `assignee_id`. Closed/rejected findings → `409`; an assignee outside the caller's scope or the finding's scope subtree → `404`. Notifies the assignee. Audit `work_order.created` |
| GET `/api/v1/work-orders/{id}` | `404` outside scope |
| PATCH `/api/v1/work-orders/{id}` | Open/in-progress only. Body `title`, `instructions`, `assignee_id`, optional `version`; reassignment notifies the new assignee. Audit `work_order.updated` |
| POST `/api/v1/work-orders/{id}/start` | Assignee or `work_orders:write` holder. `open` → `in_progress`. Audit `work_order.started` |
| POST `/api/v1/work-orders/{id}/complete` | Assignee or manager. `open`/`in_progress` → `awaiting_verification`; body `notes` (5–2,000) stored as completion notes. Notifies `work_orders:verify` holders in the scope ancestry. Audit `work_order.completed` |
| POST `/api/v1/work-orders/{id}/verify` | Requires `work_orders:verify`. `awaiting_verification` → `completed`; otherwise `409`. The assignee cannot self-verify unless they also hold `work_orders:write` (`403`). When no active work order remains, the finding becomes `closed` with `closed_at`. Notifies the assignee and the finding creator. Audit `work_order.verified` |
| POST `/api/v1/work-orders/{id}/cancel` | Requires `work_orders:write`. `open`/`in_progress` → `cancelled`; body `notes` (5–2,000). The finding status is recomputed. Audit `work_order.cancelled` |

Work-order statuses: `open`, `in_progress`, `awaiting_verification`, `completed`, `cancelled`.
Derived finding status: any active work order `in_progress` → `in_progress`; else any `open` →
`assigned`; else any `awaiting_verification` → `awaiting_verification`; no active work order →
`confirmed`. `closed` and `rejected` findings are never recomputed.

#### Notifications

| Method & path | Notes |
|---|---|
| GET `/api/v1/notifications` | Requires `notifications:read`. Returns only the caller's notifications; query `unread_only`, `page`, `page_size` |
| GET `/api/v1/notifications/summary` | `{"unread": <count>}` for the caller |
| POST `/api/v1/notifications/read-all` | Marks all of the caller's notifications as read |
| POST `/api/v1/notifications/{id}/read` | Marks one notification read; `404` when it belongs to another user |

Kinds: `finding.created`, `work_order.assigned`, `work_order.reassigned`,
`work_order.awaiting_verification`, `work_order.verified`. Notification reads are not audited;
there is no delete endpoint (append-only retention) and no e-mail or SMS transport.

### Administration

All administration endpoints require `users:manage` except scope listing (`assets:read`). User administration is filtered to the caller's scope subtree; a user outside it returns `404`.

| Method & path | Notes |
|---|---|
| GET `/api/v1/users` | Query `page`, `page_size`, `search`, `scope_id`, `role_code`, `is_active`; returns `UserAdminOut` page (no permissions list) |
| POST `/api/v1/users` | Body `email`, `full_name`, `password` (≥10), `scope_id`, `role_codes` (≥1), `is_active`; duplicate email → `409`; unknown role/scope → `422`/`404` |
| GET `/api/v1/users/{user_id}` | `404` outside scope |
| PATCH `/api/v1/users/{user_id}` | `full_name`, `is_active`, `scope_id`, `role_codes`; removing your own `administrator` role or deactivating yourself → `409`; deactivation revokes the target's sessions |
| POST `/api/v1/users/{user_id}/deactivate` | Revokes active sessions; self-deactivation → `409` |
| GET `/api/v1/roles` | Role list with nested permissions |
| PATCH `/api/v1/roles/{role_id}/permissions` | Body `{"permission_codes": [...]}` (≥1); the `administrator` role is fixed → `409` |
| GET `/api/v1/permissions` | Flat permission catalogue |
| GET `/api/v1/scopes` | Scopes within the caller's subtree (requires `assets:read`) |
| POST `/api/v1/scopes` | Body `code`, `name`, optional `parent_id`; code matches `^[A-Za-z0-9][A-Za-z0-9_-]*$`, is uppercased, and its path is `/<parent path>/<code lowered>`; duplicates → `409` |
| GET `/api/v1/password-reset-requests` | Query `status` (default `pending`, max 100 rows); scoped request list with `email`, `full_name`, `requested_at`, `token_expires_at` |
| POST `/api/v1/users/{user_id}/password-reset-token` | Issues a one-time token for the latest `pending`/`issued` request; returns `{"token", "expires_at"}`; `409` if no open request; audit `auth.password_reset_issued` |

Role, user, and scope changes are audit-recorded; unknown permission codes return `422 validation_error`.

### Audit

#### GET `/api/v1/audit-events`
Requires `audit:read`. Query: `page`, `page_size` (1–100, default 25), `action` (exact match, e.g. `inspection.submitted`), `target_type`, `target_id`. Includes global events (`scope_id = null`, e.g. authentication) and events within the caller's scope subtree, newest first.

```json
{
  "items": [
    {
      "id": "<uuid>",
      "action": "inspection.submitted",
      "actor_label": "Demo Inspector <inspector@demo.railwayvision.example>",
      "target_type": "inspection",
      "target_id": "<uuid>",
      "scope_id": "<uuid> | null",
      "outcome": "success",
      "request_id": "...",
      "event_metadata": {"reference": "INS-20261123-1A2B3C"},
      "created_at": "2026-11-23T09:15:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 25
}
```

## Conventions

- Timestamps are UTC ISO 8601.
- IDs are UUIDs; inspection references are human-readable `INS-YYYYMMDD-XXXXXX`.
- Errors use a single envelope; stack traces and internal details are never returned:

```json
{"error": {"code": "not_found", "message": "Resource not found.", "request_id": "..."}}
```

Mapped statuses: 400, 401, 403, 404, 405, 409, 413, 422, 429, 503, 500. Validation errors omit rejected input values. `409 conflict` covers duplicate codes, non-draft edits, and optimistic-lock mismatches.

## Request headers

| Header | Behavior |
|---|---|
| `Authorization` | `Bearer <access token>` on all protected endpoints. Missing/invalid/revoked tokens return `401`. |
| `X-Request-ID` | Optional; accepted pattern `[A-Za-z0-9._-]{8,64}`. Invalid values are replaced. Echoed in the response and stored on audit events. |
| `X-Refresh-Transport` | `body` on `/auth/login` and `/auth/refresh` to receive the refresh token in JSON instead of a cookie (native clients). Default is cookie transport. |
| `Content-Type` | `application/json` for JSON bodies; for `PUT /api/v1/media/{id}/content`, the exact image type from the upload intent (`image/jpeg`, `image/png`, or `image/webp`). |
| `Origin` | Must match the configured CORS allowlist (localhost/127.0.0.1:3000/3001 by default). `credentials: "include"` is required for cookie-based refresh. |

## Response headers (all responses)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
- `Cache-Control: no-store`
- `Strict-Transport-Security` only when `ENABLE_HSTS=true` (enforced in staging/production)

## Limits

- JSON body limit: `MAX_JSON_BODY_BYTES` (default 1 MiB); larger requests receive `413`.
- Media content upload: `MEDIA_MAX_BYTES` (default 10 MiB); enforced at intent creation and
  while streaming the `PUT` body. No resumable or multipart uploads.
- Login limit: 5 failures per email digest per 300 seconds (`429 rate_limited`).
- Password reset: token TTL 30 minutes (`PASSWORD_RESET_MINUTES`), single use; reset requests
  are not rate-limited and there is no automatic expiry sweep.
- Reviewer notes: 5–2,000 characters; inspection notes 4,000 characters; location reference
  200 characters; finding title 200 / description 4,000; work-order title 200 / instructions
  4,000; decision and transition notes 2,000.
- Pagination: `page_size` capped at 100 on all list endpoints.
- No per-endpoint request throttling or upload rate limiting yet.

## Not yet available

Review assignment/queue, due dates and overdue tracking (Phase 7 follow-up), reports/exports
(Phase 8), mobile capture upload (Phase 9). Authorized AI model evaluation (Phase 5) is blocked
pending an approved dataset and model. E-mail delivery of password-reset links and
notifications is not implemented; administrators copy the one-time link from the administration
UI. Do not build clients against endpoints not listed above.
