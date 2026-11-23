# Implementation Plan — RailwayVision AI

Version 1.0 — 2026-11-23. Derived from BRD, AGENT.md, SECURITY_AGENT.md, ARCHITECTURE.md, PRODUCT_REQUIREMENTS.md, API_SPECIFICATION.md, TEST_PLAN.md, MASTER_PROMPT.md.

## 1. Target architecture

```
Browser (Next.js) ─┐
                   ├─ HTTPS/REST ─► FastAPI (stateless, RBAC + scope) ─► PostgreSQL
Flutter mobile ────┘                       │
                                            ├─► Private object storage (MinIO local / S3 API)
                                            ├─► Redis (queue, cache, rate limits)
                                            ├─► Audit events (append-only table)
                                            └─► Celery AI worker (isolated) ─► YOLO/OpenCV
                                                                                 └─► detections, annotated derivatives
```

Monorepo layout:

```
apps/web            Next.js 16 + TypeScript + Tailwind
apps/mobile         Flutter (Android/iOS/web targets)
services/api        FastAPI + SQLAlchemy + Alembic
services/ai-worker  Celery worker + Ultralytics YOLO + OpenCV
infra               Dockerfiles, helper scripts
docs                Audit, plan, ADRs, phase reports
docker-compose.yml  Local full stack
```

## 2. Phase plan and acceptance gates

Each phase is only marked complete when its gate is verified by executed commands, not by writing code.

### Phase 0 — Repository audit & requirements validation (this session)
Deliverables: `docs/REPOSITORY_AUDIT.md`, this plan, ADRs 0001–0004, updated open-questions log.
Gate: documentation reviewed against all source docs; assumptions listed; no unresolved conflict blocking Phase 1.

### Phase 1 — Project foundation (this session)
Deliverables:
- Monorepo structure, git baseline, `.gitignore`, `.env.example`.
- Docker Compose: postgres, redis, minio, api, ai-worker, web (healthchecks, non-root, pinned tags).
- FastAPI foundation: settings, structured JSON logging with request IDs, security headers, consistent error envelope, DB/Redis connectivity, OpenAPI, health endpoints (`/health/live`, `/health/ready`), meta endpoint.
- AI worker foundation: Celery app on Redis, heartbeat, healthcheck, no inference yet.
- Web foundation: design tokens from UI_UX_DESIGN, app shell with role-aware navigation model, live System Status page bound to the real API, honest empty states, responsive layout.
- Flutter foundation: theme, environment config, navigation shell, security/data notice, no fake features.
- CI baseline (GitHub Actions), Makefile, lint/format configs, tests.

Gate (must be executed):
- `docker compose up -d` → all services healthy.
- `curl /health/live` → 200; `/health/ready` reports db+redis ok.
- `pytest` green; `npm run lint` + `npm run build` green; `flutter analyze` + `flutter test` green.
- Web System Status page shows live backend + database + redis health (screenshot captured).

### Phase 2 — Backend & database: auth, RBAC, assets, inspections
- Migrations: scopes, users, roles, permissions, user_roles, locations, assets, inspections, audit_events.
- Local auth adapter behind IdP abstraction: Argon2 password hashing, JWT access tokens (short-lived) + rotating refresh tokens, logout/revocation, login rate limiting, disabled-user rejection.
- RBAC + scope enforcement dependency; `/me`; user/role/scope administration; asset & location CRUD with scope filtering.
- Inspection lifecycle (create, draft edit, notes, examiner, timestamps, server-enforced status transitions) without media processing yet.
- Idempotency-Key support; error codes; permission matrix tests; IDOR/scope tests; audit events for auth and admin actions.
Gate: auth/RBAC/scope tests green; unauthorized and cross-scope requests blocked with non-disclosing errors; migrations up/down verified; audit events verified.

### Phase 3 — Secure media management
- Inspection media upload session → quarantine bucket → validation (MIME+signature, size, extension) → SHA-256 integrity → presigned download only after authorization.
- Media metadata table; no public URLs; EXIF/GPS stripping on derivatives; audit for upload/download/export.
Gate: upload validation tests (bad MIME/signature/oversize/traversal), signed URL expiry tests, IDOR tests, inspection-media workflow tests.

