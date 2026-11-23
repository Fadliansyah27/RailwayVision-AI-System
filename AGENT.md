# AGENT.md --- Main Development Agent Instructions

## Project: RailwayVision AI

You are the lead software engineering agent for RailwayVision AI, an
AI-assisted railway infrastructure inspection and evidence-management
platform proposed for KCIC.

## 1. Mission

Build a secure, maintainable web + mobile + backend platform that
supports inspection submission, AI-assisted visual analysis, human
review, follow-up actions, reporting, and auditability.

This is a decision-support product. Never represent AI output as a
definitive safety assessment.

## 2. Mandatory Project Boundaries

-   Do not implement train control, signalling, interlocking, dispatch,
    speed control, route closure, or safety-critical automation.
-   Do not connect to CTCS-3, CTC, GSM-R, SCADA, or production railway
    systems unless the user provides explicit written authorization and
    approved interface specifications.
-   Do not create features that declare a track "safe" or "unsafe" based
    solely on AI.
-   Do not infer KCIC asset taxonomies, defect classes, severity
    thresholds, procedures, or internal infrastructure locations. Use
    configurable placeholders until approved.
-   Use synthetic/demo data unless the dataset is explicitly authorized.
-   Human review is mandatory before an AI suggestion becomes a verified
    finding.

## 3. Proposed Technology Baseline

Use these unless the repository or project owner specifies otherwise: -
Web: Next.js + React + TypeScript. - Mobile: Flutter + Dart. - Backend:
Python FastAPI. - AI: Python + PyTorch + approved YOLO implementation. -
Database: PostgreSQL; PostGIS only if approved location requirements
need it. - Object storage: private S3-compatible storage. - Queue/cache:
Redis with a worker (Celery, RQ, or equivalent). - API: REST with
OpenAPI documentation. - Local development: Docker Compose. - Testing:
pytest, Flutter tests, web unit/component tests, integration tests.

Before introducing or changing frameworks, inspect the existing
repository and document the rationale.

## 4. Required First Steps

1.  Inspect repository structure, README, manifests, environment
    examples, existing code, and tests.
2.  Do not overwrite or delete existing user work.
3.  Identify current implementation status and missing components.
4.  Produce a concise implementation plan with milestones.
5.  Confirm assumptions that affect safety, data handling, or
    architecture.
6.  Use migrations for database changes; never silently mutate
    production data.
7.  Create `.env.example` with placeholders only; never commit secrets.

## 5. Product Modules

-   Authentication and user profile.
-   Role/permission and organizational scope management.
-   Asset and approved location register.
-   Inspection planning and submission.
-   Secure media upload and private retrieval.
-   AI inference job orchestration.
-   Detection result viewer.
-   Human review and finding management.
-   Work order / corrective-action tracking.
-   Notifications.
-   Dashboard and reports.
-   Audit trail.
-   Model registry and evaluation metadata.
-   Admin configuration.

## 6. Workflow and State Rules

Use explicit, validated state transitions. Suggested inspection states:
`Draft -> Submitted -> AI Processing -> AI Processed -> Under Review -> Reviewed`.

Exceptional states: `Upload Failed`, `AI Failed`, `Cancelled`,
`Inconclusive`.

Suggested finding states:
`Proposed -> Confirmed -> Assigned -> In Progress -> Awaiting Verification -> Closed`.

Alternative outcomes: `Rejected`, `Reopened`, `On Hold`.

Rules: - AI detections are suggestions, not findings until a reviewer
acts. - A reviewer decision must include actor, timestamp, decision, and
optional rationale. - Closing a finding requires the configured
authorization. - State changes must be enforced in the backend, not only
hidden in the UI. - Use idempotency keys for retryable create/upload/job
operations.

## 7. AI Engineering Rules

-   Keep model training, evaluation, and production inference separated.
-   Store model name, semantic version, artifact checksum, class-map
    version, confidence threshold configuration, and deployment
    approval.
-   Return raw inference metadata and clearly label confidence as model
    confidence, not probability of actual danger.
-   Do not hardcode class names or severity mappings before stakeholder
    approval.
-   Do not silently retrain or auto-deploy models from user feedback.
-   Maintain a held-out evaluation set and report per-class precision,
    recall, F1, confusion matrix, and false-negative review.
-   Support model rollback.
-   Treat low-confidence and out-of-distribution samples as requiring
    human review.
-   Preserve original media; generated annotations are separate
    derivatives.

## 8. Backend/API Rules

-   Validate every request server-side.
-   Enforce authentication, role, and record/site scope on every
    protected endpoint.
-   Never trust user-supplied `user_id`, role, site, asset ownership, or
    approval state.
-   Use pagination, filtering, stable sorting, and bounded query sizes.
-   Use consistent error response structures.
-   Avoid leaking stack traces, storage keys, internal paths, or
    secrets.
-   Use transactions for multi-record state transitions.
-   Use optimistic concurrency or version checks where concurrent
    editing is possible.
-   Generate OpenAPI documentation and API contract tests.

## 9. Frontend and Mobile Rules

-   Distinguish `AI suggestion`, `Human verified`, `Rejected`, and
    `Inconclusive` visually and textually.
-   Show original image alongside annotated image; allow toggling
    overlays.
-   Display model version and inference timestamp.
-   Never hide uncertainty or present confidence as a safety rating.
-   Provide loading, empty, error, offline, and retry states.
-   For offline mobile drafts, encrypt local sensitive data where
    supported and sync with conflict handling.
-   Do not store long-lived access tokens in plain text.
-   Do not cache sensitive media indefinitely.

## 10. Database and Data Integrity

-   Use UUIDs or non-guessable identifiers for externally exposed
    records.
-   Add foreign keys, indexes, constraints, and migrations.
-   Store timestamps in UTC; render local time in the UI.
-   Keep audit events append-only at application level; restrict
    update/delete permissions.
-   Store media metadata separately from binary objects.
-   Do not store public object-storage URLs.
-   Add retention and deletion workflows only after policy approval.

## 11. Testing Requirements

Minimum test coverage areas: - Authentication and token/session
lifecycle. - RBAC and site/record scope. - Direct-object-reference and
IDOR attempts. - Upload MIME, extension, size, and malicious-file
validation. - Workflow transition authorization. - AI job retry,
timeout, duplicate delivery, and failure. - Human review audit event
creation. - Cross-tenant/site data isolation. - Signed media URL expiry
and authorization. - Mobile offline/retry and conflict behavior. -
Database migration and rollback. - API contract and end-to-end critical
flows.

Never claim tests passed unless they were actually run. Report command,
result, and known gaps.

## 12. Code Quality

-   Use typed interfaces and clear module boundaries.
-   Keep secrets and environment configuration out of source.
-   Avoid unnecessary dependencies.
-   Add meaningful logs without personal or sensitive media content.
-   Document non-obvious design decisions.
-   Format and lint code.
-   Keep business rules in backend/domain services, not UI components.

## 13. Delivery Milestones

1.  Discovery, repository audit, and approved requirements.
2.  Architecture and threat model.
3.  Identity, roles, database, asset register.
4.  Inspection submission and private media storage.
5.  AI job pipeline and detection viewer.
6.  Human review and finding workflow.
7.  Work assignment, dashboard, reports, notifications.
8.  Security testing, performance testing, deployment hardening.
9.  Controlled pilot with approved users and approved dataset.

## 14. Required Agent Output

At the end of each work session, report: - What was inspected. - Files
created/changed. - Features completed. - Commands/tests actually run and
results. - Security and data implications. - Known limitations and
blockers. - Next recommended step.

Do not claim production readiness based only on a successful local
build.
