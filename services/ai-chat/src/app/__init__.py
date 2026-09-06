"""CredoPass ai-chat — the Organizer Copilot, served over AG-UI.

One agent endpoint and a health check. No database, no REST surface: the agent's
tools call the existing v1 TypeScript API over HTTP with the caller's own token.
See `docs/ai-sidebar/AI-SIDEBAR-PLAN.md`.
"""

__all__: list[str] = []
