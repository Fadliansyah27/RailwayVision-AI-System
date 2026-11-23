# Business Requirements Document (BRD)

## RailwayVision AI --- AI-Powered Railway Infrastructure Inspection & Monitoring System

  Field              Value
  ------------------ ---------------------------------------------
  Document version   1.0
  Status             Initial proposal for stakeholder validation
  Organization       PT Kereta Cepat Indonesia China (KCIC)
  Product owner      To be appointed by KCIC
  Prepared date      23 November 2026

## 1. Executive Summary

RailwayVision AI is a proposed digital inspection-support platform that
allows authorized personnel to submit infrastructure inspection images
or videos, run AI-assisted visual analysis, review possible findings,
assign follow-up actions, and maintain traceable inspection records.

The system is intended to improve the consistency, traceability, and
accessibility of inspection documentation. AI output is advisory: a
qualified and authorized human reviewer must validate findings and
determine the appropriate action under approved KCIC procedures.

## 2. Business Context and Problem Statement

Inspection evidence may be distributed across manual forms, photos,
spreadsheets, messaging channels, and separate maintenance records. This
can make it difficult to: - Consolidate inspection evidence and
history. - Track findings from initial report through verification and
closure. - Compare repeated observations at the same asset or
location. - Monitor outstanding findings and response times. - Review
the performance and limitations of AI-assisted detection.

The proposed platform centralizes these workflows. The actual
current-state problems, baseline metrics, and operational priorities
must be confirmed through discovery workshops with KCIC.

## 3. Business Objectives

-   Digitize inspection submission and evidence management.
-   Provide AI-assisted identification of configured visual indicators.
-   Establish a traceable review, assignment, and closure workflow.
-   Provide dashboards for workload, finding status, and inspection
    coverage.
-   Preserve model version, inference metadata, and human decisions for
    auditability.
-   Support controlled evaluation of AI performance before any
    operational adoption.

### 3.1 Success Measures (proposed; baseline and target to be agreed)

-   Percentage of inspections recorded in the platform.
-   Median time from submission to human review.
-   Percentage of findings with complete evidence and location metadata.
-   Percentage of findings reviewed and dispositioned within the agreed
    SLA.
-   AI precision, recall, false-positive rate, and false-negative rate
    on a KCIC-approved test set.
-   Availability, API latency, processing failure rate, and audit-log
    completeness.

No numeric performance target is assumed until a representative dataset
and baseline are approved.

## 4. Scope

### 4.1 In Scope

1.  User authentication and role-based authorization.
2.  Asset register for approved inspection assets and locations.
3.  Inspection plan and inspection submission.
4.  Image/video upload with metadata and evidence integrity controls.
5.  AI inference for an approved and versioned set of visual classes.
6.  Detection result visualization (bounding boxes, class, confidence,
    model version).
7.  Human review: confirm, reject, reclassify, or mark inconclusive.
8.  Finding severity/priority assigned by an authorized human using
    approved rules.
9.  Work item assignment and status tracking.
10. Comments, evidence attachments, and activity history.
11. Dashboard, filtering, export, and reports.
12. Audit trail, model registry metadata, and operational monitoring.
13. Controlled dataset curation and feedback workflow for future model
    evaluation.

### 4.2 Out of Scope

-   Train control, signalling, interlocking, CTCS-3, CTC, GSM-R, SCADA
    control, or dispatch functions.
-   Automatic train stopping, speed restriction, route closure, or
    safety clearance.
-   Autonomous maintenance decisions or automatic work execution.
-   Replacing approved inspection instruments, engineering standards, or
    certified inspections.
-   Direct integration with KCIC production systems without written
    authorization and approved interface specifications.
-   Facial recognition or identification of passengers or employees.
-   Public access to infrastructure imagery, maps, or sensitive
    operational data.

