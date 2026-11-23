# Final Test Report — RailwayVision AI (working tree, 2026-11-23)

Status: implementation and automated testing pass locally. Publication to GitHub is
`BLOCKED_GITHUB_AUTH` (no remote, no `gh`, target repository not found).
This is not a production or KCIC acceptance report.

## Environment

Windows 10.0.26300, Python 3.13 (`.venv`), Node.js 24.22.1, Next.js 16.4.6,
Flutter 3.47.7. Unit/integration tests use ASGI + SQLite in-memory and widget tests with
injected in-memory stores. A separate live smoke test ran the Flutter `ApiClient` against
the local Docker Compose stack (all six services healthy at the time of the run).

## Automated results (executed, not inferred)

| Area | Command | Result |
|---|---|---|
| API tests | `python -m pytest -q` in `services/api` | **77 passed** |
| API lint | `ruff check app tests` | 0 findings |
| AI worker tests | `python -m pytest -c pyproject.toml -q` | **8 passed** |
| Web typecheck | `npx tsc --noEmit` | Pass |
| Web lint | `npm run lint` | Pass |
| Web unit tests | `npm test` | **38 passed / 5 files** |
| Flutter analysis | `flutter analyze` | 0 issues |
| Flutter tests | `flutter test` | **11 passed / 4 files** (+1 live test skipped without credentials) |
| Flutter live API smoke | `flutter test test/live_api_test.dart` with `.env` credentials against Compose | **1 passed** — login, readiness (database/redis), scoped inspections, detail, work orders, assets, logout |
| Flutter web build | `flutter build web --release` | Success (`build/web`) |

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

## Publication blockers

1. No Git remote; `gh` CLI absent.
2. `git ls-remote https://github.com/Fadliansyah27/RailwayVision-AI.git` returns
   "Repository not found" (repository absent or inaccessible).
3. Creating the target public repository requires an authenticated token with `repo`
   scope or `gh auth login`.

Owner authorization for public release was given in the request; the remaining blocker
is technical authentication, not permission.
