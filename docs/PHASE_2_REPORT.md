# Phase 2 Report — Authentication, RBAC, Scopes, Audit Trail

Date: 2026-11-23
Release: `0.2.0` (working tree; no git commit created)
Environment: local Docker Compose stack (`railwayvision`), PostgreSQL 16, Redis 7.4.

## 1. Summary

Phase 2 is complete for the local prototype scope. The API now enforces authentication,
role permissions, and organizational scopes server-side; the web application has a real
sign-in flow, guarded routes, profile management, an administration console, and an audit
trail viewer. All Phase 2 data comes from PostgreSQL — no client-side mocks exist.

Status: **passed locally**, with the limitations listed in §10. No claim is made about
production readiness or KCIC validation.

## 2. Delivered scope

Authentication and session management
- Local identity adapter behind an `IdentityProvider` boundary (ADR-0002).
- Argon2id password hashing; HS256 access tokens (15 min) bound to a server-side session;
  opaque refresh tokens (7 days) stored only as SHA-256 digests.
- Refresh rotation on every `/auth/refresh`; logout revokes the session and clears the cookie.
- `HttpOnly`, `SameSite=Lax` refresh cookie (`rv_refresh`, path `/api/v1/auth`); optional
  body transport via `X-Refresh-Transport: body` for native clients.
- Login rate limiting: 5 attempts per 300 s per email digest (Redis).

Authorization
- Six roles: administrator, inspector/technician, engineering reviewer, supervisor,
  AI/ML engineer, auditor; 22 granular permissions.
- Permissions resolved from the database on every request; role changes apply immediately.
- Scope hierarchy (`scopes.path`) enforced with prefix matching: users can only read or
  modify records at or below their scope path.
- Self-protection rules: administrators cannot remove their own administrator role or
  deactivate their own account; administrator permissions are fixed.

Administration
- User directory with create, edit (name, scope, roles, active state), and deactivate.
- Role permission matrix with audit-recorded diffs.
- Scope listing and creation (hierarchical parent).
- Append-only audit events for login success/failure, logout, password change, user/role/
  scope changes, and inspection create/submit.

Assets and inspections (Phase 3 seed data, API-complete)
- Asset categories, locations, assets with scope filtering, search, status, and inspection
  history.
- Inspections with draft editing (optimistic `version`, 409 on conflict), submit, cancel,
  and assignment rules.

Web application
- `/login` with real API sign-in, cookie-based session restore, and explicit error states.
- Route group guarding all workspace pages; unauthenticated deep links redirect to `/login`.
- App shell shows the signed-in user, scope, and role; navigation is role-driven.
- `/administration` (users, roles/permissions, scopes), `/audit` (filter + pagination),
  `/profile` (name change, password change with global session revocation, sign-out).
- Overview now shows real audit activity; remaining KPIs stay empty until Phase 8.

## 3. Database changes

Migration `20261123_22f92c1d5602_identity_rbac_assets_inspections` (applied):
- `scopes`, `roles`, `permissions`, `role_permissions`, `user_roles`, `users`,
  `auth_sessions`, `audit_events`, `asset_categories`, `locations`, `assets`, `inspections`.
- Indexes on session token hash, audit actor/action/created_at, asset code/status/scope,
  inspection reference/asset/inspector/scope.

Seeded DEMO data (only when `APP_ENV=local` and `SEED_DEMO_DATA=true`):
- 3 seeded scopes (DEMO-KCIC, DEMO-NORTH, DEMO-SOUTH); a temporary DEMO-EAST scope was
  created during UI verification and later removed from the local database,
  6 permissions-bearing roles, 22 permissions, 6 demo users
  (`@demo.railwayvision.example`), 6 categories, 2 locations, 3 assets, 1 inspection.

## 4. API changes

