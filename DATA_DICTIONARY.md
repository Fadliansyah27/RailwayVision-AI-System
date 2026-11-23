# Data Dictionary & Database Implementation Notes

Use UUID primary keys, UTC timestamps, foreign keys, explicit constraints, and migrations. This is a logical baseline; confirm KCIC terminology, scope model, and retention before production.

## Core entities
| Entity | Key fields | Notes |
|---|---|---|
| users | id, identity_subject, display_name, status | Identity subject maps to approved IdP |
| roles | id, code, name | Permission bundles |
| permissions | id, code, description | Fine-grained action permissions |
| user_roles | user_id, role_id, scope_id | Role assignment is scope-bound |
| scopes | id, parent_id, code, name | Organizational/site boundary |
| locations | id, scope_id, code, label, geometry_ref | Restrict sensitive spatial detail |
| assets | id, scope_id, location_id, asset_code, category_code, status | No assumed real KCIC asset taxonomy |
| inspections | id, asset_id, created_by, status, observed_at, submitted_at | Workflow aggregate |
| inspection_media | id, inspection_id, object_key, sha256, mime_type, size_bytes, media_status | Never store public URL |
| model_versions | id, name, version, checksum, class_map_version, approval_status | Model governance |
| ai_jobs | id, inspection_id, model_version_id, status, attempts, error_code | Retry-safe async jobs |
| detections | id, ai_job_id, class_code, confidence, bbox_json, frame_index | AI output only |
| findings | id, inspection_id, detection_id, human_category, priority_code, status | Human-verified record |
| review_decisions | id, finding_id, reviewer_id, decision, rationale, created_at | Append review decisions |
| work_orders | id, finding_id, assignee_id, status, due_at | Corrective-action tracking |
| work_order_updates | id, work_order_id, actor_id, note, created_at | Append progress history |
| attachments | id, parent_type, parent_id, object_key, sha256 | Private evidence |
| notifications | id, user_id, type, payload_ref, read_at | Avoid sensitive payload content |
| audit_events | id, actor_id, action, target_type, target_id, outcome, occurred_at, correlation_id | Append-only application policy |

## Required constraints and indexes
- Unique `assets.asset_code` within the approved scope.
- Unique `model_versions(name, version)`.
- `confidence` constrained to [0,1].
- Positive media size and bounded image/video dimensions/duration.
- Foreign keys for all relationships.
- Index inspection status/date, asset/date, finding status/priority, work order assignee/status, AI job status/created time.
- Index scope IDs on all scope-controlled entities.
- Use soft deletion only where policy requires; do not erase audit evidence.
- Avoid storing duplicate personal data from identity provider.

## Data classification
Classify every field and media object with KCIC data governance. At minimum, distinguish public demo data, internal operational data, restricted infrastructure information, and personal data. Actual labels and handling rules require KCIC approval.
