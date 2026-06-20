from fastapi import FastAPI

from app.controllers import auth, persons, roles, users

app = FastAPI(title="Auth Service", version="1.0.0")

app.include_router(auth.router)
app.include_router(persons.router)
app.include_router(users.router)
app.include_router(roles.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
