# Verification, QA & Security Test Plan

## 1. Test levels
- Unit: domain rules, validators, state transitions, permission functions.
- Integration: API + PostgreSQL + object storage + Redis + AI worker.
- Contract: OpenAPI schema and client compatibility.
- E2E: inspector submission through review and work-order closure.
- Security: authorized testing in isolated environments.
- AI evaluation: fixed, versioned, representative dataset.
- Performance: agreed workload model; no invented SLA.
- Recovery: backup restore, queue recovery, worker restart.

## 2. Critical end-to-end scenarios
1. Inspector submits inspection with valid media.
2. Invalid/oversized/disallowed media is rejected safely.
3. Valid media is queued exactly once despite client retry.
4. Worker failure can be retried without duplicate detections.
5. Reviewer can confirm/reject/inconclusive with rationale.
6. Unauthorized role cannot review or close.
7. User from another scope cannot read inspection or media.
8. Work order assignment and state transition are audited.
9. Export is scoped and recorded.
10. AI job failure is not displayed as “no issue detected.”
11. Model rollback preserves traceability of prior results.
12. Mobile offline draft sync handles duplicate and conflict safely.

## 3. Security test cases
- IDOR/BOLA on every resource and media endpoint.
- Role escalation and mass assignment.
- SQL injection, XSS, CSRF, SSRF, path traversal.
- Upload MIME/signature mismatch, polyglot, oversized file, archive bomb.
- Signed URL expiry and replay.
- Rate limiting and brute force controls.
- Secrets in repository, logs, build artifacts.
- Mobile token storage and release network configuration.
- Audit tampering and privileged export access.
- Queue payload tampering and model artifact checksum mismatch.

## 4. Release gates
Do not release if:
- Critical or high security findings remain unresolved without formal risk acceptance.
- Scope isolation tests fail.
- Audit events are missing for critical workflow actions.
- Original evidence integrity cannot be verified.
- AI result is represented as a safety verdict.
- Backup restoration has not been tested for the target environment.
- Model dataset authorization or release approval is missing.

## 5. Test report format
For each test, record ID, environment, build/commit, preconditions, steps, expected result, actual result, evidence, status, defect reference, and retest result. Never state “passed” unless executed.
