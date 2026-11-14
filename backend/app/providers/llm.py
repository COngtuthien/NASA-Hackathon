"""Provider-agnostic LLM interface for grounded JSON synthesis.

The LLM only *phrases* answers from an evidence pack; it is never the source of
numbers. Swapping providers means adding a class with `generate_json`; the web UI
and answer service do not change. With no key configured, `get_llm()` returns
None and the assistant runs in explicit retrieval-only mode.
"""
from __future__ import annotations

import json
import logging
import re
import time
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


_RETRY_DELAY_RE = re.compile(r"^(\d+(?:\.\d+)?)s$")
# Candidate finish reasons that mean the model (or a safety filter) declined to produce the answer.
_GEMINI_REFUSALS = {"SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY", "LANGUAGE"}


class GeminiProvider:
    """Google Gemini via the official `google-genai` SDK (Gemini Developer API).

    The key is handed to the SDK, which sends it in the `x-goog-api-key` header (never the URL); it is not stored
    on this object, logged, or included in any error message. 429 is never retried (it would only burn free-tier
    quota) and is surfaced as `rate_limit` with the server's retry delay.

    Retries are bounded by one time budget (default 1.5 x the per-call timeout): only fast "overloaded" answers
    (500, 502, 503) are retried, after 2 s then 4 s, and only while a useful attempt still fits; each attempt's timeout
    is capped to the time left. A 504 or a client timeout is not retried: it already used a full timeout. (The SDK's
    own retry policy also retried those, each with the full timeout: on 2026-11-13 one question took 72 s for
    503, 503, 504, and the worst case exceeded the Copilot page's 120 s limit, which discarded the evidence.)
    """

    name = "gemini"

    RETRY_CODES = (500, 502, 503)          # fast "try again" answers; 503 "high demand" is common on the free tier
    RETRY_DELAYS_S = (2.0, 4.0)            # at most 3 attempts
    MIN_ATTEMPT_S = 20.0                   # never start an attempt with less time than this left in the budget

    def __init__(self, api_key: str, model: str, timeout_s: float, base_url: str = "", thinking_level: str = "low",
                 client: Any = None, budget_s: float | None = None, sleep: Any = time.sleep,
                 clock: Any = time.monotonic):
        from google.genai import errors, types

        self._types, self._errors = types, errors
        self.model = model
        self.thinking_level = (thinking_level or "low").upper()
        self.timeout_s = float(timeout_s)
        self.budget_s = float(budget_s) if budget_s else self.timeout_s * 1.5
        self._sleep, self._clock = sleep, clock
        self.last_call: dict[str, Any] | None = None
        if client is None:
            from google import genai

            http = types.HttpOptions(
                timeout=int(timeout_s * 1000),
                retry_options=types.HttpRetryOptions(attempts=1),  # no SDK retries: generate_json owns them
                **({"base_url": base_url} if base_url else {}))
            client = genai.Client(api_key=api_key, http_options=http)
        self.client = client

    def _config(self, system: str, schema: dict, max_tokens: int, timeout_s: float):
        t = self._types
        return t.GenerateContentConfig(
            system_instruction=system, response_mime_type="application/json", response_json_schema=schema,
            max_output_tokens=max_tokens, thinking_config=t.ThinkingConfig(thinking_level=self.thinking_level),
            http_options=t.HttpOptions(timeout=int(timeout_s * 1000), retry_options=t.HttpRetryOptions(attempts=1)))

    def _map_api_error(self, e, attempts: int = 1) -> LLMError:
        code, status, msg = getattr(e, "code", None), (getattr(e, "status", None) or ""), (getattr(e, "message", "") or "")
        if code == 429 or status == "RESOURCE_EXHAUSTED":
            daily = bool(re.search(r"per ?day|PerDay|daily", json.dumps(getattr(e, "details", None), default=str)))
            return LLMError("rate_limit", "Gemini free-tier quota reached (" + ("daily request limit" if daily else
                            "per-minute limit") + ").", _gemini_retry_after(e))
        if code in (401, 403) or status in ("UNAUTHENTICATED", "PERMISSION_DENIED") or "API key" in msg:
            return LLMError("auth", "Gemini rejected the credentials (check LLM_API_KEY and that the Generative "
                                    "Language API is enabled for its project).")
        if code == 404 or status == "NOT_FOUND":
            return LLMError("bad_request", f"Gemini model '{self.model}' is not available to this API key.")
        if code in (408, 504) or status == "DEADLINE_EXCEEDED":
            return LLMError("timeout", "Gemini request timed out.")
        if code is not None and 400 <= code < 500:
            return LLMError("bad_request", f"Gemini rejected the request (HTTP {code} {status}).")
        tries = f" after {attempts} attempts" if attempts > 1 else ""
        if code == 503 or status == "UNAVAILABLE":
            return LLMError("unavailable", f"Gemini is temporarily overloaded (HTTP 503{', high demand' if 'demand' in msg else ''}){tries}.")
        return LLMError("unavailable", f"Gemini service error (HTTP {code}{' ' + status if status else ''}){tries}.")

    def _call(self, system: str, user: str, schema: dict, max_tokens: int):
        """One logical request: bounded retries of fast overload errors inside the time budget."""
        start, attempt = self._clock(), 0
        while True:
            attempt += 1
            left = self.budget_s - (self._clock() - start)
            try:
                return self.client.models.generate_content(
                    model=self.model, contents=user,
                    config=self._config(system, schema, max_tokens, min(self.timeout_s, left)))
            except self._errors.APIError as e:
                code = getattr(e, "code", None)
                delay = self.RETRY_DELAYS_S[attempt - 1] if attempt <= len(self.RETRY_DELAYS_S) else None
                room = self.budget_s - (self._clock() - start) - (delay or 0)
                if code in self.RETRY_CODES and delay is not None and room >= self.MIN_ATTEMPT_S:
                    log.info("llm retry provider=gemini model=%s http=%s attempt=%d wait=%.0fs", self.model, code,
                             attempt, delay)
                    self._sleep(delay)
                    continue
                raise self._map_api_error(e, attempt) from None
            except Exception as e:  # transport layer (httpx/httpx2) errors: not retried
                kind = "timeout" if "timeout" in type(e).__name__.lower() else "unavailable"
                raise LLMError(kind, "Gemini request timed out." if kind == "timeout" else
                               f"Could not reach Gemini ({type(e).__name__}).") from None

    def generate_json(self, system: str, user: str, schema: dict, max_tokens: int = 16000) -> dict[str, Any]:
        t0 = time.perf_counter()
        resp = self._call(system, user, schema, max_tokens)
        ms = int((time.perf_counter() - t0) * 1000)
        usage = getattr(resp, "usage_metadata", None)
        self.last_call = {"model_version": getattr(resp, "model_version", None) or self.model, "latency_ms": ms,
                          "input_tokens": getattr(usage, "prompt_token_count", None),
                          "output_tokens": getattr(usage, "candidates_token_count", None),
                          "thinking_tokens": getattr(usage, "thoughts_token_count", None)}
        block = getattr(getattr(resp, "prompt_feedback", None), "block_reason", None)
        cands = getattr(resp, "candidates", None) or []
        finish = _enum_name(getattr(cands[0], "finish_reason", None)) if cands else None
        log.info("llm call provider=gemini model=%s ms=%s finish=%s in=%s out=%s think=%s", self.last_call["model_version"],
                 ms, finish or _enum_name(block), self.last_call["input_tokens"], self.last_call["output_tokens"],
                 self.last_call["thinking_tokens"])
        if block or finish in _GEMINI_REFUSALS:
            raise LLMError("refusal", "The model declined to answer this request.")
        if finish == "MAX_TOKENS":
            raise LLMError("bad_output", "LLM output was truncated.")
        text = "".join(getattr(p, "text", None) or "" for p in (getattr(getattr(cands[0], "content", None), "parts", None)
                                                                 or [])
                       if not getattr(p, "thought", False)) if cands else ""
        if not text.strip():
            raise LLMError("bad_output", "LLM returned an empty response.")
        try:
            data = json.loads(text)
        except ValueError:
            raise LLMError("bad_output", "LLM did not return valid JSON.") from None
        if not isinstance(data, dict):
            raise LLMError("bad_output", "LLM JSON was not an object.")
        return data


