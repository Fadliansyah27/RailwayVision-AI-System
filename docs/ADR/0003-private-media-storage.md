# ADR-0003 — Private media storage and upload flow

Status: Accepted

## Context
Evidence imagery may contain restricted infrastructure and incidental personal data. SECURITY_AGENT.md forbids public buckets, long-lived URLs, trusting client filenames, and storing sensitive media in logs. Production storage platform is an open KCIC decision.

## Decision
- S3-compatible private storage; MinIO in local Compose, production bucket per approved platform.
- Two-phase upload: server-issued short-lived upload URL for a server-generated object key in a quarantine prefix, then explicit `complete` call that validates size, declared MIME, file signature, and SHA-256 before marking media eligible.
- Downloads use short-lived presigned URLs issued only after authentication + role + scope checks. No bucket listing, no public ACLs.
- Original evidence is stored immutable; annotations/thumbnails are stored as separate derivatives. Integrity hash recorded per object.
- EXIF/GPS stripping on derivatives unless KCIC explicitly approves metadata retention.

## Consequences
- Requires clock discipline and URL expiry tests (Phase 3, 8).
- Supported local uploads depend on browser/Flutter presigned PUT support; if unreliable, an authenticated upload proxy path is added without changing the data model.
- Storage keys never appear in API responses or logs.
