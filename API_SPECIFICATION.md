# API Specification — Proposed REST Contract
Base path: `/api/v1`. JSON over HTTPS. OpenAPI must be generated from implementation and treated as the source of truth.

## Conventions
- Authentication: approved OIDC/session mechanism.
- Authorization: server-side permission + scope checks on every resource.
- Pagination: `limit` (bounded) and opaque `cursor`.
- Errors: `{ "error": { "code": "...", "message": "...", "request_id": "..." } }`.
- Mutations: support `Idempotency-Key` where retries may duplicate actions.
- Use UTC ISO-8601 timestamps.
- Never return object storage keys or long-lived public URLs.

## Endpoint inventory
| Method | Path | Purpose |
|---|---|---|
| GET | /me | Current user and effective scopes |
| GET/POST | /assets | List/create authorized assets |
| GET/PATCH | /assets/{id} | Read/update asset |
| GET/POST | /inspections | List/create inspection |
| GET/PATCH | /inspections/{id} | Read/update draft or permitted fields |
| POST | /inspections/{id}/submit | Submit inspection |
| POST | /inspections/{id}/media-upload-session | Create short-lived upload capability |
| POST | /media/{id}/complete | Finalize and validate uploaded media |
| POST | /inspections/{id}/ai-jobs | Queue analysis using approved model |
| GET | /ai-jobs/{id} | Get processing status |
| GET | /inspections/{id}/detections | List AI suggestions |
| POST | /detections/{id}/review | Record reviewer decision |
| POST | /inspections/{id}/findings | Create manual finding |
| GET/PATCH | /findings/{id} | Read/update permitted finding fields |
| POST | /findings/{id}/work-orders | Create follow-up work order |
| POST | /work-orders/{id}/assign | Assign work order |
| POST | /work-orders/{id}/updates | Add progress update |
| POST | /work-orders/{id}/verify | Verify/close under policy |
| GET | /dashboard/summary | Scope-filtered dashboard |
| GET | /reports/inspections | Authorized report |
| GET | /audit-events | Authorized audit search |
| GET/POST | /models | Model registry metadata |
| POST | /models/{id}/approval | Controlled approval workflow |

## Upload protocol
1. Client asks backend for upload session with inspection ID, media metadata, and checksum if available.
2. Backend validates permission and returns short-lived capability for private quarantine storage.
3. Client uploads directly to storage or through approved gateway.
4. Client calls complete endpoint.
5. Backend verifies object existence, size, signature, checksum, and scanning/transcoding status.
6. Only validated media becomes eligible for AI jobs.

## Review decision payload example
```json
{
  "decision": "confirmed",
  "rationale": "Reviewed by authorized inspector",
  "human_category": "approved_configured_category"
}
```

Allowed decision values must be server-enforced and configured. Do not permit client to set reviewer identity, role, finding priority, or approval state.

## Security contract tests
For every resource endpoint, test unauthenticated access, wrong role, wrong scope, guessed UUID, changed owner ID, stale state, oversized request, and repeated idempotency key.
