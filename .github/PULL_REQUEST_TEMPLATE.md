## Objective

Describe the asset-management behavior this change adds or fixes.

## Evidence

- Exact source revision:
- Test output (`npm test`):
- Negative paths exercised (missing/invalid key, unauthenticated GET):
- Hosted CI run:

## Security and release impact

- [ ] No secrets (`ECHO_API_KEY`) are included.
- [ ] The `X-Echo-API-Key` / `authOk` authentication boundary (required on every route except
      `/` and `/health`, all methods) is unchanged, or the change is called out explicitly.
- [ ] `withSecHeaders` remains wired into every response, or the change is called out explicitly.
- [ ] Staging-first deployment and rollback implications are documented.