def _enum_name(v: Any) -> str | None:
    if v is None:
        return None
    return getattr(v, "name", None) or str(v).split(".")[-1]


def _gemini_retry_after(e) -> float | None:
    """Server-suggested wait: google.rpc.RetryInfo.retryDelay (e.g. "17s") or a Retry-After header."""
    details = getattr(e, "details", None)
    err = details.get("error", details) if isinstance(details, dict) else {}
    for d in (err.get("details") or []) if isinstance(err, dict) else []:
        m = _RETRY_DELAY_RE.match(str(d.get("retryDelay", ""))) if isinstance(d, dict) else None
        if m:
            return float(m.group(1))
    try:
        ra = getattr(getattr(e, "response", None), "headers", {}).get("retry-after")
        return float(ra) if ra else None
    except (TypeError, ValueError, AttributeError):
        return None


PROVIDERS = {"anthropic": "anthropic", "gemini": "google.genai"}  # provider name -> SDK module it needs

_override: LLMProvider | None = None
_override_set = False
_cached: tuple[tuple, LLMProvider] | None = None


def set_llm(provider: LLMProvider | None) -> None:
    """Test hook / DI: force a provider (or None for retrieval-only)."""
    global _override, _override_set
    _override, _override_set = provider, True


def _sdk_missing(provider: str) -> bool:
    import importlib.util

    mod = PROVIDERS.get(provider)
    try:
        return mod is None or importlib.util.find_spec(mod) is None
    except ModuleNotFoundError:
        return True


