"""Provider 工厂 — 根据配置创建对应的 Provider 实例"""

import json
import os
from pathlib import Path

from .base import BaseProvider
from .openai_compatible import OpenAICompatibleProvider
from .anthropic import AnthropicProvider

# Provider 注册表
PROVIDER_MAP = {
    "openai": OpenAICompatibleProvider,
    "deepseek": OpenAICompatibleProvider,  # DeepSeek 用 OpenAI 兼容接口
    "openai_compatible": OpenAICompatibleProvider,
    "anthropic": AnthropicProvider,
    "custom": OpenAICompatibleProvider,  # 自定义兼容接口
}

# Provider 显示信息
PROVIDER_INFO = [
    {
        "id": "anthropic",
        "name": "Anthropic (Claude)",
        "default_base_url": "https://api.anthropic.com",
        "default_model": "claude-sonnet-4-20250514",
        "needs_base_url": False,
    },
    {
        "id": "openai",
        "name": "OpenAI (GPT)",
        "default_base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o",
        "needs_base_url": False,
    },
    {
        "id": "deepseek",
        "name": "DeepSeek",
        "default_base_url": "https://api.deepseek.com/v1",
        "default_model": "deepseek-chat",
        "needs_base_url": False,
    },
    {
        "id": "custom",
        "name": "自定义 (OpenAI 兼容)",
        "default_base_url": "",
        "default_model": "",
        "needs_base_url": True,
    },
]

# 配置文件路径
CONFIG_PATH = Path(__file__).parent.parent / "config.json"


def load_config() -> dict:
    """加载模型配置"""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_config(config: dict) -> None:
    """保存模型配置"""
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def get_available_providers() -> list[dict]:
    """获取所有可用的 provider 信息"""
    return PROVIDER_INFO


def get_safe_config() -> dict:
    """获取不包含 api_key 的安全配置"""
    config = load_config()
    if "api_key" in config:
        masked = config["api_key"]
        if len(masked) > 8:
            masked = masked[:4] + "****" + masked[-4:]
        config["api_key_masked"] = masked
        del config["api_key"]
    return config


def create_provider(config: dict = None) -> BaseProvider:
    """
    根据配置创建 Provider 实例。
    如果未提供 config，则从 config.json 加载。
    """
    if config is None:
        config = load_config()

    provider_id = config.get("provider", "deepseek")
    model = config.get("model", "deepseek-v4-pro")
    api_key = config.get("api_key", "")
    base_url = config.get("base_url", "")
    params = config.get("parameters", {})

    provider_cls = PROVIDER_MAP.get(provider_id, OpenAICompatibleProvider)
    return provider_cls(
        model=model,
        api_key=api_key,
        base_url=base_url,
        **params,
    )
