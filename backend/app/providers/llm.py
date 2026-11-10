"""Provider-agnostic LLM interface for grounded JSON synthesis.

The LLM only *phrases* answers from an evidence pack; it is never the source of
numbers. Swapping providers means adding a class with `generate_json`; the web UI
and answer service do not change. With no key configured, `get_llm()` returns
None and the assistant runs in explicit retrieval-only mode.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Protocol

from ..core.config import get_settings

log = logging.getLogger("spacefire.llm")


class LLMError(Exception):
    def __init__(self, kind: str, message: str, retry_after: float | None = None):
        super().__init__(message)
        self.kind = kind            # auth / rate_limit / timeout / unavailable / refusal / bad_output / bad_request
        self.retry_after = retry_after


class LLMProvider(Protocol):
    name: str
    model: str

    def generate_json(self, system: str, user: str, schema: dict, max_tokens: int = 16000) -> dict[str, Any]: ...


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str, model: str, timeout_s: float, base_url: str = ""):
        import anthropic

        self._anthropic = anthropic
        kwargs: dict[str, Any] = {"api_key": api_key, "timeout": timeout_s, "max_retries": 2}
        if base_url:
            kwargs["base_url"] = base_url
        self.client = anthropic.Anthropic(**kwargs)
        self.model = model

    def generate_json(self, system: str, user: str, schema: dict, max_tokens: int = 16000) -> dict[str, Any]:
        a = self._anthropic
        try:
            resp = self.client.beta.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config={"effort": "medium", "format": {"type": "json_schema", "schema": schema}},
                # Server-side refusal fallback: a policy decline is retried on a fallback model in the same call.
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
        except a.AuthenticationError:
            raise LLMError("auth", "LLM authentication failed (check LLM_API_KEY).")
        except a.PermissionDeniedError:
            raise LLMError("auth", "LLM credentials lack permission for this model.")
        except a.NotFoundError:
            raise LLMError("bad_request", f"LLM model '{self.model}' not found.")
        except a.BadRequestError as e:
            raise LLMError("bad_request", f"LLM rejected the request: {e.message}")
        except a.RateLimitError as e:
            ra = None
            try:
                ra = float(e.response.headers.get("retry-after", "")) if e.response is not None else None
            except ValueError:
                ra = None
            raise LLMError("rate_limit", "LLM provider rate limit reached.", ra)
        except a.APITimeoutError:
            raise LLMError("timeout", "LLM request timed out.")
        except a.APIStatusError as e:
            raise LLMError("unavailable", f"LLM provider error HTTP {e.status_code}.")
        except a.APIConnectionError:
            raise LLMError("unavailable", "Could not reach the LLM provider.")
        log.info("llm call model=%s request_id=%s stop=%s", resp.model, getattr(resp, "_request_id", None),
                 resp.stop_reason)
        if resp.stop_reason == "refusal":
            raise LLMError("refusal", "The model declined to answer this request.")
        if resp.stop_reason == "max_tokens":
            raise LLMError("bad_output", "LLM output was truncated.")
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        try:
            return json.loads(text)
        except ValueError:
            raise LLMError("bad_output", "LLM did not return valid JSON.")


_override: LLMProvider | None = None
_override_set = False


def set_llm(provider: LLMProvider | None) -> None:
    """Test hook / DI: force a provider (or None for retrieval-only)."""
    global _override, _override_set
    _override, _override_set = provider, True


def get_llm() -> LLMProvider | None:
    if _override_set:
        return _override
    s = get_settings()
    if not s.llm_configured:
        return None
    if s.llm_provider.lower() == "anthropic":
        return AnthropicProvider(s.llm_api_key, s.llm_model, s.llm_timeout_s, s.llm_base_url)
    log.warning("LLM_PROVIDER=%s is not implemented; assistant runs retrieval-only", s.llm_provider)
    return None


def llm_status() -> dict:
    s = get_settings()
    implemented = s.llm_provider.lower() == "anthropic"
    if _override_set:
        return {"configured": _override is not None, "provider": getattr(_override, "name", None),
                "model": getattr(_override, "model", None), "mode": "synthesis" if _override else "retrieval_only",
                "reason": None if _override else "LLM disabled for this process."}
    if not s.llm_configured:
        return {"configured": False, "provider": s.llm_provider, "model": s.llm_model, "mode": "retrieval_only",
                "reason": "LLM_API_KEY is not set. Set LLM_PROVIDER, LLM_MODEL and LLM_API_KEY in .env to enable "
                          "AI synthesis. Search, tools and citations work without it."}
    if not implemented:
        return {"configured": False, "provider": s.llm_provider, "model": s.llm_model, "mode": "retrieval_only",
                "reason": f"LLM_PROVIDER '{s.llm_provider}' has no adapter; supported: anthropic."}
    return {"configured": True, "provider": s.llm_provider, "model": s.llm_model, "mode": "synthesis", "reason": None}
