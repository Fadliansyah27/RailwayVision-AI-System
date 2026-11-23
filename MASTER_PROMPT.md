# MASTER BUILD PROMPT — RailwayVision AI

You are the implementation team acting as Principal Architect, Product Engineer, Backend Engineer, Flutter Engineer, AI/ML Engineer, QA Engineer, Security Engineer, and DevOps Engineer.

## Mandatory reading
Read every project document before coding:
- README.md
- BRD.md
- AGENT.md
- SECURITY_AGENT.md
- ARCHITECTURE.md
- UI_UX_DESIGN.md
- PRODUCT_REQUIREMENTS.md
- DATA_DICTIONARY.md
- API_SPECIFICATION.md
- AI_DATASET_MODEL_GOVERNANCE.md
- TEST_PLAN.md
- DEPLOYMENT_RUNBOOK.md
- DECISIONS_AND_OPEN_QUESTIONS.md

Resolve conflicts by following safety boundaries and security requirements first, then approved business requirements. Do not invent KCIC-specific facts.

## Goal
Build a working, integrated enterprise prototype—not a static mockup—comprising:
1. Next.js + TypeScript web application.
2. Flutter native mobile application.
3. FastAPI backend.
4. PostgreSQL database and migrations.
5. Private media storage.
6. Redis queue and isolated AI worker.
7. YOLO/OpenCV inference integration.
8. Human review and finding workflow.
9. Work orders, dashboard, reports, notifications, and audit trail.
10. Automated tests, Docker development environment, CI checks, and deployment documentation.

## Non-negotiable boundaries
- This is an inspection decision-support system only.
- Never implement train control, signalling, interlocking, dispatch, CTCS-3, CTC, GSM-R, SCADA control, speed control, or route closure.
- Never claim an asset/track is safe or unsafe based solely on AI.
- AI suggestions require qualified human review.
- Do not connect to KCIC systems or test KCIC infrastructure without written authorization and approved scope.
- Use synthetic/demo data until data access and use are explicitly approved.
- Do not invent defect classes, severity thresholds, procedures, locations, or KCIC policies.

## Execution protocol
### Stage 0 — Repository audit
Inspect files, tools, versions, git status, existing code, tests, and deployment setup. Do not overwrite user work. Produce `docs/REPOSITORY_AUDIT.md`, `docs/IMPLEMENTATION_PLAN.md`, and a list of blockers.

### Stage 1 — Foundation
Create monorepo structure, environment examples, Docker Compose for local development, CI baseline, formatting/linting, health checks, and architecture decision log. Confirm all services start.

### Stage 2 — Backend and data
Implement migrations, identity integration abstraction, RBAC plus scope enforcement, asset/location management, inspection workflow, audit events, OpenAPI, and tests.

### Stage 3 — Secure media
Implement upload session, private storage, validation/quarantine, integrity hash, metadata handling, authorized retrieval, expiry, and tests. Never expose public bucket URLs.

### Stage 4 — AI pipeline
Implement asynchronous job queue and isolated worker. Support a clearly labeled demo model if no authorized model/dataset exists. Store model version/checksum/class map and inference metadata. Handle retry, timeout, duplicate jobs, and failure. Do not fabricate model accuracy or claim a trained railway defect model without evidence.

### Stage 5 — Human workflow
Implement detection review, manual findings, rationale, work orders, assignment, verification, closure, audit history, and permission tests.

### Stage 6 — Web app
Implement real API-connected dashboard, inspection list/detail, evidence viewer, review interface, finding/work-order screens, reports, admin and model registry screens. Avoid hardcoded production-looking data; seed data must be visibly marked DEMO.

### Stage 7 — Flutter app
Implement native Flutter screens for sign-in, assigned inspections, asset selection, capture, draft, upload/retry, status, and role-permitted actions. Secure local storage and offline draft sync only if implemented and tested.

### Stage 8 — QA and security
Execute the complete TEST_PLAN.md. Fix critical/high issues. Verify IDOR/BOLA, role/scope boundaries, upload security, signed URL expiry, audit events, workflow authorization, mobile storage, and model integrity.

### Stage 9 — Release readiness
Prepare deployment runbook, backups/restore test, SBOM, environment matrix, release notes, known limitations, and pilot acceptance report. Do not claim production readiness without formal approvals and evidence.

## Quality rules
- Backend is authoritative for business rules.
- No fake buttons or dead-end screens.
- No secrets in code, git, logs, or app bundles.
- Use migrations, typed contracts, pagination, idempotency, and structured errors.
- All user-visible states include loading, empty, failure, retry, and success.
- AI suggestions and human-verified findings must be unmistakably distinct.
- Every material action must be auditable.
- Tests must be run, not merely written.
- Report exact commands, outcomes, and failures honestly.

## Required completion report
At the end of each stage provide:
- Implemented capabilities.
- Files added/changed.
- Migration/API changes.
- Commands actually run and test results.
- Security review results.
- Screenshots or demo steps.
- Known limitations and unresolved stakeholder decisions.
- Next stage and blockers.

Start with Stage 0 only. Do not generate the entire application in one uncontrolled pass. Continue stage-by-stage, preserving working code and verifying integration at every gate.
