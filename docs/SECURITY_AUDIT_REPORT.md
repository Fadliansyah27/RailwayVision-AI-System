# Security Audit Report — 0.7.0

Date: 2026-11-23
Scope: 0.7.0 Phase 7 (findings from reviewed inspections, server-validated work-order
transitions, independent verification, derived finding status, and in-app notifications) plus
all Phase 1–6 surfaces (identity, RBAC, scopes, audit, assets, inspections, media evidence,
demo AI, human review, web proxy) and the 0.6.0 workflow/password-recovery/reference-data
additions.
This is not a production security certification. It covers implemented surfaces and explicitly
lists untested areas.

## 1. Method

- Manual review of Phase 1–6 code paths plus the 0.6.0 changes: inspection workflow transition
  sets, review start/reopen routes, three-way decisions, password-reset request/issue/confirm
  routes, user filters, asset/location/category writes, and the new web screens
  (`/forgot-password`, `/reset-password`, administration reset tab, user detail panel,
  `/assets/reference`).
- Phase 7 review of the findings routes (creation gated to `reviewed`/`inconclusive` inspections,
  version-checked edits, reject/reopen guards), work-order routes (transition sets, assignee
  resolution limited to the caller's subtree, self-verification rejection, derived finding
  status), the notification service (recipient resolution up the scope ancestry, per-user read
  state), and the new web screens (`/findings`, `/findings/[id]`, `/work-orders`,
  `/work-orders/[id]`, `/notifications`, inspection findings panel).
- Phase 4-specific review of the two-phase upload contract, quarantine path, object-key generation, read authorization/auditing, demo-AI production guard, and the browser evidence panel (blob previews, XHR upload, download).
- Phase 6 review of the review-decision route, state transitions, separation-of-duties guard, scope predicate, notes bounds, review-history exposure, audit writer, and the review panel (authorization to show the form, confirmation, error handling).
- Automated tests for media validation, quarantine, RBAC/scope denials, AI preconditions, queue failure handling, and adapter plumbing (`tests/test_media.py`, `tests/test_adapters.py`), worker analysis invariants (`test_demo_ai.py`), web helpers, review decisions (`tests/test_reviews.py`), the 0.6.0 workflow/reset/reference suite (`tests/test_phase23.py`), and the 0.7.0 findings/work-order/notification suite (`tests/test_phase7.py`; 64 API tests).
- Runtime verification against the local Docker stack and browser (inspector upload/preview/demo run, reviewer read-only view, administrator audit trail, `/health/ready`, `/api/v1/meta`), a 29-check live integration run covering scoped user creation, workflow transitions, media integrity, password reset, and audit, and a Phase 7 live lifecycle (reviewer finding → supervisor work order → assignee start/complete → independent verify → finding closed) with a browser pass over every new screen.
- Configuration review of secrets and guards (MinIO credentials, Celery URLs, `MEDIA_MAX_BYTES`, `DEMO_AI_ENABLED`, `PASSWORD_RESET_MINUTES`, non-local endpoint validation).
- Dependency audits: `pip-audit` for the API requirement set (now including `minio` and `celery`); `npm audit --omit=dev` for the web app. The dependency set did not change in 0.7.0.

## 2. Results summary

