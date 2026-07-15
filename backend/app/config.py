from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from typing import Annotated, Any

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "POPS Workbook Platform"
    environment: str = Field(
        default="development", validation_alias=AliasChoices("ENVIRONMENT", "APP_ENV")
    )
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./data/pops.db"
    storage_root: Path = Path("./data/storage")
    max_upload_bytes: int = 25 * 1024 * 1024
    max_zip_uncompressed_bytes: int = 250 * 1024 * 1024
    max_upload_size_mb: int | None = None
    max_zip_uncompressed_mb: int | None = None
    max_zip_compression_ratio: float = 100.0
    max_zip_entries: int = 10_000
    max_grid_cells: int = 5_000
    analysis_auto_run: bool = True
    auth_api_key: str | None = None
    default_organization: str = "demo"
    default_user: str = "demo-user"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://localhost:5173"]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return value

    @model_validator(mode="after")
    def convert_megabyte_aliases(self) -> "Settings":
        if self.max_upload_size_mb is not None:
            self.max_upload_bytes = self.max_upload_size_mb * 1024 * 1024
        if self.max_zip_uncompressed_mb is not None:
            self.max_zip_uncompressed_bytes = self.max_zip_uncompressed_mb * 1024 * 1024
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
