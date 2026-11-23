# Deployment & Operations Runbook

## 1. Deployment prerequisites
- Approved hosting and network architecture.
- Approved identity provider and secret-management solution.
- Database, object storage, Redis, worker, and monitoring capacity.
- TLS certificates and DNS.
- Data classification, retention, backup, and incident procedures.
- Approved dataset/model artifacts.
- Named system owner, service owner, and escalation contacts.

## 2. Environment separation
Maintain separate local, test, staging, and production environments. Use separate credentials, storage buckets, databases, encryption keys, and identity clients. Never copy production media to development without explicit approval and de-identification controls.

## 3. Container services
Suggested services:
- web
- api
- postgres
- redis
- ai-worker
- object-storage (local development only; production storage per approved platform)
- reverse-proxy
- metrics/logging

Pin image versions, run as non-root, use read-only filesystems where practical, drop unnecessary Linux capabilities, define CPU/memory limits, and scan images.

## 4. Release sequence
1. Review changes and migration plan.
2. Run unit, integration, contract, security, and AI regression tests.
3. Build immutable artifacts and SBOM.
4. Scan dependencies and containers.
5. Back up database and verify restore readiness.
6. Deploy to staging.
7. Run smoke tests and role/scope checks.
8. Obtain required business, security, IT, and engineering approvals.
9. Deploy pilot release with rollback plan.
10. Monitor errors, queue depth, inference failures, latency, and audit pipeline.

## 5. Backup and recovery
Define RPO/RTO with the system owner. Back up database and required object metadata/media according to approved retention. Encrypt backups, restrict access, test restoration periodically, and document recovery evidence.

## 6. Incident response
- Detect and classify incident.
- Contain compromised account/service or exposed media.
- Preserve logs and evidence.
- Notify designated KCIC security/privacy contacts under approved procedure.
- Eradicate root cause, rotate credentials/keys, restore service.
- Validate integrity and authorization.
- Produce post-incident report and corrective actions.

## 7. Rollback
Maintain prior application image and database-compatible rollback strategy. Model rollback must restore prior approved model metadata and artifact. Do not delete previous model outputs or audit history. Database migrations must be backward-compatible where feasible; otherwise use an explicitly approved maintenance procedure.