## 5. Stakeholders and User Roles

  -----------------------------------------------------------------------
  Role                                Responsibilities
  ----------------------------------- -----------------------------------
  Inspector / Technician              Create inspection, upload evidence,
                                      review assigned assets, add
                                      observations

  Engineering Reviewer                Validate AI suggestions, classify
                                      findings, determine technical
                                      disposition

  Supervisor                          Assign work, review findings,
                                      monitor SLA, approve closure where
                                      authorized

  Administrator                       Manage users, roles, asset master
                                      data, and configuration

  AI/ML Engineer                      Manage model versions, evaluation
                                      datasets, and model deployment
                                      approvals

  Auditor / Read-only                 Review authorized records and audit
                                      history

  Security / IT Administrator         Manage security configuration,
                                      access, logs, backups, and
                                      integrations
  -----------------------------------------------------------------------

Least privilege applies. A role does not automatically imply permission
to view every site, asset, or record; access must also be scoped by
organizational assignment.

## 6. Core Business Processes

### 6.1 Inspection Submission

1.  Inspector signs in.
2.  Selects an authorized asset/location or creates a permitted
    inspection record.
3.  Captures or uploads image/video.
4.  Enters inspection context, timestamp, and notes.
5.  System validates file type, size, metadata, and upload permissions.
6.  Inspection is saved with status `Submitted`.

### 6.2 AI-Assisted Analysis

1.  Backend queues an inference job.
2.  AI worker loads an approved model version.
3.  Worker processes media and stores result metadata.
4.  System records model ID/version, confidence, processing time, and
    errors.
5.  Inspection status becomes `AI Processed` or `AI Failed`.
6.  AI output is displayed as a suggestion, never as an approved
    engineering conclusion.

### 6.3 Human Review

1.  Reviewer opens the inspection and original evidence.
2.  Reviewer examines each AI suggestion.
3.  Reviewer confirms, rejects, edits, or marks it inconclusive.
4.  Reviewer records rationale and, where required, supporting evidence.
5.  Confirmed findings receive a human-assigned priority based on
    approved KCIC rules.
6.  System records reviewer identity, timestamp, and changes.

### 6.4 Follow-up and Closure

1.  Supervisor assigns an action to an authorized team/person.
2.  Assignee records progress and supporting evidence.
3.  Reviewer/supervisor verifies completion.
4.  Finding is closed only by a role authorized under the agreed
    workflow.
5.  Full activity history remains available according to retention
    policy.

## 7. Functional Requirements

  ----------------------------------------------------------------------------------------
  ID                      Requirement                              Priority
  ----------------------- ---------------------------------------- -----------------------
  FR-001                  Users can authenticate using the         Must
                          approved identity provider

  FR-002                  System enforces role and record/site     Must
                          scope authorization

  FR-003                  Authorized users can browse approved     Must
                          asset/location records

  FR-004                  Inspector can create and submit an       Must
                          inspection

  FR-005                  System validates uploads and stores      Must
                          evidence privately

  FR-006                  System queues AI analysis asynchronously Must

  FR-007                  AI result includes class, confidence,    Must
                          coordinates, model version, and
                          timestamp

  FR-008                  Reviewer can                             Must
                          confirm/reject/reclassify/inconclusive
                          AI suggestions

  FR-009                  Reviewer can create a finding with       Must
                          evidence and rationale

  FR-010                  Supervisor can assign and track          Must
                          follow-up actions

  FR-011                  System maintains immutable or            Must
                          tamper-evident audit events

  FR-012                  Dashboard supports filters by date,      Should
                          asset, location, status, and priority

  FR-013                  Reports can be exported by authorized    Should
                          users

  FR-014                  Mobile app supports draft capture and    Should
                          upload retry

  FR-015                  Offline drafts can sync safely when      Could
                          connectivity returns

  FR-016                  Model registry records version,          Must
                          checksum, evaluation status, and
                          approval

  FR-017                  Admin can configure approved detection   Should
                          classes and thresholds

  FR-018                  System records user feedback for model   Must
                          evaluation, not automatic retraining
  ----------------------------------------------------------------------------------------

## 8. Non-Functional Requirements

-   **Security:** TLS in transit, encryption at rest, least privilege,
    secure session handling, audit logging, secrets management.
-   **Privacy:** Minimize personal data; avoid face recognition; apply
    retention and access controls to media.
-   **Reliability:** Retry-safe uploads and jobs; idempotent APIs;
    graceful handling of AI worker failure.
-   **Performance:** UI should remain responsive while inference runs
    asynchronously. Targets must be defined after workload testing.
