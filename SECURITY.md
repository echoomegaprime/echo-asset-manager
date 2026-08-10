# Security policy

Echo Asset Manager is a Cloudflare Worker (D1 + KV) storing organizations' physical/IT asset
inventory, including purchase price, current book value, insurance policies, and assigned-user
records. Every route other than `/` and `/health` requires `X-Echo-API-Key` (or an equivalent
`Authorization: Bearer` header), compared to `env.ECHO_API_KEY` in constant time. There is a
single shared credential -- no separate read/write/admin tier.

## Fixed in this consolidation pass

Two real defects were found and fixed while migrating this repository, both in the same commit
that originally claimed to "add security response headers":

1. **Every `GET` route was completely unauthenticated.** The auth check only ran for
   non-`GET` methods (`if (m !== 'GET' && m !== 'OPTIONS' && !authOk(...))`), so `GET /orgs`,
   `/users`, `/assets`, `/insurance`, `/dashboard`, and `GET /export?format=csv` (a full CSV
   dump of every asset, including purchase price and current value) were reachable by anyone
   with no credentials at all -- gated only by a per-IP rate limiter. Fixed by requiring
   `authOk` on every method past `/` and `/health`.
2. **The security-response-headers function was defined but never called.** `withSecHeaders()`
   existed and built the correct `Strict-Transport-Security` / `X-Frame-Options` /
   `X-Content-Type-Options` header set, but nothing in `fetch()` ever applied it to a response --
   the commit that claimed to add these headers shipped no behavioral change. Fixed by wrapping
   every response in `withSecHeaders()` at the top of `fetch()`.
3. The raw `h === env.ECHO_API_KEY` string comparison was replaced with a constant-time
   `timingSafeEqual` to close a timing side-channel on the credential check.

`scripts/certforge_journey.py` has a dedicated check for each of the three regressions above,
verified locally to fail when reintroduced and pass when fixed.

## Supported version

Security fixes target the current `main` branch and the currently deployed Worker release.
Historical commits are retained for evidence and are not patched in place.

## Report a vulnerability

Do not open a public issue for a suspected vulnerability. Send a private report to
`security@echo-op.com` with:

- affected endpoint and exact revision;
- reproduction steps and expected impact (this service holds financial and PII data across
  multiple organizations -- treat any cross-org data exposure as high severity);
- safe contact details for follow-up.

Never include a live `ECHO_API_KEY` in a report.
