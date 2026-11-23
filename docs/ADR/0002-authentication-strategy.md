# ADR-0002 — Authentication strategy for the prototype

Status: Accepted, pending KCIC IdP decision

## Context
BRD requires authentication through "the approved identity provider" and lists the IdP choice as an open KCIC decision. No IdP is available. A prototype cannot ship unauthenticated endpoints, and building directly against a guessed IdP would create rework.

## Decision
- Define an `IdentityProvider` abstraction in the backend with a local credential adapter for the demo (Argon2id password hashing, short-lived JWT access tokens, rotating refresh tokens, revocation, rate-limited login).
- Authorization is always derived from server-side user/role/scope records — never from token claims alone for roles/scopes.
- When KCIC selects an IdP, implement an OIDC adapter behind the same abstraction; business authorization layers remain unchanged.
- MFA, SSO, password policy, and session lifetime values are configuration placeholders until approved.

## Consequences
- Demo credentials exist only in local seed data (clearly marked DEMO) and are refused in non-local environments unless explicitly enabled.
- The local adapter must be reviewed as security-sensitive code (Phase 2 and Phase 8).
- Token storage on mobile uses platform secure storage (Phase 6).
