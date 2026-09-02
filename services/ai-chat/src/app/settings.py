"""Configuration, validated once at import rather than discovered at request time.

`os.getenv` returns `str | None` and hands you the `None` three layers deep, inside
a tool call, as a confusing 401. `BaseSettings` types and validates the whole set
when the process starts, so a missing or malformed value is a boot failure with a
field name on it.

Values come from the environment, falling back to `services/core-v2/.env` (which is
gitignored — see `.gitignore`).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Where the agent's tools call. This service holds no database connection of
    # its own by design (AI-SIDEBAR-PLAN.md §1) — every read and write goes
    # through the existing v1 TypeScript API, carrying the caller's own token.
    v1_api_url: str = "http://localhost:8080"

    # Unset in tests, on purpose: the suite must pass with no key present, which
    # is what proves nothing is quietly making a live model call.
    llm_api_key: str | None = None

    # Injected at build time in a real deploy; "unknown" locally unless you set
    # GIT_COMMIT yourself. Mirrors how v1 does it.
    git_commit: str = "unknown"


@lru_cache
def get_settings() -> Settings:
    """Cached so the .env file is read once, not per request."""
    return Settings()
