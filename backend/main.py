from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from api import auth_router, documents_router, fact_check_router, generate_router, outline_router, sessions_router, students_router, tasks_router
from api.auth import COOKIE_NAME, is_valid_token

_AUTH_EXEMPT = {"/health", "/api/auth/login", "/api/auth/logout"}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _AUTH_EXEMPT:
            return await call_next(request)
        if not is_valid_token(request.cookies.get(COOKIE_NAME)):
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
        return await call_next(request)


app = FastAPI(title="AdmissionCraft")
app.add_middleware(AuthMiddleware)

app.include_router(auth_router)
app.include_router(generate_router)
app.include_router(outline_router)
app.include_router(fact_check_router)
app.include_router(tasks_router)
app.include_router(students_router)
app.include_router(sessions_router)
app.include_router(documents_router)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
