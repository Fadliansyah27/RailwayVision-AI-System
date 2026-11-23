# Phase 1 Report — Foundation & Local Stack

Date: 2026-11-23
Scope: Phase 1 only (repository audit, monorepo foundation, local Docker stack, CI baseline, health checks). No Phase 2+ functionality is claimed.

## 1. Delivered capabilities

- Monorepo with four independently buildable units: FastAPI API, Celery AI worker, Next.js web dashboard, Flutter mobile app.
- FastAPI service with structured JSON logs, request IDs, security headers, body-size limit, CORS allowlist, error envelope, and health/liveness/readiness probes.
- Readiness probe verifies PostgreSQL and Redis live, and reports AI worker heartbeat (informational, non-gating).
- Celery worker connected to Redis, with periodic heartbeat (`rvai:worker:heartbeat`), container healthcheck, and one verified task round-trip (`system.ping`).
- Next.js dashboard that fetches live status from the API (no hardcoded status), with loading, error/retry, and success states; role-aware navigation model prepared for later phases.
- Flutter app with live system status, loading/error/retry states, and honest "planned module" screens for later phases.
- Docker Compose stack with six services, healthchecks, localhost-bound ports, non-root/read-only containers (API, worker, web), dropped capabilities.
- Alembic async migration harness, baseline revision applied to local PostgreSQL.
- GitHub Actions CI baseline (lint, tests, web build, Flutter analyze/test, compose config validation).
- Architecture decision records 0001–0004 covering stack, authentication, media storage, and queue/worker design.

## 2. Folder structure (top level)

```
.
├── .env.example / .env            # local values; .env is gitignored
├── docker-compose.yml
├── Makefile
├── .github/workflows/ci.yml
├── apps/
│   ├── web/                       # Next.js 16 + TypeScript + Tailwind v4
│   │   ├── src/app, src/components, src/lib
│   │   ├── Dockerfile, vitest.config.mts, eslint.config.mjs
│   └── mobile/                    # Flutter 3 Material 3
│       ├── lib/{core,models,screens,services,widgets}
│       ├── test/
│       └── android/, ios/, web/
├── services/
│   ├── api/                       # FastAPI + SQLAlchemy async + Alembic
│   │   ├── app/{api,core,db}
│   │   ├── alembic/versions/
│   │   ├── tests/
│   │   └── Dockerfile
│   └── ai-worker/                 # Celery + Redis
│       ├── worker/{celery_app,config,heartbeat,healthcheck,tasks}.py
│       ├── tests/
│       └── Dockerfile
├── docs/
│   ├── REPOSITORY_AUDIT.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── ADR/0001..0004
│   ├── PHASE_1_REPORT.md (this file)
│   └── screenshots/phase-1-*.png
└── original project documents (BRD, ARCHITECTURE, SECURITY_AGENT, etc.)
```

## 3. Key files created

Backend (`services/api`):
- `app/main.py`, `app/api/router.py`, `app/api/routes/{health,meta}.py`
- `app/core/{config,constants,errors,logging,middleware,health}.py`
- `app/db/{base,session}.py`
- `alembic/env.py`, `alembic/versions/20261123_0001_baseline.py`
- `tests/{conftest,test_health,test_middleware,test_errors,test_meta}.py`
- `Dockerfile`, `requirements*.txt` (fully pinned), `pyproject.toml`

Worker (`services/ai-worker`):
- `worker/{celery_app,config,heartbeat,healthcheck,tasks}.py`
- `tests/test_heartbeat.py`
- `Dockerfile`, `requirements*.txt` (fully pinned)

Web (`apps/web`):
- `src/app/{layout,page,error,loading,not-found}.tsx`, `src/app/system-status/page.tsx`
- `src/components/{app-shell,status-panel,ui,nav-model}.tsx|ts`
- `src/lib/{api,status}.ts`
- `src/app/globals.css` (design tokens)
- test files, `vitest.config.mts`, `Dockerfile`, security headers in `next.config.ts`

Mobile (`apps/mobile`):
- `lib/core/{config,theme}.dart`, `lib/models/system_status.dart`
- `lib/services/api_client.dart`
- `lib/screens/{root_shell,home,inspections,capture,work,profile}_screen.dart`
- `lib/widgets/{section_card,planned_module}.dart`
- `test/{widget_test,system_status_test}.dart`

Infrastructure and docs:
- `docker-compose.yml`, `.env.example`, `.gitignore`, `Makefile`, `.github/workflows/ci.yml`
- `docs/REPOSITORY_AUDIT.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ADR/0001–0004`

## 4. Database and migrations

- Tooling: Alembic with async engine (`asyncpg`), `compare_type` enabled.
- Revision `0001_baseline` is design-only (no domain tables yet); it establishes the migration chain.
- Executed locally inside the API container:

```
docker compose exec -T api alembic upgrade head
# Running upgrade  -> 0001_baseline, Baseline schema marker.
```

