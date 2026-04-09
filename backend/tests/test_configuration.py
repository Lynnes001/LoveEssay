import importlib

from config import Settings, get_settings


def test_settings_read_draft_and_polish_model_variables(monkeypatch):
    monkeypatch.setenv("DRAFT_MODEL_API_KEY", "draft-key")
    monkeypatch.setenv("DRAFT_MODEL_BASE_URL", "https://example.com/draft/v1")
    monkeypatch.setenv("DRAFT_MODEL_NAME", "draft-model")
    monkeypatch.setenv("POLISH_MODEL_API_KEY", "polish-key")
    monkeypatch.setenv("POLISH_MODEL_BASE_URL", "https://example.com/polish/v1")
    monkeypatch.setenv("POLISH_MODEL_NAME", "polish-model")

    get_settings.cache_clear()
    settings = get_settings()

    assert settings.base_model_api_key == "draft-key"
    assert settings.base_model_base_url == "https://example.com/draft/v1"
    assert settings.base_model_name == "draft-model"
    assert settings.finetune_api_key == "polish-key"
    assert settings.finetune_base_url == "https://example.com/polish/v1"
    assert settings.finetune_model_name == "polish-model"


def test_settings_ignore_legacy_model_aliases(monkeypatch):
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.delenv("DRAFT_MODEL_API_KEY", raising=False)
    monkeypatch.delenv("DRAFT_MODEL_BASE_URL", raising=False)
    monkeypatch.delenv("DRAFT_MODEL_NAME", raising=False)
    monkeypatch.delenv("POLISH_MODEL_API_KEY", raising=False)
    monkeypatch.delenv("POLISH_MODEL_BASE_URL", raising=False)
    monkeypatch.delenv("POLISH_MODEL_NAME", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "legacy-openai-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://example.com/openai/v1")
    monkeypatch.setenv("OPENAI_MODEL", "legacy-openai-model")
    monkeypatch.setenv("BASE_MODEL_API_KEY", "legacy-base-key")
    monkeypatch.setenv("BASE_MODEL_BASE_URL", "https://example.com/base/v1")
    monkeypatch.setenv("BASE_MODEL_NAME", "legacy-base-model")
    monkeypatch.setenv("DASHSCOPE_API_KEY", "legacy-dashscope-key")
    monkeypatch.setenv("DASHSCOPE_BASE_URL", "https://example.com/dashscope/v1")
    monkeypatch.setenv("FINETUNE_API_KEY", "legacy-finetune-key")
    monkeypatch.setenv("FINETUNE_BASE_URL", "https://example.com/finetune/v1")
    monkeypatch.setenv("FINETUNE_MODEL_NAME", "legacy-finetune-model")

    get_settings.cache_clear()
    settings = get_settings()

    assert settings.base_model_api_key is None
    assert settings.base_model_base_url is None
    assert settings.base_model_name == "gpt-4o-mini"
    assert settings.finetune_api_key is None
    assert settings.finetune_base_url == "https://dashscope.aliyuncs.com/compatible-mode/v1"
    assert settings.finetune_model_name == "qwen-plus"


def test_importing_main_does_not_call_create_all(monkeypatch):
    import db
    import main

    def fail(*args, **kwargs):
        raise AssertionError("create_all should not be called during app import")

    monkeypatch.setattr(db.Base.metadata, "create_all", fail)

    importlib.reload(main)