| Control | Status | Evidence |
|---|---|---|
| Password storage | Implemented | Argon2id via `argon2-cffi`; no plaintext or reversible storage |
| Access tokens | Implemented | HS256 JWT, 15-minute TTL, `sub`/`sid`/`type`/`exp`/`iat`; verified per request |
| Session state | Implemented | Server-side `auth_sessions` row per login; revoked/disabled sessions rejected immediately; expires checked |
| Refresh tokens | Implemented | 48-byte opaque token, SHA-256 digest at rest, rotation on every refresh, 7-day TTL |
| Logout | Implemented, tested | Session revoked server-side, cookie cleared; prior access token rejected on next request |
| Password change | Implemented | Requires current password; revokes all active sessions; cookie cleared |
| Login rate limiting | Implemented, tested | 5 failures per email digest per 300 s in Redis → `429`; fails open on Redis outage |
| RBAC | Implemented, tested | 6 roles, 22 permissions; permissions resolved per request from DB; backend-enforced on every route |
| Scope isolation | Implemented, tested | Path-prefix scope predicate on assets, inspections, users, locations, audit; cross-scope object access → `404` |
| Privilege escalation guards | Implemented, tested | Admin role permissions immutable; self-deactivation and self-demotion rejected; `/auth/me` cannot change roles/scope |
| Audit trail | Implemented, tested | Auth, user, role, scope, asset, inspection, media, AI job, model, and review-decision actions recorded with actor label, target, scope, request ID |
| Refresh cookie | Implemented | `HttpOnly`, `SameSite=Lax`, path `/api/v1/auth`, `Secure` in staging/production; not readable by JavaScript; first-party through the web proxy |
| Web→API transport | Implemented, verified | Next.js rewrites `/api/v1/*` and `/health/*` to the API; browser makes same-origin requests only, so the refresh cookie is first-party and CORS is used only by direct/native clients |
| Client authorization UX | Presentation only | New asset/inspection/media screens hide unauthorized actions, but every read/write is re-checked server-side; direct-URL inspector check confirms no data leak |
| Draft concurrency | Implemented, tested | `version` mismatch returns `409`; the UI requires an explicit reload instead of retrying blindly |
| Review authorization | Implemented, tested | `review:decide` on every decision; scope-scoped lookup; cross-scope `404`; non-submitted `409`; stale version `409` writes nothing |
| Review separation of duties | Implemented, tested | The assigned inspector cannot decide on their own record (`403`), even as supervisor |
| Review record integrity | Implemented | Decisions stored separately with reviewer, notes, and timestamp; status changes only via accept/return/inconclusive; decision history exposed newest-first; supervisor reopen is versioned and audited |
| Workflow transitions | Implemented, tested | Status transition sets live in `app/core/inspection_workflow.py`; invalid-state edits, submissions, cancels, reviews, and reopens return `409`; every transition increments `version` and writes audit |
| Reference-data writes | Implemented, tested | Category/location create and update require `assets:write`; new locations must sit inside the caller's scope subtree; every change is audited |
| Review auditability | Implemented, tested | Every decision writes `inspection.review_accepted`/`returned` with reference, decision, resulting status, and version; notes are not copied into audit metadata |
| Review semantics | Implemented | Labelled as record completeness only; no safety clearance, no AI approval, no detection or accuracy claim |
| Finding authorization | Implemented, tested | `findings:read`/`findings:write` enforced; creation only from `reviewed`/`inconclusive` inspections (`409` otherwise); scope-scoped lookup with cross-scope `404`; version-checked edits; reject blocked while active work orders exist; every change audited |
| Work-order transitions | Implemented, tested | Status transition sets in `app/api/routes/maintenance.py`; start/complete/verify/cancel return `409` outside the allowed state; stale `version` returns `409` and writes nothing; every transition increments version and writes audit |
| Work-order separation of duties | Implemented, tested | Verification requires `work_orders:verify` and rejects the assignee (`403`); assignee candidates must sit inside the caller's scope subtree (out-of-subtree assignee `404`) |
| Finding status derivation | Implemented, tested | Finding status is derived from active work orders; verification closes the finding only when no active work order remains; derived status never implies a condition verdict |
| Notification privacy | Implemented, tested | In-app notifications are per-user; recipients resolved up the scope ancestry by permission at event time; list/mark-read are caller-only; no delete; summaries count only the caller's unread rows |
| XSS on record fields | Mitigated | React text rendering/escaping; free text capped at 4,000 chars; no `dangerouslySetInnerHTML` in the new screens |
| Web token storage | Implemented | Access token held only in React state; no `localStorage`/`sessionStorage` persistence |
| Production configuration guards | Implemented, tested | Staging/production reject local DB/Redis, disabled HSTS, weak/default JWT secret, demo seeding, missing MinIO credentials, and a localhost storage endpoint |
| CORS | Implemented | Explicit allowlist; credentials enabled for listed origins; wildcard rejected |
| Security headers | Implemented, verified | nosniff, frame DENY, no-referrer, permissions policy, CSP `default-src 'none'`, no-store; HSTS enforced outside local |
| Request IDs | Implemented | Validated or regenerated; echoed; stored on audit events |
| Error handling | Implemented, tested | Consistent envelope; no stack traces; validation values omitted; cross-scope access not disclosed |
| Body-size limit | Implemented, tested | 1 MiB for JSON; `MEDIA_MAX_BYTES` (10 MiB) applies only to `PUT /api/v1/media/{id}/content`, enforced while streaming |
| Media storage privacy | Implemented | Private MinIO buckets; no presigned URLs or public objects; clients never choose bucket/key (server-generated keys) |
| Media upload validation | Implemented, tested | Declared size vs. received length, magic-byte signature vs. declared type, SHA-256 vs. intent claim, type allowlist, filename sanitization |
| Media quarantine | Implemented, tested | Mismatches stored in a separate bucket, marked `quarantined` with a reason, unreachable via content API (`409`), excluded from counts/analysis, audit outcome `failure` |
| Media read authorization | Implemented, tested | `media:read` + scope prefix; `404` cross-scope; only `ready` objects; every read audits `media.downloaded`; `private, no-store` |
| Demo AI guard | Implemented, tested | Disabled in production or via `DEMO_AI_ENABLED=false` (`409`); only demo models consumed; job failures recorded, never masked; outputs labelled advisory, no detections/severity/accuracy |
| Worker trust boundary | Implemented | Internal network only; drains queued jobs via database guard; storage credentials are service-level; no model artifacts downloaded or executed |
| Container hardening | Unchanged from Phase 1 | API/worker/web non-root, `read_only`, `cap_drop: ALL`, `no-new-privileges`; ports bound to 127.0.0.1 |
| Dependency vulnerabilities | None known | `pip-audit` (incl. `minio`, `celery`): no findings; `npm audit --omit=dev`: 0 vulnerabilities |
| CSRF protection | Partial | Refresh cookie is `SameSite=Lax` and path-limited; no anti-CSRF token; JSON APIs require `Authorization`, which blocks classic form CSRF on business routes; media PUT requires the bearer header and a matching pending intent |
| Password recovery | Implemented, tested | Non-enumerating request (`202`), admin-issued one-time token (SHA-256 digest at rest, 30-minute TTL, single use), confirm revokes all sessions; request list is scope-filtered |
| Reset-link delivery | Manual | No e-mail/SMS provider; administrators copy the link from the UI. Requests are not rate-limited and there is no expiry sweep |
| MFA | Not implemented | Single factor only; required before pilot with real accounts |
| Refresh-token reuse detection | Not implemented | Rotation invalidates the old token, but a replayed old token is not treated as a breach and does not revoke the session family |
| Malware scanning / image re-encoding | Not implemented | Uploaded bytes are validated but not scanned or decoded/re-encoded server-side; EXIF metadata (including GPS) is retained |
| Upload rate limiting / quota | Not implemented | No per-user upload throttle, concurrent-upload cap, or per-inspection media limit |
| Quarantine operations | Not implemented | No API/UI to list, inspect, release, or purge quarantined objects; retention is undefined |
| AI output integrity | Demo only | Deterministic image-quality heuristics with fixed, clearly labelled demo thresholds; no model artifact, accuracy claim, or safety output |
| Container image scanning / SBOM | Not performed | Phase 8/9 |
| Secret scanning of history | Not performed | No git commit exists yet |
| TLS termination | Not configured locally | HSTS off locally by design; deployment must terminate TLS |

