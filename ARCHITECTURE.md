# System Architecture & Technical Design

## RailwayVision AI

## 1. Architecture Overview

Proposed logical architecture:

``` mermaid
flowchart TB
    subgraph Clients
      WEB[Web Dashboard]
      MOB[Flutter Mobile App]
    end
    subgraph Platform
      API[FastAPI Backend]
      AUTH[Approved Identity Provider]
      DB[(PostgreSQL)]
      OBJ[(Private Object Storage)]
      Q[Redis Queue]
      AUD[Audit Events]
    end
    subgraph AI
      WORKER[Isolated AI Worker]
      MODEL[Approved YOLO Model Registry]
      RESULT[Detection Results]
    end
    WEB --> API
    MOB --> API
    API <--> AUTH
    API --> DB
    API --> OBJ
    API --> Q
    Q --> WORKER
    WORKER --> OBJ
    WORKER --> MODEL
    WORKER --> RESULT
    RESULT --> DB
    API --> AUD
    WORKER --> AUD
```

## 2. Logical Components

### 2.1 Web Application

-   Operational dashboard and reports.
-   Asset and location register.
-   Inspection queue and detail.
-   Side-by-side original and annotated evidence viewer.
-   Human review and finding workflow.
-   Work assignment and administration.

### 2.2 Flutter Mobile Application

-   Secure sign-in.
-   Assigned inspection list.
-   Asset lookup using approved QR/barcode identifiers.
-   Camera capture and evidence upload.
-   Inspection notes and draft support.
-   Review/assignment actions only where role permissions allow.
-   Offline draft queue with safe synchronization if included in MVP.

### 2.3 Backend API

FastAPI modules: - `/auth` --- identity/session integration. - `/users`,
`/roles`, `/scopes` --- access administration. - `/assets`, `/locations`
--- approved asset master. - `/inspections` --- inspection lifecycle. -
`/media` --- upload and authorized retrieval. - `/ai-jobs` --- inference
job submission/status. - `/detections` --- AI output. - `/findings` ---
human-verified findings. - `/work-orders` --- assignment and action
tracking. - `/reports` --- authorized reporting. - `/models` --- model
metadata and approvals. - `/audit-events` --- controlled audit access. -
`/notifications` --- in-app notifications.

All endpoints require explicit authentication and authorization policies
unless intentionally public for health checks. Health endpoints must
disclose no sensitive internals.

### 2.4 AI Inference Service

-   Runs separately from the API.
-   Pulls jobs from a queue.
-   Fetches authorized media using service identity.
-   Validates media before processing.
-   Runs an approved model version.
-   Stores detections and annotated derivatives.
-   Emits job status and audit events.
-   Has no access to train-control or signalling networks.

### 2.5 Data Layer

-   PostgreSQL for structured records and workflow state.
-   PostGIS only if approved geospatial needs exist.
-   Private object storage for original and derived media.
-   Redis for short-lived queue/cache data, not the system of record.
-   Append-oriented audit event storage with restricted access.

## 3. Suggested Deployment Environments

-   Local development: Docker Compose with synthetic media.
-   Test: isolated environment with synthetic or approved de-identified
    data.
-   Staging: production-like controls and restricted access.
-   Production/pilot: only after KCIC IT, cybersecurity, data
    governance, and engineering approval.

Hosting may be on-premise or approved private cloud. Final selection
depends on KCIC policies, data classification, residency, connectivity,
and operational support.

## 4. Data Flow

1.  User authenticates through the approved identity provider.
2.  Mobile/web client requests an inspection draft.
3.  Backend checks user role and organizational scope.
4.  Client requests a media upload session.
5.  Backend issues a short-lived upload capability for a private object
    key.
6.  Media is uploaded to quarantine/private storage.
7.  Backend validates metadata and file status, computes integrity hash,
    and records the media.
8.  Backend queues an inference job.
9.  Worker processes media and writes detection metadata plus annotated
    derivative.
10. Reviewer examines the original and AI overlay.
11. Reviewer confirms, rejects, edits, or marks the suggestion
    inconclusive.
12. Confirmed finding may be assigned for follow-up.
13. Authorized reviewer/supervisor verifies completion and closes the
    finding.
14. All significant actions create audit events.

## 5. Proposed Database Model

### 5.1 Entity Relationship Diagram

``` mermaid
erDiagram
  USERS ||--o{ INSPECTIONS : creates
  ASSETS ||--o{ INSPECTIONS : inspected_in
  LOCATIONS ||--o{ ASSETS : contains
  INSPECTIONS ||--o{ INSPECTION_MEDIA : includes
  INSPECTIONS ||--o{ AI_JOBS : triggers
  AI_JOBS ||--o{ DETECTIONS : produces
  MODEL_VERSIONS ||--o{ AI_JOBS : executes
  INSPECTIONS ||--o{ FINDINGS : has
  DETECTIONS ||--o| FINDINGS : may_become
  USERS ||--o{ REVIEW_DECISIONS : makes
  FINDINGS ||--o{ REVIEW_DECISIONS : receives
  FINDINGS ||--o{ WORK_ORDERS : generates
  USERS ||--o{ WORK_ORDERS : assigned
  USERS ||--o{ AUDIT_EVENTS : performs
```

