from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from auth import VALID_PASSWORD, VALID_USERNAME, clear_session, create_session, verify_session

app = FastAPI()


# --- Health ---

@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Auth ---

class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
def login(body: LoginRequest, response: Response):
    if body.username != VALID_USERNAME or body.password != VALID_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    create_session(response, body.username)
    return {"ok": True}


@app.post("/api/auth/logout")
def logout(response: Response):
    clear_session(response)
    return {"ok": True}


@app.get("/api/auth/me")
def me(username: str = Depends(verify_session)):
    return {"username": username}


# --- Static files (Next.js export) ---
# Routes defined above take priority over the static mount.
_static_dir = Path(__file__).parent / "static"
_static_dir.mkdir(exist_ok=True)
app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
