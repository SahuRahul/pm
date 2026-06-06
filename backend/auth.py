import os

from fastapi import Cookie, HTTPException, Response
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner

_SECRET = os.getenv("SESSION_SECRET", "dev-secret-change-in-production")
_signer = TimestampSigner(_SECRET)
_COOKIE_NAME = "session"
_MAX_AGE = 60 * 60 * 24 * 7  # 7 days


def create_session(response: Response, username: str) -> None:
    token = _signer.sign(username).decode()
    response.set_cookie(
        key=_COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=_MAX_AGE,
        samesite="lax",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(key=_COOKIE_NAME, samesite="lax")


def verify_session(session: str | None = Cookie(default=None, alias="session")) -> str:
    """FastAPI dependency — returns the username or raises 401."""
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        username = _signer.unsign(session, max_age=_MAX_AGE).decode()
        return username
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=401, detail="Invalid or expired session")
