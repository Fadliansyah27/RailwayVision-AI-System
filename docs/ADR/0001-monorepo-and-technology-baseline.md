# ADR-0001 — Monorepo and technology baseline

Status: Accepted for prototype (2026-11-23)

## Context
The documentation package mandates Next.js + TypeScript, Flutter, FastAPI, PostgreSQL, Redis, private S3-compatible storage, YOLO/OpenCV, and Docker. No code existed. The prototype needs one repository for atomic cross-stack changes and a single Docker Compose entry point.

## Decision
- Single monorepo: `apps/web`, `apps/mobile`, `services/api`, `services/ai-worker`, `infra`, `docs`.
- Python dependencies installed with a standard venv + pip (`pyproject.toml`, pinned ranges); no Poetry/uv dependency added.
- Web scaffolded with the Next.js App Router, TypeScript, Tailwind CSS; API client code is hand-written (no generated SDK yet).
- PostgreSQL 16, Redis 7, MinIO (S3 API) as Compose services, pinned image tags.
- CI via GitHub Actions running lint, type checking, tests, and builds per app/service.

## Consequences
- Simple onboarding (`docker compose up`), but Compose is not a production orchestrator; Phase 8 must define the target environment.
- Pinned image tags require manual upgrade review; documented in the runbook.
- Shared TypeScript/Python types are not generated automatically; OpenAPI is the contract source of truth and clients are validated against it in tests.
