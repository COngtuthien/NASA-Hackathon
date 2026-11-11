"""Gemini adapter: request shape, response parsing and error mapping with a fake SDK client (no network, no key)."""
from __future__ import annotations

import json
import logging
from types import SimpleNamespace as NS

import pytest

genai_errors = pytest.importorskip("google.genai.errors")

from app.providers.llm import GeminiProvider, LLMError  # noqa: E402

SCHEMA = {"type": "object", "properties": {"answer": {"type": "string"}}, "required": ["answer"]}
FAKE_KEY = "test-key-never-sent-0123456789"


class FakeModels:
    def __init__(self, outcome):
        self.outcome = outcome
        self.calls: list[dict] = []

    def generate_content(self, *, model, contents, config):
        self.calls.append({"model": model, "contents": contents, "config": config})
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


def provider(outcome, **kw):
    fake = NS(models=FakeModels(outcome))
    return GeminiProvider(FAKE_KEY, "gemini-3.8-flash", 30, client=fake, **kw), fake.models


def response(text=None, finish="STOP", block=None, parts=None, usage=True):
    parts = parts if parts is not None else ([NS(text=text, thought=False)] if text is not None else [])
    return NS(candidates=[NS(finish_reason=NS(name=finish), content=NS(parts=parts))],
              prompt_feedback=NS(block_reason=block) if block else None, model_version="gemini-3.8-flash",
              usage_metadata=NS(prompt_token_count=120, candidates_token_count=40, thoughts_token_count=12)
              if usage else None)


def api_error(code, status, message="", details=None):
    body = {"error": {"code": code, "status": status, "message": message, "details": details or []}}
    cls = genai_errors.ClientError if code < 500 else genai_errors.ServerError
    return cls(code, body)


def test_request_shape_json_schema_and_thinking():
    p, models = provider(response(json.dumps({"answer": "ok [cite-1]"})), thinking_level="low")
    out = p.generate_json("SYS", "USER", SCHEMA, max_tokens=2000)
    assert out == {"answer": "ok [cite-1]"}
    call = models.calls[0]
    cfg = call["config"]
    assert call["model"] == "gemini-3.8-flash" and call["contents"] == "USER"
    assert cfg.system_instruction == "SYS" and cfg.response_mime_type == "application/json"
    assert cfg.response_json_schema == SCHEMA and cfg.max_output_tokens == 2000
    assert str(cfg.thinking_config.thinking_level).endswith("LOW")
    assert p.last_call["input_tokens"] == 120 and p.last_call["output_tokens"] == 40
    assert p.last_call["latency_ms"] >= 0 and p.last_call["model_version"] == "gemini-3.8-flash"


def test_thought_parts_are_ignored():
    parts = [NS(text="thinking about it", thought=True), NS(text='{"answer": "x"}', thought=False)]
    p, _ = provider(response(parts=parts))
    assert p.generate_json("s", "u", SCHEMA) == {"answer": "x"}


@pytest.mark.parametrize("resp,kind", [
    (response("not json"), "bad_output"),
    (response("[1, 2]"), "bad_output"),
    (response(""), "bad_output"),
    (response(parts=[]), "bad_output"),
    (response('{"answer": "cut', finish="MAX_TOKENS"), "bad_output"),
    (response(None, finish="SAFETY"), "refusal"),
    (response(None, finish="PROHIBITED_CONTENT"), "refusal"),
    (response(None, block=NS(name="SAFETY")), "refusal"),
    (NS(candidates=[], prompt_feedback=None, model_version=None, usage_metadata=None), "bad_output"),
])
def test_malformed_and_refused_responses(resp, kind):
    p, _ = provider(resp)
    with pytest.raises(LLMError) as e:
        p.generate_json("s", "u", SCHEMA)
    assert e.value.kind == kind


