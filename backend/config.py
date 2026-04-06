from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AdmissionCraft"
    database_url: str = "sqlite:///./admissioncraft.db"
    redis_url: str = "memory://"
    celery_task_always_eager: bool = False

    base_model_api_key: Optional[str] = Field(default=None, validation_alias="DRAFT_MODEL_API_KEY")
    base_model_base_url: Optional[str] = Field(default=None, validation_alias="DRAFT_MODEL_BASE_URL")
    base_model_name: str = Field(default="gpt-4o-mini", validation_alias="DRAFT_MODEL_NAME")

    finetune_api_key: Optional[str] = Field(default=None, validation_alias="POLISH_MODEL_API_KEY")
    finetune_base_url: Optional[str] = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        validation_alias="POLISH_MODEL_BASE_URL",
    )
    finetune_model_name: str = Field(default="qwen-plus", validation_alias="POLISH_MODEL_NAME")
    public_base_url: str = "http://127.0.0.1:8000"
    host_port: int = 8000


@lru_cache
def get_settings() -> Settings:
    return Settings()
