from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB = f"sqlite:///{(BASE_DIR / 'portsync.db').as_posix()}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "PortSync API"
    environment: str = "development"
    database_url: str = DEFAULT_DB

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        # Env values pasted from dashboards sometimes arrive wrapped in quotes
        # or with a trailing newline; both break create_engine at import time.
        url = value.strip().strip('"').strip("'")
        # Managed Postgres providers (Render, Supabase, Neon) hand out
        # postgresql:// or postgres:// URLs, but only the psycopg 3 driver is installed.
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url.removeprefix(prefix)
        return url

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Live simulation clock
    sim_enabled: bool = True
    sim_tick_seconds: float = 4.0
    sim_seed: int = 20261

    # Authentication
    session_cookie_name: str = "portsync_session"
    session_hours: int = 12
    remember_days: int = 30
    seed_demo_users: bool = True
    demo_password: str = "PortSync2026!"
    csrf_header: str = "X-CSRF-Token"

    # Optional LLM assistant (OpenAI-compatible endpoint). Left blank -> rules engine.
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_api_key.strip())


settings = Settings()