-   **Scalability:** Separate API, queue, object storage, and inference
    workers so each can scale independently.
-   **Usability:** Clear distinction between AI suggestion and
    human-verified finding.
-   **Maintainability:** Versioned APIs, automated tests, documented
    deployment, and migration scripts.
-   **Auditability:** Record security-relevant actions and all material
    changes to findings.
-   **Accessibility:** Keyboard navigation, readable contrast, scalable
    text, and clear status labels.

## 9. Data Requirements

Core entities: - User, Role, Permission, OrganizationalScope - Asset,
Location, AssetCategory - Inspection, InspectionMedia - AIJob,
ModelVersion, Detection - Finding, ReviewDecision - WorkOrder,
Assignment, WorkOrderUpdate - Comment, Attachment - AuditEvent,
Notification

Location precision must follow KCIC policy. Do not expose sensitive
coordinates or detailed infrastructure maps to unauthorized users.

## 10. Reporting Requirements

-   Inspection volume by period/site/asset.
-   Findings by human-verified category and status.
-   Open work items and aging.
-   Review and closure lead times.
-   AI evaluation metrics by model version and class.
-   Failed uploads and inference jobs.
-   Audit report for selected records.

Reports must label AI-generated and human-verified data separately.

## 11. Assumptions and Dependencies

-   KCIC appoints business owner and authorized technical reviewers.
-   KCIC supplies or approves inspection procedures, asset taxonomy,
    defect terminology, location scheme, and severity rules.
-   A legally and operationally approved dataset is available for model
    training/evaluation.
-   Hosting, identity provider, data residency, retention, and
    integration decisions are approved by KCIC IT/security.
-   Any use of live railway images or infrastructure data is explicitly
    authorized.
-   Model licensing and third-party dependency terms are reviewed.

## 12. Risks and Mitigations

  -----------------------------------------------------------------------
  Risk                    Impact                  Mitigation
  ----------------------- ----------------------- -----------------------
  Inaccurate AI detection Missed or false         Human review,
                          findings                representative test
                                                  data, per-class
                                                  metrics, explicit
                                                  limitations

  Dataset bias / poor     Unreliable results in   Data governance,
  coverage                unseen conditions       diverse approved
                                                  samples,
                                                  out-of-distribution
                                                  warning

  Unauthorized media      Security and privacy    Private storage, scoped
  exposure                incident                access, encryption,
                                                  signed short-lived
                                                  downloads

  Incorrect location      Misrouted follow-up     Validate location
  metadata                                        against approved asset
                                                  register

  Network interruption    Lost or duplicate       Drafts, resumable
                          submissions             uploads, idempotency
                                                  keys

  Model drift             Degraded detection      Monitoring, periodic
                          quality                 evaluation, controlled
                                                  rollback

  Unsafe operational      Safety risk             No safety clearance
  interpretation                                  output; authorized
                                                  human disposition only
  -----------------------------------------------------------------------

## 13. Acceptance Criteria

The MVP is accepted for controlled demonstration when: 1. Authorized
users can sign in and are restricted to permitted scopes. 2. An
inspector can submit an inspection with evidence and metadata. 3. An AI
job can process an approved sample and return versioned detections. 4. A
reviewer can confirm, reject, or mark a suggestion inconclusive. 5. A
confirmed finding can be assigned, updated, and closed through an
authorized workflow. 6. All material actions produce attributable audit
events. 7. Unauthorized users cannot retrieve media or records by
guessing IDs or URLs. 8. Automated tests cover authorization, upload
validation, workflow transitions, and audit behavior. 9. The UI clearly
states that AI output is advisory. 10. The demonstration uses synthetic,
public, or explicitly approved data.

## 14. Open Decisions for KCIC

-   Which infrastructure asset categories and visual defect classes are
    approved?
-   Which inspection standards and human approval roles govern each
    class?
-   What is the approved location referencing scheme?
-   Is the deployment on-premise, private cloud, or another approved
    environment?
-   Which identity provider and SSO method are required?
-   What are data classification, retention, residency, and backup
    requirements?
-   What media sources and capture devices are permitted?
-   What are the approved model evaluation thresholds and release gates?
-   Which system integrations, if any, are authorized?