def test_rate_limit_with_retry_delay_and_daily_quota():
    details = [{"@type": "type.googleapis.com/google.rpc.QuotaFailure",
                "violations": [{"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]},
               {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "17s"}]
    p, _ = provider(api_error(429, "RESOURCE_EXHAUSTED", "Quota exceeded", details))
    with pytest.raises(LLMError) as e:
        p.generate_json("s", "u", SCHEMA)
    assert e.value.kind == "rate_limit" and e.value.retry_after == 17.0 and "daily" in str(e.value)


def test_rate_limit_per_minute():
    p, _ = provider(api_error(429, "RESOURCE_EXHAUSTED", "Quota exceeded"))
    with pytest.raises(LLMError) as e:
        p.generate_json("s", "u", SCHEMA)
    assert e.value.kind == "rate_limit" and "per-minute" in str(e.value) and e.value.retry_after is None


@pytest.mark.parametrize("err,kind", [
    (api_error(400, "INVALID_ARGUMENT", "API key not valid. Please pass a valid API key."), "auth"),
    (api_error(403, "PERMISSION_DENIED", "denied"), "auth"),
    (api_error(401, "UNAUTHENTICATED", "no"), "auth"),
    (api_error(404, "NOT_FOUND", "model gone"), "bad_request"),
    (api_error(400, "INVALID_ARGUMENT", "schema too deep"), "bad_request"),
    (api_error(504, "DEADLINE_EXCEEDED", "slow"), "timeout"),
    (api_error(503, "UNAVAILABLE", "overloaded"), "unavailable"),
    (api_error(500, "INTERNAL", "boom"), "unavailable"),
])
def test_api_error_mapping(err, kind):
    p, _ = provider(err)
    with pytest.raises(LLMError) as e:
        p.generate_json("s", "u", SCHEMA)
    assert e.value.kind == kind
    assert FAKE_KEY not in str(e.value)


def test_transport_errors():
    import httpx2

    p, _ = provider(httpx2.ReadTimeout("slow"))
    with pytest.raises(LLMError) as e:
        p.generate_json("s", "u", SCHEMA)
    assert e.value.kind == "timeout"
    p, _ = provider(httpx2.ConnectError("offline"))
    with pytest.raises(LLMError) as e:
        p.generate_json("s", "u", SCHEMA)
    assert e.value.kind == "unavailable"


def test_key_not_kept_on_provider_or_in_logs(caplog):
    caplog.set_level(logging.DEBUG)
    p, _ = provider(response('{"answer": "x"}'))
    p.generate_json("s", "u", SCHEMA)
    assert FAKE_KEY not in repr(vars(p)) and FAKE_KEY not in caplog.text


def test_real_client_is_built_with_header_auth_and_timeout():
    p = GeminiProvider(FAKE_KEY, "gemini-3.8-flash", 45)
    opts = p.client._api_client._http_options
    assert opts.timeout == 45000 and opts.retry_options.attempts == 3
    assert 429 not in opts.retry_options.http_status_codes
    assert opts.headers.get("x-goog-api-key") == FAKE_KEY  # header, never a ?key= query parameter
    assert FAKE_KEY not in (opts.base_url or "")


def test_get_llm_selects_gemini_and_status(monkeypatch):
    from app.core.config import get_settings
    from app.providers import llm

    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_MODEL", "gemini-3.8-flash")
    monkeypatch.setenv("LLM_API_KEY", FAKE_KEY)
    monkeypatch.setattr(llm, "_override_set", False)
    get_settings.cache_clear()
    try:
        prov = llm.get_llm()
        assert isinstance(prov, GeminiProvider) and llm.get_llm() is prov  # cached client
        st = llm.llm_status()
        assert st["configured"] and st["provider"] == "gemini" and st["mode"] == "synthesis"
        assert FAKE_KEY not in json.dumps(st)
        monkeypatch.setenv("LLM_PROVIDER", "mystery")
        get_settings.cache_clear()
        assert llm.get_llm() is None and "no adapter" in llm.llm_status()["reason"]
    finally:
        monkeypatch.delenv("LLM_PROVIDER")
        monkeypatch.setenv("LLM_API_KEY", "")
        get_settings.cache_clear()
