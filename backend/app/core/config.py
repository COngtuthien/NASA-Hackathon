"""Application settings, loaded from environment variables / `.env`.

No secret ever has a default value. `Settings.public_status()` is the only
view of configuration that may leave the process (it never includes keys).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Paths
    repo_root: Path = REPO_ROOT
    processed_dir: Path = REPO_ROOT / "processed"
    database_path: Path | None = Field(default=None, alias="DATABASE_PATH")

    # LLM (provider-agnostic). Empty key => retrieval-only assistant.
    llm_provider: str = Field(default="anthropic", alias="LLM_PROVIDER")
    llm_model: str = Field(default="claude-opus-5-5", alias="LLM_MODEL")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY", repr=False)
    llm_base_url: str = Field(default="", alias="LLM_BASE_URL")
    llm_timeout_s: float = Field(default=60.0, alias="LLM_TIMEOUT_S")

    # External literature
    external_search_enabled: bool = Field(default=True, alias="EXTERNAL_SEARCH_ENABLED")
    external_cache_ttl_hours: float = Field(default=24.0, alias="EXTERNAL_CACHE_TTL_HOURS")
    external_timeout_s: float = Field(default=15.0, alias="EXTERNAL_TIMEOUT_S")
    openalex_mailto: str = Field(default="", alias="OPENALEX_MAILTO")
    openalex_api_key: str = Field(default="", alias="OPENALEX_API_KEY", repr=False)
    ntrs_api_key: str = Field(default="", alias="NTRS_API_KEY", repr=False)

    # Retrieval: dense component fused with BM25 (lsa | neural | both). Chosen by tests/retrieval_benchmark.jsonl.
    retrieval_dense: str = Field(default="lsa", alias="RETRIEVAL_DENSE")

    # Web
    cors_origins: str = Field(default="http://localhost:3000,http://127.0.0.1:3000", alias="CORS_ORIGINS")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    @property
    def db_path(self) -> Path:
        return self.database_path or (self.processed_dir / "spacefire.db")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_api_key.strip())

    def public_status(self) -> dict:
        return {
            "llm_provider": self.llm_provider,
            "llm_model": self.llm_model,
            "llm_configured": self.llm_configured,
            "external_search_enabled": self.external_search_enabled,
            "external_cache_ttl_hours": self.external_cache_ttl_hours,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
