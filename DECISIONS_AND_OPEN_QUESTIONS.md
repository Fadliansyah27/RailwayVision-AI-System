# Architecture Decisions & Stakeholder Questions

## Proposed decisions (subject to review)
| ID | Proposed decision | Reason | Must confirm |
|---|---|---|---|
| ADR-001 | Web Next.js + TypeScript | Mature dashboard ecosystem | IT standards |
| ADR-002 | Flutter for field mobile | Cross-platform capture workflow | Device policy |
| ADR-003 | FastAPI backend | Python ecosystem integration | API/platform standards |
| ADR-004 | PostgreSQL | Relational workflow integrity | Managed DB/platform |
| ADR-005 | Async inference queue | Long-running AI must not block API | Infrastructure capacity |
| ADR-006 | Private object storage | Evidence confidentiality | Approved storage |
| ADR-007 | Human verification mandatory | Prevent automated safety decisions | Engineering workflow |
| ADR-008 | No train-control integration | Keep prototype outside safety-critical domain | Architecture authority |

## Questions requiring KCIC answers
1. Which asset categories are in scope for the pilot?
2. Which visual defect/condition classes are approved by infrastructure engineering?
3. Which inspection procedures, standards, and reviewer qualifications apply?
4. What location referencing and coordinate precision are permitted?
5. Which organizational scopes and roles are required?
6. Which identity provider/SSO and MFA policy apply?
7. What media devices, capture conditions, and file limits are allowed?
8. What data classification, retention, residency, and deletion policy applies?
9. Where may the system be hosted and which network zones are allowed?
10. Is offline mobile capture required?
11. What model performance gates and independent review are acceptable?
12. What integrations are authorized, if any?
13. Who owns business acceptance, model approval, security approval, and operations?
14. What pilot duration, user group, and success metrics are agreed?

Do not silently resolve these questions through assumptions. Use synthetic/demo configuration until approved.
