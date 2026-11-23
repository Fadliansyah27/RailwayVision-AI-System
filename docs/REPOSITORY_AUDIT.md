# Repository Audit — RailwayVision AI

Audit date: 2026-11-23
Auditor role: implementation agent (architecture, backend, AI, security, DevOps)
Scope: local workspace only. No KCIC or third-party infrastructure was contacted or tested.

## 1. Inventory

| Item | Finding |
|---|---|
| Source code | **None.** Repository contained documentation only (15 Markdown files). |
| Version control | Not a git repository at audit time. `git init` performed with the user's build request; no commits created. |
| Tests | None. |
| Build tooling | None. |
| Environment examples | None. |
| Deployment assets | None (runbook describes intent only). |
| Documentation | BRD, AGENT, SECURITY_AGENT, ARCHITECTURE, UI_UX_DESIGN, PRODUCT_REQUIREMENTS, DATA_DICTIONARY, API_SPECIFICATION, AI_DATASET_MODEL_GOVERNANCE, TEST_PLAN, DEPLOYMENT_RUNBOOK, DECISIONS_AND_OPEN_QUESTIONS, MASTER_PROMPT, README, README_PACKAGE. |

Consistency check of the documents: the documents are internally consistent on product boundaries (advisory AI, mandatory human review, no train-control integration, private media, synthetic data until authorized). No conflicting requirements were found that block foundation work. The API specification, data dictionary, and architecture use the same core entity names.

## 2. Environment baseline (local development machine)

| Tool | Version | Status |
|---|---|---|
| Python | 3.13.3 (`py` launcher; `python` alias not on PATH) | Available |
| pip | 25.0.1 | Available via `py -m pip` |
| Node.js | 22.15.0 | Available |
| npm | 11.4.2 | Available |
| Docker Engine | 29.9.3 | Running |
| Docker Compose | v5.7.0 | Available |
| Flutter | 3.47.7 (stable), Dart 3.13.5 | Available |
| Android toolchain | SDK 37.0.0-rc2 | Available |
| Chrome | Installed | Available (web target for Flutter) |
| Visual Studio C++ workload | Not installed | Blocks Flutter **Windows desktop** target only; not required (mobile/web are the targets) |
| Git | 2.56.0 | Available |
| Local PostgreSQL / Redis CLI | Not installed | Not required; provided via Docker Compose |
| `uv` / `poetry` | Not installed | Not required; standard venv + pip used |

## 3. Requirement validation

### 3.1 Validated and adopted

- Decision-support scope, no safety verdicts, no train-control integration.
- Human review mandatory before an AI suggestion becomes a finding.
- Role + organizational scope authorization enforced server-side.
- UUID identifiers, UTC timestamps, idempotency, audit trail.
- Private object storage with short-lived presigned URLs; original media immutable, annotations are derivatives.
- AI metadata: model name/version, checksum, class-map version, thresholds, inference time, input hash.
- Synthetic/demo data only until authorized.

### 3.2 Assumptions adopted for the prototype (documented, reversible)

| # | Assumption | Rationale | Reversal point |
|---|---|---|---|
| A1 | Local username/password auth behind an identity-provider abstraction (`IdentityProvider` interface) for the demo | No KCIC IdP is available or approved; the BRD leaves IdP open | Phase 2 ADR-0002; replace adapter when KCIC selects IdP/OIDC |
| A2 | MinIO as S3-compatible private storage locally | Security requirements demand private S3-style storage; MinIO is the standard local stand-in | Phase 8 deployment decision; production bucket per KCIC platform |
| A3 | Celery + Redis for async inference | Required by AGENT.md as an acceptable queue/worker; supports retries, acks, duplicate-safety | Phase 4; swap broker/worker only with documented rationale |
| A4 | Demo defect classes limited to clearly labeled illustrative classes | AGENT.md forbids inventing KCIC defect taxonomy | Replace after KCIC engineering approval of taxonomy |
| A5 | Single-tenant organization scope model with hierarchical scopes (`scopes` table, scope_id on controlled records) | Data dictionary specifies scopes; multi-tenant isolation not requested | Extend if KCIC requires multi-tenant separation |
| A6 | Docker Compose is the local dev/deployment vehicle for the prototype | Explicit in MASTER_PROMPT | Phase 8 runbook for target environment |
| A7 | Timezone storage UTC, display local | Explicit non-functional requirement | — |

### 3.3 Blocking external decisions (not resolvable by the agent)

These do **not** block the foundation but block production/pilot use:

1. Approved identity provider, SSO method, MFA policy (BRD §14).
2. Hosting, network zones, data residency, retention, deletion policy.
3. Approved asset taxonomy, visual defect classes, severity rules, reviewer qualifications.
4. Dataset authorization and model release gates.
5. Authorized integrations, if any.
6. Location referencing scheme and permitted coordinate precision.
7. Named business, security, model, and operations owners.

The system will display these as configurable placeholders / documented limitations, never as invented KCIC policy.

### 3.4 Product requirement gaps identified

| Gap | Handling |
|---|---|
| No file size/MIME limits specified | Configurable via env; defaults documented and conservative (images 15 MB, video 200 MB, allowlisted MIME). To be confirmed. |
| No retention periods specified | Not implemented; documented limitation until KCIC policy exists. |
| No SLA numbers | None invented; performance section marked "to be measured". |
| No severity taxonomy | Priority codes are configurable seed placeholders labeled DEMO. |
| No IdP | Local demo auth with abstraction (A1). |
| "Notifications" delivery channel unspecified | In-app notification records only; no email/SMS integration in scope. |

## 4. Risks identified for delivery

| Risk | Impact | Mitigation |
|---|---|---|
| Scope is very large (web + mobile + AI + infra) | Incomplete/demo-quality surface | Strict phase gates; every phase verified before proceeding; no fake features |
| YOLO not pre-installed; model weights must be reproducible | AI phase could stall | Phase 4: pinned Ultralytics version, small demo model trained on synthetic shapes, checksum recorded, CPU inference |
| Python 3.13 + heavy AI libs compatibility | Dependency install failures | Isolate AI extras in worker image only; API stays light |
| Local machine lacks PostgreSQL/Redis CLI | Manual verification friction | Compose healthchecks + API readiness endpoint + automated integration tests |
| Windows filesystem + Docker mounts | Slow/broken bind mounts | Source-mounted dev containers only where needed; production-like images use baked code |
| No KCIC approvals | Risk of implying official status | Persistent demo banners, docs disclaimers, configurable placeholders |

## 5. Security posture at audit time

- No secrets present in the documentation package (checked for credential patterns; none found).
- No code, hence no vulnerable application code; dependency and container scanning begin with Phase 1 CI.
- No KCIC systems were touched; no scanning or testing was performed outside the local workspace.

## 6. Conclusion

The repository is a clean documentation baseline. Foundation work (Phase 1) can proceed using the technology baseline and documented assumptions. All KCIC-specific policy decisions remain open and are tracked in `docs/DECISIONS_AND_OPEN_QUESTIONS.md` (extended) and in Phase reports.
