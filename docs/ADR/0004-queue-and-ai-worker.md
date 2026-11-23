# ADR-0004 — Queue and AI worker isolation

Status: Accepted

## Context
Inference must be asynchronous (BRD FR-006, ARCHITECTURE §2.4), retry-safe, idempotent, and isolated from the API. AGENT.md allows Celery, RQ, or equivalent.

## Decision
- Celery with Redis broker/backend, running as a separate `ai-worker` container.
- Tasks are idempotent by (inspection_media_id, model_version_id); duplicate deliveries are detected via database uniqueness/state checks, not just in-memory locks.
- Retries with exponential backoff and bounded attempts; terminal failures recorded as `AI Failed` with an error code, never as "no defect".
- Model artifacts verified by checksum before load; model registry rows record name, semantic version, checksum, class-map version, thresholds, approval state.
- Worker container runs non-root, with resource limits, and no access to external railway networks; outbound access limited to internal services.
- Phase 1 ships the worker skeleton (Celery app, heartbeat, no tasks) to validate infrastructure; inference tasks arrive in Phase 4.

## Consequences
- Celery visibility timeout and Redis durability configure at-least-once semantics; idempotency is mandatory.
- Large model files are mounted/copied at deploy time, not baked into source control.
- Model evaluation runs are separate from production inference (Phase 4/7).
