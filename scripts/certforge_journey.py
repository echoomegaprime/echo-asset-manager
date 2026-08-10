"""Critical journey for the ECHO Certification Forge.

The Forge runs this argv (declared in ``.echo/certification.json``) inside its
isolated ``python:3.12-alpine`` sandbox, against the exact acquired commit,
with no network and no project dependencies installed -- there is no Node
here, so the Worker itself cannot actually run. The full behavioural suite
(``npm test`` -- typecheck plus real unit + end-to-end handler tests, run
against the actual ``src/index.ts`` via Node's native TypeScript support)
runs in CI on this same commit; this journey proves the artifact the Forge
actually acquired is the intact, complete Worker source -- not that it
currently boots.

This repository is TypeScript-only (a single Cloudflare Worker, D1 + KV,
no framework); this journey therefore checks structural and textual
invariants rather than parsing Python.

Checks:
  1. The critical surfaces exist -- the Worker entrypoint, its test file,
     the D1 schema, and the pinned Node dependency manifest.
  2. ``src/index.ts``'s bracket counts are balanced -- a cheap, tokenizer-free
     corruption/truncation check. It cannot prove syntax validity by itself
     (that is `tsc --noEmit` in `npm test`/CI); it can only prove the file
     was not truncated or grossly corrupted in transit.
  3. No install-lifecycle scripts have crept into ``package.json``.
  4. No hardcoded secret-shaped literals in the acquired source.
  5. ``authOk`` still calls the constant-time ``timingSafeEqual`` rather than
     a raw ``===``/``!==`` -- a regression here reintroduces a timing
     side-channel on the credential check.
  6. Every non-OPTIONS request past the two public routes (``/`` and
     ``/health``) still requires ``authOk`` -- this is the real regression
     guard: the repo as found had every GET route (assets, users, insurance,
     financial exports) completely unauthenticated, gated only by an
     IP-keyed rate limiter. A ``m !== 'GET'`` (or equivalent) carve-out
     reintroduces that exposure.
  7. ``withSecHeaders`` is actually wired into the response path -- the repo
     as found defined this function but never called it anywhere, so the
     commit that claimed to "add security response headers" shipped no
     behavioral change. A regression here means every response silently
     stops carrying HSTS/X-Frame-Options/X-Content-Type-Options again.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
from typing import NoReturn

CRITICAL_SURFACES = (
    "src/index.ts",
    "tests/auth.test.mjs",
    "src/schema.sql",
    "package.json",
    "tsconfig.json",
)

INSTALL_LIFECYCLE_HOOKS = ("preinstall", "install", "postinstall", "prepare")

SECRET_LITERAL_PATTERN = re.compile(
    r'(?:api_key|secret|password|token)\s*=\s*["\'][a-zA-Z0-9_\-]{16,}["\']',
    re.IGNORECASE,
)

BALANCE_PAIRS = {"(": ")", "{": "}", "[": "]"}


def _fail(message: str) -> NoReturn:
    print(f"ECHO_ASSET_MANAGER_CRITICAL_JOURNEY_FAILED: {message}", file=sys.stderr)
    raise SystemExit(1)


def check_critical_surfaces() -> None:
    for surface in CRITICAL_SURFACES:
        if not pathlib.Path(surface).exists():
            _fail(f"missing critical surface: {surface}")


def _source_text() -> str:
    return pathlib.Path("src/index.ts").read_text(encoding="utf-8")


def check_index_ts_balanced() -> None:
    text = _source_text()
    for open_ch, close_ch in BALANCE_PAIRS.items():
        opens, closes = text.count(open_ch), text.count(close_ch)
        if opens != closes:
            _fail(
                f"src/index.ts has mismatched '{open_ch}'/'{close_ch}' counts "
                f"({opens} vs {closes}) -- possible truncation or corruption"
            )


def check_no_install_hooks() -> None:
    manifest = pathlib.Path("package.json")
    try:
        scripts = json.loads(manifest.read_text(encoding="utf-8")).get("scripts", {})
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        _fail(f"package.json is not valid JSON: {exc}")
    present = sorted(hook for hook in INSTALL_LIFECYCLE_HOOKS if hook in scripts)
    if present:
        _fail(f"package.json reintroduced install-lifecycle script(s): {', '.join(present)}")


def check_no_hardcoded_secrets() -> None:
    match = SECRET_LITERAL_PATTERN.search(_source_text())
    if match:
        _fail(f"src/index.ts contains a hardcoded secret-shaped literal: {match.group(0)[:40]}...")


def check_constant_time_auth() -> None:
    text = _source_text()
    if "timingSafeEqual(h, env.ECHO_API_KEY)" not in text:
        _fail("authOk no longer calls timingSafeEqual on the API key comparison")
    if re.search(r"h\s*===\s*env\.ECHO_API_KEY", text):
        _fail("authOk regressed to a raw === comparison")


def check_get_routes_require_auth() -> None:
    text = _source_text()
    # The regression class: any carve-out that skips authOk for GET.
    if re.search(r"m\s*!==\s*['\"]GET['\"]\s*&&\s*m\s*!==\s*['\"]OPTIONS['\"]\s*&&\s*!authOk", text):
        _fail(
            "GET routes are exempted from authOk again -- this was the real vulnerability: "
            "every GET route (assets/users/insurance/export) was reachable with no credentials, "
            "gated only by an IP rate limiter"
        )
    if not re.search(r"m\s*!==\s*['\"]OPTIONS['\"]\s*&&\s*!authOk\(req,\s*env\)", text):
        _fail("could not find the unconditional (all-methods) authOk gate past the public routes")


def check_security_headers_wired() -> None:
    text = _source_text()
    if "function withSecHeaders" not in text:
        _fail("withSecHeaders helper was removed")
    if "withSecHeaders(await handle(req, env))" not in text:
        _fail(
            "withSecHeaders is defined but not applied to the response -- this was the original "
            "defect: a commit claimed to add security headers but never wired the function in"
        )


def main() -> None:
    check_critical_surfaces()
    check_index_ts_balanced()
    check_no_install_hooks()
    check_no_hardcoded_secrets()
    check_constant_time_auth()
    check_get_routes_require_auth()
    check_security_headers_wired()
    print(
        "ECHO_ASSET_MANAGER_CRITICAL_JOURNEY_OK "
        "critical_surfaces=5 install_hooks=0 hardcoded_secrets=0 "
        "constant_time_auth=1 get_routes_require_auth=1 security_headers_wired=1"
    )


if __name__ == "__main__":
    main()
