from fastapi import FastAPI

from api import generate_router, tasks_router

app = FastAPI(title="AdmissionCraft")
app.include_router(generate_router)
app.include_router(tasks_router)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