## 3. Findings

No critical or high findings were identified in the implemented surface. The surface is authenticated, scope-filtered, upload-validated, and covered by denial tests.

Residual risks:
- **No malware/AV scanning or re-encoding (Medium if evidence is later shared beyond the platform):** uploads are validated for type, size, signature, and integrity, but stored bytes are served back as-is. Add antivirus/CDR and EXIF/GPS stripping before any pilot that accepts externally sourced files.
- **Upload abuse (Medium):** there is no per-user upload rate limit, concurrent-upload cap, or per-inspection media quota. An authorised uploader can consume storage up to operational limits.
- **Quarantine lifecycle (Low–Medium):** quarantined objects are isolated and unreachable but have no listing, release, or purge workflow; retention and incident handling for quarantined content are undefined.
- **CSRF (Medium if exposed beyond local):** cookie-based refresh relies on `SameSite=Lax` plus the path restriction rather than a synchronizer token. The same-origin proxy reduces credential exposure (the browser no longer sends the cookie across origins), but a same-site XSS or a future non-Lax cookie configuration would change the threat model. Add explicit CSRF tokens before any multi-origin deployment.
- **Refresh replay (Medium):** because tokens rotate without family tracking, a stolen refresh token that is used before the legitimate client refreshes will take over the session; subsequent legitimate refreshes fail closed with `401`, but no alert is raised. Add reuse detection and session-family revocation in a later phase.
- **No MFA (Medium):** single factor only. Password recovery now exists through
  administrator-issued one-time links, but delivery is manual (copy/paste); add e-mail,
  rate limiting, and an expiry sweep before real accounts.
