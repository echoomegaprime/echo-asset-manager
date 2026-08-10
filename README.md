# Echo Asset Manager

AI-powered physical/IT asset & portfolio management -- Cloudflare Worker (D1 + KV). Tracks
organizations, users, locations, asset categories, assets (with depreciation, insurance,
maintenance, check-in/out, valuations), a per-org dashboard, and AI-assisted condition
assessment / depreciation forecasting via the Echo Engine Runtime.

## Endpoints

| Access | Method | Path | Description |
|---|---|---|---|
| Public | GET | `/`, `/health` | Service info / health check |
| Authenticated | GET | `/orgs`, `/users`, `/categories`, `/locations`, `/assets`, `/assets/:id`, `/assets/:id/depreciation`, `/maintenance`, `/insurance`, `/dashboard`, `/ai/assess/:id`, `/export` | Reads |
| Authenticated | POST | `/orgs`, `/users`, `/categories`, `/locations`, `/assets`, `/assets/:id/dispose`, `/check-in-out`, `/maintenance`, `/maintenance/:id/complete`, `/valuations`, `/insurance`, `/ai/depreciation-forecast` | Create/mutate |
| Authenticated | PUT | `/assets/:id` | Update |

A `scheduled` cron (`0 5 * * *`) recalculates depreciation and writes daily per-org report
snapshots.

## Authentication

Every route other than `/` and `/health` requires `X-Echo-API-Key` (or
`Authorization: Bearer <key>`), compared to `env.ECHO_API_KEY` in constant time. There is a
single shared credential -- no separate read/write/admin tiers. This was **not** the case as
found (every `GET` route was open with no credentials); see [SECURITY.md](SECURITY.md).

## Verify

```powershell
npm install
npm test
```

## Security

This service stores organizations' financial, insurance, and personnel data. See
[SECURITY.md](SECURITY.md) to report a vulnerability -- never as a public issue.

## License

See [LICENSE](LICENSE). Contributions: see [CONTRIBUTING.md](CONTRIBUTING.md).