def get_llm() -> LLMProvider | None:
    global _cached
    if _override_set:
        return _override
    s = get_settings()
    p = s.llm_provider.lower()
    if not s.llm_configured or p not in PROVIDERS or _sdk_missing(p):
        if s.llm_configured:
            log.warning("LLM_PROVIDER=%s unavailable (no adapter or SDK missing); assistant runs retrieval-only", p)
        return None
    # One client per configuration (connection reuse); the key is part of the identity but never logged.
    ident = (p, s.llm_model, s.llm_timeout_s, s.llm_base_url, s.llm_thinking_level, hash(s.llm_api_key))
    if _cached and _cached[0] == ident:
        return _cached[1]
    if p == "gemini":
        prov: LLMProvider = GeminiProvider(s.llm_api_key, s.llm_model, s.llm_timeout_s, s.llm_base_url,
                                           s.llm_thinking_level)
    else:
        prov = AnthropicProvider(s.llm_api_key, s.llm_model, s.llm_timeout_s, s.llm_base_url)
    _cached = (ident, prov)
    return prov


# --- quota circuit breaker -------------------------------------------------------------------------------------
# After a 429 the provider tells us how long to wait (free-tier daily limits reset at midnight Pacific). Until then
# every model call would fail again and still cost latency, so synthesis is paused and answers are evidence-only.
_pause: dict[str, Any] | None = None


def pause_synthesis(seconds: float, reason: str) -> None:
    global _pause
    seconds = max(1.0, min(float(seconds), 36 * 3600.0))
    _pause = {"until": time.time() + seconds, "reason": reason}
    log.warning("LLM synthesis paused for %.0f s: %s", seconds, reason)


def synthesis_paused() -> dict[str, Any] | None:
    """{'until': epoch_s, 'seconds_left': int, 'reason': str} while paused, else None."""
    global _pause
    if _pause and time.time() >= _pause["until"]:
        _pause = None
    if not _pause:
        return None
    return {**_pause, "seconds_left": int(_pause["until"] - time.time())}


def resume_synthesis() -> None:
    global _pause
    _pause = None


def _with_pause(status: dict) -> dict:
    p = synthesis_paused()
    if p and status.get("configured"):
        from datetime import datetime, timezone

        until = datetime.fromtimestamp(p["until"], timezone.utc).strftime("%H:%M UTC")
        return {**status, "mode": "paused", "paused_until": until, "paused_seconds_left": p["seconds_left"],
                "reason": f"{p['reason']} AI synthesis resumes at about {until}; until then answers are evidence-only."}
    return status


def llm_status() -> dict:
    return _with_pause(_llm_status())


def _llm_status() -> dict:
    s = get_settings()
    p = s.llm_provider.lower()
    if _override_set:
        return {"configured": _override is not None, "provider": getattr(_override, "name", None),
                "model": getattr(_override, "model", None), "mode": "synthesis" if _override else "retrieval_only",
                "reason": None if _override else "LLM disabled for this process."}
    if not s.llm_configured:
        return {"configured": False, "provider": s.llm_provider, "model": s.llm_model, "mode": "retrieval_only",
                "reason": "LLM_API_KEY is not set. Set LLM_PROVIDER, LLM_MODEL and LLM_API_KEY in .env to enable "
                          "AI synthesis. Search, tools and citations work without it."}
    if p not in PROVIDERS:
        return {"configured": False, "provider": s.llm_provider, "model": s.llm_model, "mode": "retrieval_only",
                "reason": f"LLM_PROVIDER '{s.llm_provider}' has no adapter; supported: {', '.join(PROVIDERS)}."}
    if _sdk_missing(p):
        return {"configured": False, "provider": s.llm_provider, "model": s.llm_model, "mode": "retrieval_only",
                "reason": f"The Python SDK for '{p}' is not installed (pip install -r backend/requirements.txt)."}
    return {"configured": True, "provider": s.llm_provider, "model": s.llm_model, "mode": "synthesis", "reason": None}