- **Reset-link handling (Low–Medium):** the plaintext token is returned once to a
  `users:manage` holder and is a credential until used or expired (30 minutes, single use).
  Administrators must deliver it over an approved channel; the UI states this explicitly.
  Issued/expired requests are not listed by the web UI (API supports a `status` filter), and
  there is no notification when a token is used.
- **Login rate limit keyed by email digest (Low):** attackers can rotate emails to spray credentials; per-IP throttling and alerting are not implemented. Redis outage disables limiting by design (availability over lockout).
- **Administration breadth (Low):** any `users:manage` holder can edit roles except `administrator` and create scopes anywhere; there is no dual-control or change approval. Appropriate for a prototype, not for production governance.
- **Review governance (Low–Medium):** one authorized reviewer closes a record; any
  `inspections:manage` holder can reopen a reviewed or inconclusive record. There is no
  assignment queue, SLA, escalation, or dual-control.
- **Maintenance governance (Low–Medium):** one `work_orders:verify` holder confirms completion
  and a derived rollup may close the finding. There is no dual control, due-date/SLA
  enforcement, or escalation; self-verification is blocked, but a manager could reassign work
  to keep verification nominally independent. Finding severity and priority are provisional
  DEMO fields with no approved taxonomy.
- **Notification exposure (Low):** notification bodies summarize related records (references,
  titles, statuses) to recipients resolved by scope ancestry; anyone holding the relevant
  permission in an ancestor scope sees those summaries. Notification reads are not audited and
  notifications cannot be deleted or exported.
- **Reviewer note visibility (Low):** review notes are readable by every user with `inspections:read` in scope. Reviewers should not paste sensitive material; no redaction or field-level restriction exists.
- **Review notifications (Low):** there is no notification to the inspector when a record is returned or accepted; users must revisit the record.
- **OpenAPI exposure (Low):** `/docs` and `/openapi.json` remain enabled in `staging`; only `production` disables them.
- **Audit completeness (Low):** media reads are now audited, but other sensitive reads are not; audit storage has no tamper-evidence (append-only sink, hash chain) and no retention policy.
- **Demo credentials (Low, local only):** all demo accounts share a password from `.env`; seeding is blocked outside `local` by configuration guard.
- **MinIO and image scanning (carried over):** legacy community mirror for local development only; images pinned by tag, not digest, and not scanned.

## 4. Requirements mapped to SECURITY_AGENT.md (partial)

Implemented now: authentication, session revocation, refresh rotation, first-party refresh transport behind the web proxy, administrator-mediated password recovery with hashed one-time tokens and session revocation, RBAC and organizational scope enforcement, least-privilege denial behavior, optimistic concurrency on inspection drafts, review decisions, findings, and work orders, server-validated nine-status workflow including review start and reopen, separation of duties for review and work-order verification, audit trail for material actions (including every media read, every review decision, and every finding/work-order transition), secure password handling, login rate limiting, production configuration guards, secure error handling, headers, CORS allowlisting for direct clients, input size limits, private object storage, two-phase upload validation with quarantine, audit-recorded demo AI jobs, a non-safety review and maintenance workflow, per-user in-app notifications, and container hardening, dependency auditing.

Deferred with explicit phase ownership: MFA, e-mail/SMS reset delivery and reset-request rate limiting, CSRF tokens, refresh reuse detection, per-IP throttling and alerting, malware scanning and EXIF stripping, upload quotas/rate limits, quarantine operations (Phase 5+), dual-control maintenance governance, notification transport and retention, encryption-at-rest decisions and key management, export security (Phase 8), mobile secure storage (Phase 9), container scanning/SBOM, secret-history scanning, backup security, and incident-response procedures (Phase 10).

## 5. Verdict

0.7.0 security posture: **acceptable for local development and internal demonstration with synthetic data**. Findings can only be recorded on reviewed or inconclusive inspections, work orders follow server-validated transitions, assignees are limited to the caller's subtree, self-verification is rejected, stale versions write nothing, and notifications are per-user and scope-resolved. Workflow transitions and review decisions remain permission- and scope-checked; password recovery uses non-enumerating requests and hashed, single-use, time-limited tokens; every material action is audited. Evidence remains private and integrity-checked, and the demo AI pipeline remains labelled and advisory. Not approved for pilot, staging, or production use. No KCIC infrastructure was accessed or tested.
