# Final Test Report — RailwayVision AI (working tree, 2026-11-23)

Status: implementation and automated testing pass locally. Published to GitHub Public on
2026-11-23 at <https://github.com/Fadliansyah27/RailwayVision-AI-System> (renamed from
`Fadliansyah27` at the owner's request; commit `6034a33`).
This is not a production or KCIC acceptance report.

## Environment

Windows 10.0.26300, Python 3.13 (`.venv`), Node.js 24.22.1, Next.js 16.4.6,
Flutter 3.47.7. Unit/integration tests use ASGI + SQLite in-memory and widget tests with
injected in-memory stores. A separate live smoke test ran the Flutter `ApiClient` against
the local Docker Compose stack (all six services healthy at the time of the run).

## Automated results (executed, not inferred)

| Area | Command | Result |
|---|---|---|
| API tests | `python -m pytest -q` in `services/api` | **83 passed** |
| API lint | `ruff check app tests alembic` | 0 findings |
| AI worker tests | `python -m pytest -c pyproject.toml -q` | **8 passed** |
| Web typecheck | `npx tsc --noEmit` | Pass |
| Web lint | `npm run lint` | Pass |
| Web unit tests | `npm test` | **39 passed / 5 files** |
| Flutter analysis | `flutter analyze` | 0 issues |
| Flutter tests | `flutter test` | **11 passed / 4 files** (+1 live test skipped without credentials) |
| Flutter live API smoke | `flutter test test/live_api_test.dart` with `.env` credentials against Compose | **1 passed on the previous run** — login, readiness (database/redis), scoped inspections, detail, work orders, assets, logout |
| Flutter web build | `flutter build web --release` | Success (`build/web`) |
| Browser checks | browser-use against Compose | `/operations` tabs rendered for administrator; header shows `Sintetis — Jaringan ilustratif`; screenshots in `docs/screenshots/` |

Fase D additions covered by tests: operations-console RBAC (inspector denied logs/deployments/
backup/reset but allowed scoped AI jobs), log redaction of passwords and bearer tokens,
scope-filtered AI job history, deployment operator/audit recording and `APP_ENV` rejection,
backup status transitions (`not_configured`, `unavailable`, `invalid`, `stale`, `ok`), reset
phrase/environment guards and row-limited deletion, and `seed_rbac` permission reconciliation.

Flutter tests cover: signed-out login gate, sign-in into the Indonesian shell with live
readiness/workload text, unreachable-API retry state, readiness summarization/parsing, and
work orders (list, empty state, missing-permission guard, start transition with confirmation,
and client-side note validation).

## Security checks performed

- `git ls-files` review: no tracked `.env`, keys, certificates, dumps, models, media, or
  dataset directories.
- Pattern scan of tracked files: no private keys, AWS/GitHub/OpenAI-style tokens, or
  non-placeholder secrets. `.env.example` contains `change-me-*` placeholders only.
- `git diff --check`: clean (only LF→CRLF notices).
- **Gitleaks was not available** (`command not found`); no gitleaks result is claimed.
  Run gitleaks or enable GitHub push protection before relying on public exposure.

## Not tested / not claimed

- Flutter on-screen UI end-to-end automation and physical-device camera capture (the live
  smoke covers the app's networking layer only).
- Signed Android/iOS builds; background sync; push notifications.
- Any AI detection, accuracy, dataset, or KCIC acceptance claim.

## Publication outcome

1. Public repository created as `Fadliansyah27/Fadliansyah27` (owner request) on
   2026-11-23, then renamed by the owner's request to
   `Fadliansyah27/RailwayVision-AI-System`; visibility verified `public` via the
   GitHub API after the rename.
2. `git push -u origin main` succeeded without force push; remote and local `main`
   both point to `435bfd021dc887ddb65b8eb2586a9a5760faac99`.
3. Manual secret-pattern scan and tracked `.env`/key file checks were clean at push
   time. Gitleaks was not available; no gitleaks result is claimed.
4. Owner authorization for public release was given explicitly in the request; the
   earlier authentication blocker was resolved using the existing GitHub credential
   without exposing its value.