- Result: `alembic_version` table present; no business tables exist yet by design.

## 5. API documentation (current)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health/live` | Process liveness |
| GET | `/health/ready` | PostgreSQL + Redis gate; worker heartbeat informational |
| GET | `/api/v1/meta` | Service name, version, environment, API version, AI advisory notice |

- OpenAPI UI available at `/docs` (also `/redoc`, `/openapi.json`) only in `local`/`test`; disabled in production.
- Error envelope: `{"error":{"code","message","request_id"}}`; no stack traces or internal details exposed.
- CORS: explicit allowlist only (localhost/127.0.0.1, ports 3000/3001). No wildcard; startup validation rejects `*`.

Readiness response observed:

```
{"status":"ok","components":{"database":"ok","redis":"ok","worker":"ok"}}
```

## 6. Screenshots

- Dashboard (live status panel): [phase-1-dashboard.png](screenshots/phase-1-dashboard.png)
- System status page: [phase-1-system-status.png](screenshots/phase-1-system-status.png)

Both were captured from the running Compose stack at `http://127.0.0.1:3000`. Mobile UI was validated by widget tests only (no emulator screenshot captured).

## 7. Automated tests and checks actually run

| Area | Command | Result |
|---|---|---|
| API lint | `ruff check .` | Pass (0 findings) |
| API tests | `pytest -q` | 16 passed |
| Worker lint | `ruff check .` | Pass |
| Worker tests | `pytest -q` | 5 passed |
| Web lint | `npm run lint` | Pass |
| Web tests | `npm test` | 14 passed (3 files) |
| Web build | Docker image build (`next build`, standalone) | Success |
| Mobile analyze | `flutter analyze` | Pass |
| Mobile tests | `flutter test` | 6 passed |
| Compose validation | `docker compose config -q` | Pass |
| Migrations | `alembic upgrade head` | Applied `0001_baseline` |
| Queue round-trip | `celery_app.send_task('system.ping').get()` | `{'status': 'ok', ...}` |
| CORS preflight | `OPTIONS /api/v1/meta` from `http://127.0.0.1:3000` | 200, origin echoed |
| Stack health | `docker compose ps` | 6/6 healthy |

Total automated tests: 41 passed.

## 8. Security checks performed

- Security headers verified on API responses: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy: default-src 'none'`, `Cache-Control: no-store`; HSTS configurable and forced on in staging/production.
- Request ID validation/propagation tested; malformed IDs replaced.
- JSON body limit (1 MiB) enforced with 413; tested.
- Production settings guard rejects local DB/Redis endpoints and disabled HSTS; tested.
- CORS wildcard rejected at startup; tested.
- Containers: API/worker/web run as non-root, `read_only` filesystems, `cap_drop: ALL`, `no-new-privileges`; host ports bound to `127.0.0.1`.
- Secrets only via env; `.env` gitignored; `.env.example` contains local placeholders.
- Dependency audits: `pip-audit` for API and worker requirements — no known vulnerabilities; `npm audit` (incl. production) — 0 vulnerabilities.
- No connection to, or testing against, KCIC systems was performed.

## 9. Known limitations / not yet implemented

- Authentication, sessions, RBAC, and org scoping (Phase 2).
- Domain tables for assets, inspections, media, detections, findings, work orders, audit events (Phases 2–7).
- MinIO runs but is not yet used by the API; buckets/quarantine/presigned flows arrive in Phase 3.
- Worker only supports `system.ping`; no inference, model registry, or annotated media (Phase 4).
- Dashboard KPIs are intentionally empty (em dash) — no simulated operational data.
- Mobile app is status-only; no sign-in, capture, upload, or offline drafts.
- Official MinIO images are no longer anonymously available (Docker Hub repo removed, Quay requires auth); Compose pins `bitnamilegacy/minio:2025.7.23-debian-12-r5` for local development only. Production object storage remains an open stakeholder decision.
- No container image vulnerability scan, SBOM, or backup/restore drill yet (Phase 8).
- CI workflow is written but has not run on a hosted runner (no remote configured).

## 10. Defects found and fixed during verification

1. Worker heartbeat was written to the Celery broker Redis DB (1) while the API read DB 0, so readiness reported `worker: error`. Fixed with a dedicated `HEARTBEAT_REDIS_URL` shared with the API; readiness now green.
2. Dashboard could not reach the API when opened via `127.0.0.1:3000` (origin not allowlisted). Added loopback alias origins; verified preflight.
3. Configured MinIO image tag did not exist; replaced with a verified, digest-usable local-development image.

## 11. Next phase

Phase 2 gate proposal: identity and access foundation — users, credentials (Argon2id), JWT access/refresh rotation, RBAC role matrix, organizational scope enforcement, audit-event schema, and authorization tests (including IDOR/BOLA and role-escalation cases) before any asset/inspection work begins.