24 paths are exposed. New in Phase 2:

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET/PATCH /auth/me`, `POST /auth/change-password` |
| Users | `GET/POST /users`, `GET/PATCH /users/{id}`, `POST /users/{id}/deactivate` |
| RBAC | `GET /roles`, `PATCH /roles/{id}/permissions`, `GET /permissions` |
| Scopes | `GET/POST /scopes` |
| Assets | `GET /asset-categories`, `GET /locations`, `GET/POST /assets`, `GET/PATCH /assets/{id}` |
| Inspections | `GET/POST /inspections`, `GET/PATCH /inspections/{id}`, `POST /inspections/{id}/submit`, `POST /inspections/{id}/cancel` |
| Audit | `GET /audit-events` |

Full request/response documentation: `docs/API_DOCUMENTATION.md`.

## 5. UI changes

- Login screen with DEMO account quick-fill, loading/error states, and session check.
- Guarded `(dashboard)` route group replacing the unauthenticated shell at `/`.
- App shell: authenticated identity, scope/role header, profile link, sign-out action,
  role-filtered navigation; Administration and Audit Trail unlocked for permitted roles.
- Administration console with three tabs and real forms; role matrix is read-only for the
  administrator role, matching the API rule.
- Audit trail table with action filter and pagination; audit errors (403) are shown without
  leaking data.
- Profile page with server-backed name update and password change (which revokes sessions).

## 6. Verification performed

Automated:
- API: `ruff check .` clean; `pytest -q` → **25 passed** (9 new Phase 2 tests covering
  login success/failure, rate limiting, refresh rotation, logout revocation, scope isolation,
  inspector 403 on asset creation, inspection draft→submit→409 lifecycle, auditor read-only,
  admin user/role listing, audit records).
- Web: `eslint` clean; `tsc --noEmit` clean; `vitest` → **14 passed**; `next build` success
  with routes `/`, `/login`, `/administration`, `/audit`, `/profile`, `/system-status`.
- Worker: `ruff` clean; **5 passed**. Mobile: `flutter analyze` clean; **6 passed**.
- Total automated tests: **50 passed**.

Live integration (browser against `http://localhost:3000`):
- Unauthenticated `/` → `/login`; deep link `/administration` while signed out → `/login`.
- Admin sign-in → overview with real audit entries and `DEMO — Illustrative network · Administrator`.
- Administration lists all 6 seeded users with scope and roles; roles tab shows the 22-permission
  matrix; scopes tab lists the hierarchy.
- Scope creation `DEMO-EAST` posted successfully and appeared in the table.
- Auditor sign-in → audit page lists 12 live events; action filter `inspection.created` returns 1.
- Inspector direct access to `/administration` and `/audit` → "Insufficient permission." (API 403),
  despite the URL being typed directly.
- Sign-out returns to `/login`; the revoked access token subsequently fails `/auth/me` (401,
  "Session is no longer valid.").
- Full page reload on `/profile` restored the session through the refresh cookie.

Evidence note: the Qoder in-app browser surface was hidden, so image screenshots could not be
captured in this phase. Verification evidence is the accessibility-tree snapshots captured
during the checks above. Phase 1 screenshots remain under `docs/screenshots/`.

## 7. Security checks performed

- Argon2id hashes only; no plaintext or reversible password storage.
- Refresh tokens stored as digests; rotation invalidates the previous token (tested).
- Session revocation on logout, deactivation, and password change (tested for logout).
- Rate limiting on repeated failed logins → 429 (tested).
- Server-side RBAC and scope checks on every request; UI hiding is not treated as control
  (direct-URL verification in the browser).
- Cross-scope asset reads return 404, not 403, to avoid existence disclosure (tested).
- Validation responses no longer echo rejected input values.
- No secrets committed; demo credentials are local-only and labelled DEMO.

## 8. Documentation updated

`docs/IMPLEMENTATION_STATUS.md`, `docs/CHANGELOG.md`, `docs/API_DOCUMENTATION.md`,
`docs/TEST_REPORT.md`, `docs/SECURITY_AUDIT_REPORT.md`, `docs/KNOWN_LIMITATIONS.md`,
and this report.

## 9. Blockers encountered

- Demo emails using `.local` were rejected by `email-validator` → switched to
  `@demo.railwayvision.example` and migrated existing rows.
- Autogenerated migration needed formatting/line-length fixes → `ruff format` applied.
- React 19 lint rule against synchronous state updates in effects → fetch-on-mount
  callbacks restructured; two intentional disables documented inline.

No blocker requires a stakeholder decision to continue Phase 3.

## 10. Limitations (must not be overstated)

- No MFA, password self-service reset, or account recovery flow.
- Refresh-token reuse detection (token-family revocation) is not implemented; rotation only.
- Login rate limiting fails open if Redis is unavailable (availability trade-off).
- No CSRF token; protection relies on `SameSite=Lax`, JSON-only bodies, and CORS allowlisting.
- DEMO data only. No KCIC identity provider, role model, or scope hierarchy has been approved.
- No inventory of sessions/devices for end users (administrator sees users, not sessions).
- Not validated for safety inspection. AI remains unimplemented.

## 11. Next phase

Phase 3 (web): asset register and inspection capture UI against the already-implemented API —
list/filter/detail, create draft, edit with version conflict handling, submit, inspection
history, and honest empty/loading/error states.

## 12. Phase 2 gate

**Passed locally.** Blocking gate for Phase 4 media/AI remains: no dataset, model artifact,
or KCIC authorization exists; those features will be implemented only as clearly labelled
DEMO pipelines with no accuracy claims.
