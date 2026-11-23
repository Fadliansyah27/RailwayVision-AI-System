# Phase 3 Report — Asset Register and Inspection Capture UI

Date: 2026-11-23
Release: `0.3.0` (working tree; no git commit created)
Environment: local Docker Compose stack (`railwayvision`), PostgreSQL 16, Redis 7.4, MinIO 2025.7.23.

## 1. Summary

Phase 3 is complete for the local prototype scope. The asset register and the inspection
capture workflow are now real web screens backed by the Phase 2 API and PostgreSQL — lists,
filters, detail pages, asset creation/editing, draft inspections, optimistic versioning,
submission, and inspection history. No client-side mocks were added and no endpoint was
faked.

Status: **passed locally**, with the limitations listed in §10. This is a documentation
workflow only: an inspection remains evidence of observation, not a safety clearance.

## 2. Delivered scope

Asset register (`/assets`)
- API-backed list with search (code/name), status and category filters, and pagination.
- Asset cards with code, DEMO badge when the code matches the DEMO convention, status,
  category, location, scope, and last-updated time.
- Registration form (`assets:write` only) with category/location selects and validation
  surfaced from the API (duplicate code `409`, out-of-scope location `422`).
- Explicit loading, empty, and error states; success notice after creation.

Asset detail (`/assets/[id]`)
- Scoped record view: code, status, category, location, scope, timestamps.
- `Edit asset` for `assets:write` holders; `New inspection` links to the draft form with
  the asset preselected.
- Recent inspection history (latest 20) with status chips.
- 404 and unavailable states rendered as a card, not a blank page.

Inspection list (`/inspections`)
- Server-side status filter, "only mine" filter, pagination, DEMO labeling, and links to
  asset and inspection records.

Inspection capture (`/inspections/new`)
- Asset select limited to the caller's scope, preselection via `?asset=`, client-side
  `datetime-local` default (converted to UTC on submit), notes limit 4,000 characters.
- Permission-denied card when `inspections:write` is absent; no fake success paths.

Inspection detail (`/inspections/[id]`)
- Draft editing for the assigned inspector or `inspections:manage` holders, with the
  optimistic `version` sent on every save; `409` shows a "Reload latest version" action.
- Submit (`inspections:submit`) and cancel (`inspections:manage`) with explicit confirmation,
  server revalidation, and post-action history refresh.
- Read-only presentation after submission; record version (`v{n}`) is displayed.
- Inspection history from audit events when `audit:read` is held, with a non-audit lifecycle
  fallback (created/updated/status) otherwise.
- Evidence card states honestly that media and AI are not available on this build.

Navigation
- Inspections and Assets & Locations entries unlocked (Phase 3) for all roles that can read
  them; the web app never treats navigation visibility as authorization.

## 3. Database changes

None. Phase 3 consumes the Phase 2 schema and migration `22f92c1d5602`. No migration was
added or altered.

## 4. API changes

None. Phase 3 is a client of the existing endpoints:

| Use | Endpoint |
|---|---|
| Asset list/filter | `GET /api/v1/assets` (search, status, category_id, pagination) |
| Categories/locations | `GET /api/v1/asset-categories`, `GET /api/v1/locations` |
| Create/update asset | `POST /api/v1/assets`, `PATCH /api/v1/assets/{id}` |
| Asset detail + history | `GET /api/v1/assets/{id}` (`inspections`, `latest_inspection`) |
| Inspection list/filter | `GET /api/v1/inspections` (status, mine, asset_id) |
| Create/edit draft | `POST /api/v1/inspections`, `PATCH /api/v1/inspections/{id}` (`version`) |
| Lifecycle | `POST /api/v1/inspections/{id}/submit`, `POST /api/v1/inspections/{id}/cancel` |
| History | `GET /api/v1/audit-events` (`target_type=inspection`, `target_id`) |

The only API-adjacent change is deployment configuration: the browser now calls the web
origin, and Next.js rewrites `/api/v1/*` and `/health/*` to `API_PROXY_TARGET` (see §6).

## 5. UI changes

- New routes: `/assets`, `/assets/[id]`, `/inspections`, `/inspections/new`,
  `/inspections/[id]` inside the guarded dashboard group.
- Shared record primitives: DEMO badge, asset/inspection status chips, pagination footer.
- Shared domain helpers: status labels and tones, date formatting, `datetime-local`
  conversion, query-string building, and DEMO-record detection, covered by unit tests.
- Overview page updated to Phase 3 status with direct actions to the new screens.
- All forms use real API calls; buttons have defined behavior and honest failure states.
- Record pages state that AI and media are not implemented; nothing is simulated.

## 6. Verification performed

Automated:
- API: `ruff check .` clean; `pytest -q` → **25 passed** (no backend change this phase).
- Web: `eslint` clean; `tsc --noEmit` clean; `vitest` → **23 passed** (4 files, 9 new
  domain/navigation tests); `next build` success with the five new routes, then the Docker
  image rebuilt and the container re-created.
- Worker: **5 passed**. Mobile: `flutter analyze` clean; **6 passed**.
- Total automated tests: **59 passed** (25 API, 5 worker, 23 web, 6 mobile).

Live integration (browser against `http://127.0.0.1:3000`, DEMO accounts):
- Admin sign-in; full reload on `/assets` restored the session through the first-party
  refresh cookie (regression check for D-12).
