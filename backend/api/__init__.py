from api.auth import router as auth_router
from api.documents import router as documents_router
from api.fact_check import router as fact_check_router
from api.generate import router as generate_router
from api.outline import router as outline_router
from api.sessions import router as sessions_router
from api.students import router as students_router
from api.tasks import router as tasks_router

__all__ = ["auth_router", "documents_router", "fact_check_router", "generate_router", "outline_router", "sessions_router", "students_router", "tasks_router"]
