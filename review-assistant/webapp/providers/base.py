"""LLM Provider 抽象基类"""

from abc import ABC, abstractmethod
from typing import AsyncIterator


class BaseProvider(ABC):
    """所有 LLM Provider 的抽象基类"""

    def __init__(self, model: str, api_key: str, base_url: str = "", **kwargs):
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.extra_params = kwargs

    @abstractmethod
    async def chat(self, messages: list[dict], **kwargs) -> str:
        """发送消息，返回完整文本响应"""
        ...

    @abstractmethod
    async def chat_stream(self, messages: list[dict], **kwargs) -> AsyncIterator[str]:
        """流式发送消息，逐步返回文本块"""
        ...

    @staticmethod
    @abstractmethod
    def provider_name() -> str:
        """返回 provider 名称"""
        ...
