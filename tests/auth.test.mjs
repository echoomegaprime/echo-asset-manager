import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { timingSafeEqual, authOk } from '../src/index.ts';

const API_KEY = 'test-echo-asset-manager-key-9f2c';

function fakeKv() {
  const store = new Map();
  return {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); },
  };
}

function fakeDb() {
  return {
    prepare(_sql) {
      const chain = {
        bind: (..._args) => chain,
        all: async () => ({ results: [] }),
        first: async () => null,
        run: async () => ({ meta: { last_row_id: 1 } }),
      };
      return chain;
    },
  };
}

function fakeFetcher() {
  return { fetch: async () => new Response(JSON.stringify({ answer: 'stub' }), { headers: { 'Content-Type': 'application/json' } }) };
}

function env() {
  return {
    DB: fakeDb(),
    AM_CACHE: fakeKv(),
    ENGINE_RUNTIME: fakeFetcher(),
    SHARED_BRAIN: fakeFetcher(),
    EMAIL_SENDER: fakeFetcher(),
    ECHO_API_KEY: API_KEY,
  };
}

// ---- timingSafeEqual / authOk unit tests ----

test('timingSafeEqual: equal strings match', () => {
  assert.equal(timingSafeEqual('abc123', 'abc123'), true);
});

test('timingSafeEqual: different strings do not match', () => {
  assert.equal(timingSafeEqual('abc123', 'abc124'), false);
});

test('timingSafeEqual: different-length strings do not match', () => {
  assert.equal(timingSafeEqual('short', 'much-longer-string'), false);
});

test('timingSafeEqual: null/undefined never match, even against empty string', () => {
  assert.equal(timingSafeEqual(undefined, ''), false);
  assert.equal(timingSafeEqual(null, null), false);
});

test('authOk: rejects when env has no configured key', () => {
  const e = env(); e.ECHO_API_KEY = '';
  const req = new Request('https://x/orgs', { headers: { 'X-Echo-API-Key': 'anything' } });
  assert.equal(authOk(req, e), false);
});

test('authOk: accepts a correct X-Echo-API-Key header', () => {
  const req = new Request('https://x/orgs', { headers: { 'X-Echo-API-Key': API_KEY } });
  assert.equal(authOk(req, env()), true);
});

test('authOk: accepts a correct Bearer Authorization header', () => {
  const req = new Request('https://x/orgs', { headers: { Authorization: `Bearer ${API_KEY}` } });
  assert.equal(authOk(req, env()), true);
});

// ---- end-to-end: this is the real regression guard for the GET-auth-bypass fix ----

test('GET /orgs with no credentials is 401 (was previously wide open)', async () => {
  const req = new Request('https://x/orgs');
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 401);
});

test('GET /assets with no credentials is 401', async () => {
  const req = new Request('https://x/assets?org_id=1');
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 401);
});

test('GET /export?format=csv with no credentials is 401 (was the full-data-exfil path)', async () => {
  const req = new Request('https://x/export?org_id=1&format=csv');
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 401);
});

test('GET /insurance with no credentials is 401', async () => {
  const req = new Request('https://x/insurance?org_id=1');
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 401);
});

test('GET /orgs with a valid key succeeds', async () => {
  const req = new Request('https://x/orgs', { headers: { 'X-Echo-API-Key': API_KEY } });
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
});

test('GET /orgs with a wrong key is still 401', async () => {
  const req = new Request('https://x/orgs', { headers: { 'X-Echo-API-Key': 'wrong-key' } });
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 401);
});

test('POST /orgs with no credentials is 401 (already correct pre-fix, must not regress)', async () => {
  const req = new Request('https://x/orgs', { method: 'POST', body: JSON.stringify({ name: 'Acme' }) });
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 401);
});

test('POST /orgs with a valid key succeeds', async () => {
  const req = new Request('https://x/orgs', {
    method: 'POST',
    headers: { 'X-Echo-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Acme Corp' }),
  });
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 201);
});

// ---- public routes stay public ----

test('GET / is public, no key required', async () => {
  const req = new Request('https://x/');
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 200);
});

test('GET /health is public, no key required', async () => {
  const req = new Request('https://x/health');
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('OPTIONS is public (CORS preflight), no key required', async () => {
  const req = new Request('https://x/orgs', { method: 'OPTIONS' });
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 200);
});

// ---- this is the regression guard for the dead withSecHeaders fix ----

test('every response carries the security headers (was previously dead code)', async () => {
  const req = new Request('https://x/health');
  const res = await worker.fetch(req, env());
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(res.headers.get('X-Frame-Options'), 'DENY');
  assert.ok(res.headers.get('Strict-Transport-Security')?.includes('max-age=31536000'));
});

test('security headers are present on an authenticated 200 too, not just health', async () => {
  const req = new Request('https://x/orgs', { headers: { 'X-Echo-API-Key': API_KEY } });
  const res = await worker.fetch(req, env());
  assert.equal(res.headers.get('X-Frame-Options'), 'DENY');
});

test('security headers are present on a 401, not just successful responses', async () => {
  const req = new Request('https://x/orgs');
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
});

// ---- depreciation math, unrelated to security but the only real business logic worth a smoke test ----

test('GET /assets/:id/depreciation 404s cleanly for a missing asset', async () => {
  const req = new Request('https://x/assets/999/depreciation', { headers: { 'X-Echo-API-Key': API_KEY } });
  const res = await worker.fetch(req, env());
  assert.equal(res.status, 404);
});
