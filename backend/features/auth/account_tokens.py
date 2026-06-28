"""Crypto + link helpers for single-use invite / password-reset tokens.

A raw account token is a high-entropy URL-safe string handed to exactly one
person (the invitee, or the user resetting a password). The database only ever
stores a *keyed hash* of it (`HMAC-SHA256(account_token_secret, raw)`), so a
DB-only reader who sees the `account_tokens` table cannot reconstruct a usable
link. Lookups recompute the hash from the presented raw token and match on the
indexed `token_hash` column.

The raw token is carried in the frontend URL **fragment** (`/reset#token=...`),
which browsers never send to the server or to static-host access logs; the
frontend posts it to the API only in a JSON body over HTTPS.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Literal

from config import settings

AccountTokenType = Literal["invite", "password_reset"]

# 32 bytes -> 256 bits of entropy, URL-safe (~43 chars). Far beyond brute-force
# even without rate limiting.
_TOKEN_NBYTES = 32

# Frontend route per token type. The completion pages read `#token=` from the
# fragment and POST it to the matching auth-completion route.
_LINK_PATHS: dict[AccountTokenType, str] = {
    "invite": "/invite",
    "password_reset": "/reset",
}


def generate_raw_token() -> str:
    """Return a fresh, cryptographically random raw token."""
    return secrets.token_urlsafe(_TOKEN_NBYTES)


def hash_token(raw_token: str) -> str:
    """Return the keyed hash stored for ``raw_token``.

    Uses HMAC-SHA256 with the server's ``account_token_secret``. An empty secret
    (local/test) degrades to an unkeyed digest of the raw token — acceptable
    off-production, where the threat model has no hostile DB reader.
    """
    secret = settings.account_token_secret.encode("utf-8")
    return hmac.new(secret, raw_token.encode("utf-8"), hashlib.sha256).hexdigest()


def build_account_link(token_type: AccountTokenType, raw_token: str) -> str:
    """Build the one-time link for ``raw_token`` from the canonical base URL.

    Always derived from ``settings.frontend_base_url`` — never the request Host —
    so a spoofed Host header cannot redirect a recovery link to an attacker.
    """
    base = settings.frontend_base_url.rstrip("/")
    return f"{base}{_LINK_PATHS[token_type]}#token={raw_token}"
