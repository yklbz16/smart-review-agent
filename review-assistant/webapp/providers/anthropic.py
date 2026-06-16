"""Anthropic Provider — 原生 Anthropic Messages API"""

from typing import AsyncIterator
from anthropic import AsyncAnthropic

from .base import BaseProvider


class AnthropicProvider(BaseProvider):
    """Anthropic Messages API 原生接口"""

    def __init__(self, model: str, api_key: str, base_url: str = "", **kwargs):
        super().__init__(model, api_key, base_url, **kwargs)
        client_kwargs = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url
        self.client = AsyncAnthropic(**client_kwargs)

    @staticmethod
    def provider_name() -> str:
        return "anthropic"

    def _convert_messages(self, messages: list[dict]) -> tuple:
        """将 OpenAI 格式的 messages 转换为 Anthropic 格式"""
        system_prompt = ""
        converted = []

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "system":
                system_prompt = content
            elif role == "assistant":
                converted.append({"role": "assistant", "content": content})
            else:
                converted.append({"role": "user", "content": content})

        return system_prompt, converted

    async def chat(self, messages: list[dict], **kwargs) -> str:
        system, converted = self._convert_messages(messages)

        params = {
            "model": self.model,
            "messages": converted,
            "max_tokens": self.extra_params.get("max_tokens", 4096),
            "temperature": self.extra_params.get("temperature", 0.7),
            **kwargs,
        }
        if system:
            params["system"] = system

        response = await self.client.messages.create(**params)
        # Anthropic 返回 content 列表，取第一个 text block
        for block in response.content:
            if block.type == "text":
                return block.text
        return ""

    async def chat_stream(self, messages: list[dict], **kwargs) -> AsyncIterator[str]:
        system, converted = self._convert_messages(messages)

        params = {
            "model": self.model,
            "messages": converted,
            "max_tokens": self.extra_params.get("max_tokens", 4096),
            "temperature": self.extra_params.get("temperature", 0.7),
            "stream": True,
            **kwargs,
        }
        if system:
            params["system"] = system

        async with self.client.messages.stream(**params) as stream:
            async for text in stream.text_stream:
                yield text
