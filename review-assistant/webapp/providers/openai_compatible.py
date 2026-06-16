"""OpenAI 兼容接口 Provider — 支持 OpenAI / DeepSeek / 自定义"""

from typing import AsyncIterator
from openai import AsyncOpenAI

from .base import BaseProvider


class OpenAICompatibleProvider(BaseProvider):
    """OpenAI Chat Completions 兼容接口"""

    def __init__(self, model: str, api_key: str, base_url: str = "", **kwargs):
        super().__init__(model, api_key, base_url, **kwargs)
        client_kwargs = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url
        self.client = AsyncOpenAI(**client_kwargs)

    @staticmethod
    def provider_name() -> str:
        return "openai_compatible"

    async def chat(self, messages: list[dict], **kwargs) -> str:
        params = {
            "model": self.model,
            "messages": messages,
            "temperature": self.extra_params.get("temperature", 0.7),
            "max_tokens": self.extra_params.get("max_tokens", 4096),
            **kwargs,
        }
        response = await self.client.chat.completions.create(**params)
        return response.choices[0].message.content or ""

    async def chat_stream(self, messages: list[dict], **kwargs) -> AsyncIterator[str]:
        params = {
            "model": self.model,
            "messages": messages,
            "temperature": self.extra_params.get("temperature", 0.7),
            "max_tokens": self.extra_params.get("max_tokens", 4096),
            "stream": True,
            **kwargs,
        }
        stream = await self.client.chat.completions.create(**params)
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content
