"""CredoPass `/api/v2/core` — the Python/FastAPI service.

Additive, not a rewrite: `services/core` (TypeScript/Hono, `/api/v1/core`) keeps
running unchanged and stays the schema authority. See `docs/PYTHON-LEARNING-PLAN.md` §1.

Nothing app-level lives here yet — week 1 adds `app/main.py` and the health routes.
"""

__all__: list[str] = []