### 5.2 Core Tables

  -----------------------------------------------------------------------
  Table                               Important fields
  ----------------------------------- -----------------------------------
  users                               id, identity_subject, display_name,
                                      status, created_at

  roles                               id, code, name

  user_roles                          user_id, role_id, scope_id

  locations                           id, code, name,
                                      approved_geometry/reference

  assets                              id, asset_code, category,
                                      location_id, status

  inspections                         id, asset_id, created_by,
                                      inspection_type, status,
                                      observed_at

  inspection_media                    id, inspection_id, object_key,
                                      mime_type, sha256, metadata

  model_versions                      id, name, version, checksum,
                                      class_map_version, approval_status

  ai_jobs                             id, inspection_id,
                                      model_version_id, status,
                                      started_at, completed_at

  detections                          id, ai_job_id, class_code,
                                      confidence, bbox, frame_index

  findings                            id, inspection_id, detection_id,
                                      human_category, priority, status

  review_decisions                    id, finding_id, reviewer_id,
                                      decision, rationale, created_at

  work_orders                         id, finding_id, assignee_id,
                                      status, due_at

  work_order_updates                  id, work_order_id, actor_id, note,
                                      evidence_id

  audit_events                        id, actor_id, action, target_type,
                                      target_id, outcome, occurred_at,
                                      correlation_id
  -----------------------------------------------------------------------

Use UUIDs, foreign keys, indexes, check constraints, and migrations.
Sensitive location details must be scoped and protected. Add
tenant/organizational scope columns or mapping tables according to the
approved access model.

## 6. API Contract Examples

Examples are illustrative and must be adapted to the approved schema.

### Create inspection

`POST /api/v1/inspections`

``` json
{
  "asset_id": "uuid",
  "inspection_type": "visual",
  "observed_at": "2026-11-23T02:00:00Z",
  "notes": "Demo inspection"
}
```

### Submit AI job

`POST /api/v1/inspections/{inspection_id}/ai-analysis`

``` json
{
  "model_version_id": "uuid"
}
```

### Example detection response

``` json
{
  "job_id": "uuid",
  "status": "completed",
  "model": {
    "name": "rail-visual-demo",
    "version": "0.1.0",
    "checksum": "sha256:..."
  },
  "detections": [
    {
      "class_code": "demo_visual_indicator",
      "confidence": 0.82,
      "bbox": [120, 90, 280, 210],
      "review_status": "pending"
    }
  ],
  "disclaimer": "AI suggestion only; human engineering review required."
}
```

## 7. AI Model Lifecycle

1.  Define classes with engineering stakeholders.
2.  Obtain approved, representative data and usage rights.
3.  Label using documented annotation guidance.
4.  Split train/validation/test by asset, location, time, or capture
    session to reduce leakage.
5.  Train and tune model.
6.  Evaluate per class and operating condition.
7.  Conduct independent engineering review of false negatives and
    failure modes.
8.  Register artifact, checksum, class map, dataset lineage, and
    metrics.
9.  Approve deployment through controlled release process.
10. Monitor drift and performance; roll back if quality degrades.

Do not invent actual defect classes in production. Placeholder labels in
demo data must be clearly marked as illustrative. Do not use confidence
thresholds as severity thresholds.

## 8. Recommended MVP Scope

-   One approved or synthetic asset category.
-   One approved or illustrative image-based model task.
-   Web dashboard and Flutter capture app.
-   Inspection submission and private media storage.
-   Asynchronous inference.
-   Human review and finding workflow.
-   Basic dashboard and audit trail.
-   No live-system integration and no automated safety decisions.

## 9. Non-Functional Architecture

-   Stateless API instances where practical.
-   Queue-based inference to avoid blocking API requests.
-   Retry with backoff and dead-letter handling.
-   Idempotent job processing.
-   Database backups and tested restore procedures.
-   Object storage lifecycle policy subject to approval.
-   Centralized metrics, logs, and tracing.
-   Network segmentation between user-facing services and inference
    workers.
-   No route from the application network to railway operational control
    networks.

## 10. Key Architecture Decisions to Confirm

-   On-premise vs approved private cloud.
-   SSO / identity provider.
-   Data classification and retention.
-   Location precision and GIS requirements.
-   Approved capture hardware and media sources.
-   YOLO implementation and license suitability.
-   Model hosting hardware (CPU/GPU).
-   Whether mobile offline mode is required.
-   Integration boundaries and approved APIs.
