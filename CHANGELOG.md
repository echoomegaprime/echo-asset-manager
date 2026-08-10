# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Security

- **Fixed: every `GET` route was completely unauthenticated.** `authOk` was only checked for
  non-`GET` methods, so `/orgs`, `/users`, `/assets`, `/insurance`, `/dashboard`, and
  `/export?format=csv` (a full CSV dump of every asset's purchase price and current value)
  were reachable with no credentials at all, gated only by a per-IP rate limiter. Now every
  route past `/` and `/health` requires `authOk` regardless of method.
- **Fixed: `withSecHeaders` was dead code.** The prior commit's message claimed to add security
  response headers (HSTS, X-Content-Type-Options, X-Frame-Options); the function existed but
  was never called anywhere in `fetch()`, so no response ever actually carried them. `fetch()`
  now wraps every response through `withSecHeaders()`.
- Replaced the raw `h === env.ECHO_API_KEY` comparison in `authOk` with a constant-time
  `timingSafeEqual`.
- Bumped `@cloudflare/workers-types` `^4.20241205.0` -> `^5.20260804.1` (required by the
  installed `wrangler` 4.x's peer dependency; the old pin blocked `npm install` outright).
  `npm audit`: 0 vulnerabilities.

### Added

- `tests/auth.test.mjs`: 22 real tests, including end-to-end tests calling the exported
  `worker.fetch()` directly against real routes (`/orgs`, `/assets`, `/export`, `/insurance`),
  proving both the auth-bypass fix and the security-headers fix, plus unit tests for
  `timingSafeEqual`/`authOk`. Each of the three security fixes was verified locally to make the
  suite fail when reintroduced in isolation, then pass again when restored.
- `package.json` `test` script (`tsc --noEmit && node --test tests/*.test.mjs`).
- `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`.
- Hosted CI (`.github/workflows/ci.yml`): runs `npm test` on every push and pull request.
- Issue templates (bug report, feature request) and a pull-request template.
- `.echo/{apps.json,certification.json,sdk.json}` for ECHO Certification Forge and GitHub App
  Suite enrollment; `sdk.json` is honestly empty -- no `echo.asset_manager.*` or similar
  capability is registered in `arcanum_sdk.sdk_capabilities` (checked both the obvious prefix
  and a broad `%asset%` search; all matches belong to unrelated systems: crucible recon,
  Google Cloud/SCC asset inventories, and EOAI media assets).
  `scripts/certforge_journey.py` has a dedicated regression check for each of the three
  security fixes above, individually verified locally to fail when reintroduced, then restored.
- This CHANGELOG (the repository previously had none).

## [Prior history]

- security: add security response headers -- shipped the `withSecHeaders` function but never
  wired it in; see Security section above.
- fix: add root route returning 200 JSON service info.
- chore: sync deployed changes (auth hardening, D1 error handling, service bindings).
- chore: sync local changes to GitHub.
- v1.0.0 -- initial commit (AI-powered asset & portfolio management).
