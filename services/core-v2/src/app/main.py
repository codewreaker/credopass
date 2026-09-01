from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel
from os import getenv
from datetime import datetime, UTC

VERSION = "0.1.0"

"""
# uncomment this code when ready to use the actual path of this service
app = FastAPI(
    title="CredoPass core-v2",
    version=VERSION,
    description="Python/FastAPI port of services/core. See docs/PYTHON-LEARNING-PLAN.md.",
    docs_url="/api/v2/core/docs",
    openapi_url="/api/v2/core/openapi.json",
)
"""


app = FastAPI(
    title="CredoPass core-v2",
    version=VERSION,
    description="Python/FastAPI port of services/core. See docs/PYTHON-LEARNING-PLAN.md."
)

class Health(BaseModel):
    status: Literal["ok"] = "ok"
    version: str = VERSION
    commit: str = getenv("GIT_COMMIT", "unknown")
    timestamp: datetime


@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/health")
async def health() -> Health:
    return Health(timestamp=datetime.now(UTC))