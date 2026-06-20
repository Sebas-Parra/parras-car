from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.controllers import persons, roles, users

app = FastAPI(title="Users Service", version="1.0.0", root_path="/users")

app.include_router(persons.router)
app.include_router(users.router)
app.include_router(roles.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
