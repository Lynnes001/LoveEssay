from __future__ import annotations

import secrets

from fastapi import APIRouter, Request, Response
from fastapi.exceptions import HTTPException
from pydantic import BaseModel

from config import get_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_NAME = "ac_session"
COOKIE_MAX_AGE = 7 * 24 * 3600  # 7 days

_valid_tokens: set[str] = set()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest, response: Response) -> dict:
    settings = get_settings()
    if body.username != settings.app_login_user or body.password != settings.app_login_pass:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = secrets.token_hex(32)
    _valid_tokens.add(token)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
    )
    return {"ok": True}


@router.post("/logout")
def logout(request: Request, response: Response) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        _valid_tokens.discard(token)
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


def is_valid_token(token: str | None) -> bool:
    return bool(token and token in _valid_tokens)
