# UI/UX Design Specification

## RailwayVision AI

## 1. Design Direction

Create a professional enterprise inspection platform: operational,
precise, calm, and easy to scan. The visual language should communicate
traceability and engineering review, not imply automated safety
certification.

### Proposed design tokens

These are product design suggestions, not official KCIC brand
standards: - Primary: deep railway red `#C61F33` (confirm brand approval
before production). - Ink: `#17212B`. - Secondary text: `#667085`. -
Canvas: `#F5F7FA`. - Surface: `#FFFFFF`. - Border: `#E4E7EC`. - Success:
`#16845B`. - Warning: `#B7791F`. - Critical priority: `#B42318`. - AI
suggestion: violet/blue accent, visually distinct from human
verification.

Use color plus text/icon labels; never rely on color alone. Follow WCAG
contrast guidance.

## 2. Information Architecture

### Web navigation

1.  Overview
2.  Inspections
3.  Findings
4.  Work Orders
5.  Assets & Locations
6.  AI Model Registry (restricted)
7.  Reports
8.  User & Role Administration (restricted)
9.  Audit Trail (restricted)
10. Settings

### Mobile navigation

1.  Home
2.  My Inspections
3.  Capture
4.  Findings / Assigned Work (role-dependent)
5.  Profile

## 3. User Journeys

### Inspector

Login -\> Home -\> Select asset -\> Start inspection -\> Capture/upload
evidence -\> Add notes -\> Submit -\> View processing status.

### Reviewer

Login -\> Review queue -\> Open inspection -\> Compare original and AI
overlay -\> Inspect each suggestion -\>
Confirm/reject/reclassify/inconclusive -\> Add rationale -\> Submit
review.

### Supervisor

Login -\> Dashboard -\> Review outstanding findings -\> Assign work -\>
Monitor progress -\> Verify completion -\> Close according to
permission.

## 4. Web Screens

### 4.1 Overview Dashboard

Layout: - Header: product name, current role/scope, notification,
profile. - KPI cards: inspections this month, pending review, open
findings, overdue work orders. - Trend chart: inspections over time. -
Status chart: draft/submitted/processing/reviewed. - Priority list:
human-verified open findings. - Recent activity table.

Important: Do not combine unreviewed AI detections with verified
findings in a single KPI without explicit labels.

### 4.2 Inspection List

Columns: - Inspection ID - Asset code - Location label
(scope-controlled) - Submitted by - Observed time - AI processing
status - Human review status - Last updated - Action

Filters: - Date range - Asset category - Location (authorized scope
only) - Inspection status - Reviewer - AI job status

### 4.3 Inspection Detail

Two-column desktop layout: - Left: original image/video, zoom, frame
navigation. - Right: AI overlay toggle, detection list, model version,
confidence, inference time. - Below: inspector notes, asset metadata,
activity timeline, review controls.

Use persistent notice: "AI-generated suggestions are preliminary and
require review by an authorized inspector."

Review actions: - Confirm suggestion - Reject suggestion - Reclassify -
Mark inconclusive - Add manual finding

Require rationale for material reclassification/rejection where policy
requires it.

### 4.4 Finding Detail

Show: - Finding reference - Asset/location - Human-verified category -
Priority assigned by authorized reviewer - Status and owner - Original
and supporting evidence - Review history - Work order history - Comments
and audit timeline

Do not display a model confidence score as a severity score.

### 4.5 Work Order Board

Use table or Kanban view: - Open - Assigned - In progress - Awaiting
verification - Closed

Each card shows work order ID, finding reference, assignee, due date,
and priority. Permissions govern assignment and closure.

### 4.6 Model Registry

Restricted to AI/ML roles: - Model name/version - Artifact checksum -
Class map version - Dataset lineage reference - Evaluation metrics -
Approval state - Deployment date - Rollback action

A model cannot be deployed solely because training completed.

## 5. Mobile Screens

### 5.1 Home

-   Greeting and role.
-   Assigned inspections.
-   Draft inspections.
-   Pending uploads.
-   Quick action: Start Inspection.
-   Small summary of assigned open work.

### 5.2 Asset Selection

-   Search by approved asset code.
-   QR/barcode scan if approved.
-   Show only assets within the user's authorized scope.
-   Confirm asset identity before capture.

### 5.3 Capture Inspection

-   Camera capture or approved gallery selection.
-   Image preview and retake.
-   Notes and inspection type.
-   Capture timestamp.
-   Location metadata only if approved and available.
-   Upload progress and retry.
-   Clear warning if offline.

### 5.4 AI Processing

Show stages: `Uploaded -> Queued -> Processing -> Ready for Review`.

If processing fails, provide retry or support reference. Do not imply
that no defect was found when inference failed.

### 5.5 Review / Finding

For authorized reviewers: - Original image and overlay switch. -
Detection cards. - Class and confidence. - Model version. -
Confirm/reject/reclassify/inconclusive actions. - Required rationale and
submit confirmation.

### 5.6 Profile and Security

-   User identity and assigned role.
-   Current organizational scope.
-   App version.
-   Privacy and data handling notice.
-   Sign out.
-   Session/device guidance where supported.

## 6. Component Library

-   Status chip: Draft, Submitted, Processing, AI Failed, Under Review,
    Reviewed.
-   Evidence viewer with overlay toggle.
-   Detection card.
-   Human verification badge.
-   Priority chip.
-   Asset selector.
-   Upload progress panel.
-   Activity timeline.
-   Empty, loading, error, offline, and retry states.
-   Confirmation dialog for destructive or irreversible actions.

## 7. Interaction and Accessibility

-   Use clear labels and descriptive button text.
-   Minimum touch target approximately 44x44 CSS px where practical.
-   Keyboard-operable web controls.
-   Visible focus states.
-   Do not communicate status using color alone.
-   Use readable typography and scalable text.
-   Confirm destructive actions.
-   Preserve form drafts after recoverable failures.
-   Show timezone explicitly where timestamps may be ambiguous.
-   Support screen readers with semantic labels.

## 8. Responsive Layout

-   Desktop: full dashboard, split inspection viewer, dense data tables.
-   Tablet: collapsible navigation, stacked KPI cards, simplified
    inspection viewer.
-   Mobile: single-column workflow, large capture action, bottom
    navigation.

## 9. Sample Dashboard Wireframe

``` text
+--------------------------------------------------------------+
| RailwayVision AI        Scope: Assigned Area     User/Profile |
+------------------+-------------------------------------------+
| Overview         | Overview                                  |
| Inspections      | +-------------+ +-------------+            |
| Findings         | | Inspections | | Pending     |            |
| Work Orders      | | This Month  | | Review      |            |
| Assets           | +-------------+ +-------------+            |
| Reports          | +-------------+ +-------------+            |
|                  | | Open        | | Overdue     |            |
|                  | | Findings    | | Work Orders |            |
|                  | +-------------+ +-------------+            |
|                  |                                           |
|                  | Inspection Trend     Finding Status       |
|                  |                                           |
|                  | Recent Inspections                        |
|                  | ID | Asset | Status | Reviewer | Action   |
+------------------+-------------------------------------------+
```

## 10. Design Acceptance Checklist

-   AI suggestions and human-verified findings are unmistakably
    different.
-   Original evidence is always accessible to authorized reviewers.
-   Model version and inference timestamp are visible.
-   No "safe/unsafe" AI verdict exists.
-   Users only see authorized assets and locations.
-   Every workflow has loading, empty, error, and retry states.
-   Mobile capture works with intermittent connectivity without losing
    drafts.
-   Keyboard and screen-reader basics are supported.