### Phase 4 — AI inference pipeline
- Celery tasks: enqueue inference once per media/model (idempotent), retries with backoff, dead-letter/failure states, timeouts.
- Model registry with checksum verification; seed one demo YOLO model clearly labeled illustrative; OpenCV-derived annotation image; detections persisted with metadata; AI job status endpoint.
- Worker resource limits and no privileged network access.
Gate: end-to-end job on demo image; duplicate retry produces no duplicate detections; forced failure surfaces `AI Failed` without implying "no defect"; model checksum mismatch is rejected.

### Phase 5 — Web dashboard, viewer, review UI
- Real API-connected dashboard KPIs (AI suggestions vs verified findings separated), inspection list/detail with filters, original vs annotated viewer with overlay toggle, review actions, findings, work orders, reports, audit and admin screens.
- Loading/empty/error/retry states everywhere; accessible components; AI disclaimer persistent.
Gate: E2E demo flow through UI; screenshots; accessibility basics (keyboard, labels, contrast).

### Phase 6 — Flutter mobile
- Sign-in with secure token storage, assigned inspections, asset selection, camera/gallery capture, draft persistence, upload with retry, processing status, role-permitted review actions.
- TLS-only release config, no secrets in bundle, logout wipes local sensitive data.
Gate: build + tests; emulator/device demo; network failure/retry test.

### Phase 7 — System integration & workflow completion
- End-to-end integration of web, mobile, backend, AI, storage, and notifications against the real APIs (no mocks in demo flow).
- Findings full lifecycle, work orders assignment/progress/verification/closure, comments, in-app notifications, exports (CSV/PDF where feasible), AI evaluation feedback loop (no auto-retraining).
Gate: workflow transition matrix tests; audit completeness; export scope tests; one E2E flow driven from mobile capture to web closure.

### Phase 8 — Security & testing
- Execute TEST_PLAN and SECURITY_AGENT test matrix (IDOR/BOLA, upload attacks, rate limiting, signed URLs, mass assignment, XSS/CSRF/CORS, dependency/container scans, secret scan).
- CI security jobs, SBOM generation, backup/restore test, known-limitations refresh, bug fixing.
Gate: no unresolved critical/high findings without documented risk acceptance; all release gates in TEST_PLAN §4 satisfied.

### Phase 9 — Deployment preparation
- Production build and environment matrix, monitoring (Prometheus/Grafana), backup configuration, deployment documentation, release checklist, pilot readiness assessment.
Gate: staging smoke tests, role/scope checks, rollback plan, and formal approvals recorded before any pilot claim.

## 3. Cross-cutting rules

- Backend authoritative; UI never trusted for roles/state.
- Explicit state machines in domain services with transition tables.
- UUIDs, UTC, pagination + stable sorting, bounded queries.
- Idempotency for retryable operations.
- Every material action emits an audit event with actor, action, target, outcome, correlation ID.
- AI confidence is labeled "model confidence"; never danger/safety probability.
- Original evidence immutable; annotations and thumbnails are derivatives.
- No secrets in source; `.env.example` placeholders only.
- All user-facing values that would be KCIC policy are configurable and seeded as DEMO.

## 4. Verification strategy

| Layer | Tool |
|---|---|
| API unit/integration | pytest, httpx AsyncClient, PostgreSQL via compose |
| API contract | OpenAPI schema snapshot + response-model checks |
| Web | ESLint, TypeScript, Vitest + Testing Library, production build |
| Mobile | `flutter analyze`, `flutter test` |
| Security | Authorization matrix tests, upload negative tests, dependency audit (`pip-audit`, `npm audit`), secret scan |
| Runtime | Docker Compose healthchecks + readiness endpoint |
| AI | Fixed demo fixture, checksum verification, repeatability test |

## 5. Ordering dependencies

Phase 2 depends on Phase 1 foundation. Phase 3 depends on Phase 2 auth/scope and inspections. Phase 4 depends on Phase 3 media. Phase 5 depends on 2–4. Phase 6 depends on 2–4 (auth + inspection + AI status). Phase 7 depends on 5 and 6. Phase 8 depends on all. Phase 9 depends on Phase 8. UI may be stubbed only with explicit, visibly labeled empty states — never fake data or dead buttons.

Phase numbering follows the master prompt Phase 0–9. The master prompt's Phase 7 (integration) is treated as continuous verification plus the Phase 7 gate above; no integration work is deferred to a single late phase.

## 6. Immediate next step

Complete Phase 1 gate, then begin Phase 2 with the schema and auth module.
