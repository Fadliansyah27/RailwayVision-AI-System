# Product Requirements & Detailed Functional Specification
## RailwayVision AI — v1.0

Status: Proposed prototype baseline; validate with KCIC stakeholders before operational use.

## 1. Product outcomes
Deliver a coherent inspection-support workflow from asset selection through evidence capture, AI inference, human review, corrective action, and audit reporting.

## 2. Product principles
- AI output is advisory, never a safety clearance or autonomous defect disposition.
- Original evidence is immutable; annotations are derivatives.
- Human decisions and AI suggestions are stored separately.
- Every record is access-scoped by organization/site/asset assignment.
- Operational data, defect taxonomies, thresholds, and retention are configurable only after approval.

## 3. Personas and permissions
| Capability | Inspector | Reviewer | Supervisor | Admin | ML Engineer | Auditor |
|---|---:|---:|---:|---:|---:|---:|
| Create inspection | Yes | Optional | Optional | Configurable | No | No |
| Upload evidence | Yes | Optional | Optional | Configurable | No | No |
| View scoped inspections | Yes | Yes | Yes | Yes | Limited | Read-only |
| Review AI suggestions | No | Yes | If authorized | No by default | No | No |
| Confirm/reject finding | No | Yes | If authorized | No | No | No |
| Assign work order | No | Optional | Yes | Configurable | No | No |
| Close work order | No | Verification role | Authorized | No by default | No | No |
| Manage users/scopes | No | No | No | Yes | No | No |
| Register/deploy model | No | No | No | No | Yes with approval | Read-only |
| View audit records | Own actions | Scoped | Scoped | Admin scope | Model events | Authorized scope |

Permissions must also enforce row-level organizational scope. The table is a starting point, not final KCIC authorization policy.

## 4. Detailed user stories and acceptance criteria

### Authentication
- As a user, I can sign in using the approved identity mechanism.
- Sessions expire and can be revoked.
- Disabled users cannot access APIs or media.
- Acceptance: unauthenticated calls are rejected; role and scope are derived from trusted identity claims/server records.

### Asset register
- Authorized administrators manage asset codes, categories, locations, and status.
- Users only see assets within their scope.
- Acceptance: attempting to access an asset outside scope returns a non-disclosing authorization response.

### Inspection
- Inspector creates a draft, selects asset, records observation time/type/notes, attaches evidence, and submits.
- Draft and upload failures are recoverable.
- Acceptance: duplicate submissions are prevented with idempotency keys; all timestamps are stored UTC.

### AI analysis
- Submitted eligible media can be queued for a specific approved model version.
- Job states: queued, processing, completed, failed, cancelled.
- Acceptance: every result includes model version, checksum, class-map version, inference time, and input media hash.

### Human review
- Reviewer can confirm, reject, reclassify, or mark an AI suggestion inconclusive.
- Reviewer can create a manual finding.
- Acceptance: decision records actor, timestamp, rationale, before/after values, and cannot be overwritten silently.

### Finding and work order
- Authorized reviewer creates a verified finding; supervisor assigns follow-up.
- Assignee updates progress and attaches evidence.
- Authorized verifier closes or reopens according to policy.
- Acceptance: illegal state transitions are rejected server-side and audited.

### Dashboard and reports
- Dashboard separates AI suggestions from human-verified findings.
- Reports are filtered by authorized scope.
- Exports are permissioned, logged, and bounded.
- Acceptance: exported records match on-screen filters and access scope.

## 5. Non-functional targets to define during load testing
Do not invent performance promises. Measure and agree:
- Concurrent users and inspection submissions.
- Upload file sizes, durations, and daily volumes.
- AI inference throughput and queue latency.
- API p95 latency and availability objective.
- Recovery point objective (RPO) and recovery time objective (RTO).
- Retention and backup windows.

## 6. Definition of Done
A feature is done only when:
1. Backend implementation exists.
2. Database migration and constraints exist where needed.
3. UI is integrated with real API, not hardcoded mock data.
4. Authorization is enforced server-side.
5. Success, loading, empty, error, and retry states exist.
6. Unit/integration tests pass.
7. Audit events are produced where required.
8. Documentation is updated.
9. Security review has no unresolved critical/high finding.
10. Demonstration evidence is captured and known limitations are documented.
