from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.controllers import assignments
from app.db import listeners  # noqa: F401 — registers SQLAlchemy audit interceptors

app = FastAPI(
    title="Assignments & Traceability Service",
    version="1.0.0",
    description="Microservicio de Asignación de Vehículos a Propietarios con Trazabilidad de Auditoría",
    servers=[{"url": "/assignments", "description": "API Gateway"}],
)

app.include_router(assignments.router)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
def health_check():
    return {"status": "ok"}
