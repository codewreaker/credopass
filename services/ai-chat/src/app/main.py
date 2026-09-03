"""CredoPass ai-chat — the Copilot rail's backend.

This service has exactly one job: serve the Organizer Copilot agent over the
AG-UI protocol. See `docs/AI-SIDEBAR-PLAN.md`.

It is deliberately *not* a REST API and never becomes one. It holds no database
connection: every tool the agent exposes calls the existing v1 TypeScript API
over HTTP, forwarding the caller's own bearer token, so the agent inherits the
caller's permissions and gains no new ones.

Routes:
    GET  /health                                liveness
    POST /api/v1/ai-chat/agent/organizer-copilot the agent (day 5)
"""

from datetime import UTC, datetime
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

from app.settings import get_settings

VERSION = "0.1.0"

app = FastAPI(
    title="CredoPass ai-chat",
    version=VERSION,
    description="The Organizer Copilot, over AG-UI. See docs/AI-SIDEBAR-PLAN.md.",
)


class Health(BaseModel):
    status: Literal["ok"] = "ok"
    version: str = VERSION
    commit: str
    timestamp: datetime


@app.get("/health")
async def health() -> Health:
    return Health(commit=get_settings().git_commit, timestamp=datetime.now(UTC))