- `/assets` listed the 3 seeded assets; creating `DEMO-AST-9001` returned the success notice
  and the list refreshed to 4; status filter "Retired" produced the empty state.
- Asset detail rendered the scoped record and inspection history; editing the status to
  "Out of service" persisted and showed the audit-recorded notice.
- `New inspection` from the asset detail preselected the asset; `INS-20261123-D70DC6` was
  created as a draft, saved (version 1 → 2), submitted (version 3), and became read-only with
  only the permitted cancel action.
- Inspection history listed `inspection.created`, `inspection.updated`, and
  `inspection.submitted` after submission (regression check for D-13).
- `/inspections` listed every record with the correct status chip and pagination label.
- Inspector sign-in: asset and inspection lists were limited to the North scope; `Register
  asset`, `Edit asset`, and `Cancel inspection` were absent; the history section fell back to
  lifecycle metadata without `audit:read`.
- Unknown asset ID rendered the "Asset unavailable / Asset not found." card.

Evidence note: the in-app browser still reports `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`, so no
screenshots were captured; verification evidence is accessibility-tree snapshots. Layout and
responsive behavior at arbitrary viewport sizes remain unverified (see §10).

Test data recorded during verification (a test asset, two test inspections, and a temporary
`DEMO-EAST` scope) was removed afterwards, leaving the seeded dataset: 3 scopes, 6 categories,
2 locations, 3 assets, 1 inspection.

## 7. Security checks performed

- The refresh cookie is now first-party: the browser only talks to the web origin, and the
  Next.js server proxies API calls, so `SameSite=Lax` is no longer defeated by hostname
  mismatch (this also fixed D-12). The API keeps its CORS allowlist for direct/native clients.
- Access tokens are still held only in React state; the proxy introduces no new token storage.
- Every new screen calls the API with the bearer token; RBAC and scope remain server-side.
  The inspector checks above confirm that hiding controls is presentation only — direct API
  access rules are covered by the Phase 2 tests, including cross-scope `404`.
- Asset and inspection fields are rendered as text through React escaping; notes are limited
  to 4,000 characters and never interpreted as HTML.
- Optimistic versioning prevents silent overwrite of a draft edited in another session; the
  UI requires an explicit reload after `409` rather than retrying blindly.
- Submit/cancel require confirmation and are revalidated server-side; the post-submit UI is
  read-only by both state and API rule.
- No new secrets, dependencies, or external origins were introduced. No KCIC infrastructure
  was accessed.

## 8. Documentation updated

`docs/IMPLEMENTATION_STATUS.md`, `docs/CHANGELOG.md`, `docs/API_DOCUMENTATION.md`,
`docs/TEST_REPORT.md`, `docs/SECURITY_AUDIT_REPORT.md`, `docs/KNOWN_LIMITATIONS.md`,
and this report.

## 9. Blockers encountered

- Browser session was dropped on reload because the page was served from `127.0.0.1` while
  the refresh cookie was scoped to `localhost`. Resolved with the same-origin rewrite proxy
  (no API behavior change).
- Inspection history did not refresh after submit because the audit query ran once on mount.
  Resolved with an explicit refresh key; verified live after rebuilding.
- TypeScript errors during development (`latest_inspection` requested from the list schema;
  optional asset in the editor) were fixed in code.

No blocker requires a stakeholder decision to continue Phase 4.

## 10. Limitations (must not be overstated)

- No asset deletion, QR labels, status-history timeline, or attachments; QR support requires
  KCIC approval.
- Asset updates are last-write-win; only inspection drafts are version-checked.
- No media capture/upload, no preview, no integrity hashing yet (Phase 4); the evidence card
  is explanatory only.
- No AI inference, model registry, or detection results of any kind; no accuracy claim is made
  and no suggestion is shown to users.
- Inspection history in the asset detail is capped at 20 entries; no full-text search over notes.
- No findings, review decisions, work orders, notifications, KPIs, or exports yet.
- The web app has no pagination inside asset detail history, no delete/archive, and no
  bulk actions.
- Responsive layout and cross-browser rendering were not visually verified (screenshots
  unavailable); accessibility was checked only through the accessibility tree.
- DEMO-only data. Operators must not enter real KCIC records until governance approval.
- Not validated for safety inspection and not to be represented as a safety clearance tool.

## 11. Next phase

Phase 4 — media management and the demo AI pipeline: MinIO buckets with private access,
presigned two-phase upload, MIME/signature validation, SHA-256 integrity hash, quarantine
handling, authorized retrieval/preview, media metadata in the database, and a clearly labeled
demo inference path with a model registry and **no accuracy claims**. The Phase 4 gate
requires that any model artifact used is a placeholder, that outputs are labeled as unvalidated
demo results, and that no KCIC infrastructure is touched without written authorization.

## 12. Phase 3 gate

**Passed locally.** The asset register and inspection capture flow are functional against the
real API and database, with server-enforced RBAC/scopes, honest empty/error/loading states,
and audit-recorded transitions. No claim is made about production readiness or KCIC
validation. Phase 4 media work can proceed as infrastructure only; any accuracy or
detection claim remains blocked until an authorized model artifact, dataset, and evaluation
protocol exist.
