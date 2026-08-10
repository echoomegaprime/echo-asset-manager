# Contributing

Thank you for improving Echo Asset Manager. This is a public, proprietary infrastructure
project: contributions are welcome for review, but repository visibility does not grant a
general use or redistribution license.

## Development path

1. Open an issue describing the behavior being changed.
2. Create a focused branch from current `main`.
3. Add a failing test before changing the authentication boundary (`authOk`, `timingSafeEqual`)
   or the `withSecHeaders` response wrapper -- see SECURITY.md for why both were previously
   broken in ways that had no test coverage.
4. Validate before opening a pull request:

   ```powershell
   npm install
   npm test
   ```

5. Open a pull request using the repository template and include exact test output.

## Pull-request requirements

- No secrets (`ECHO_API_KEY`) are included.
- No stubs, placeholders, or self-asserted readiness -- this service holds real organizations'
  financial and insurance data.
- Any change to `authOk`, `timingSafeEqual`, or which methods/paths require authentication is
  called out explicitly in the pull request description.
