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
    """`outcome` is one response/exception for every call, or a list consumed call by call."""

    def __init__(self, outcome, clock=None):
        self.outcome = outcome
        self.calls: list[dict] = []
        self.clock = clock

    def generate_content(self, *, model, contents, config):
        self.calls.append({"model": model, "contents": contents, "config": config})
        r = self.outcome.pop(0) if isinstance(self.outcome, list) else self.outcome
        if self.clock is not None and isinstance(r, tuple):  # (seconds the call takes, outcome)
            self.clock.t += r[0]
            r = r[1]
        if isinstance(r, Exception):
            raise r
        return r


class FakeClock:
    def __init__(self):
        self.t = 0.0
        self.sleeps: list[float] = []

    def __call__(self):
        return self.t

    def sleep(self, s):
        self.sleeps.append(s)
        self.t += s


def provider(outcome, clock=None, **kw):
    clock = clock or FakeClock()
    fake = NS(models=FakeModels(outcome, clock))
    return GeminiProvider(FAKE_KEY, "gemini-3.8-flash", 30, client=fake, sleep=clock.sleep, clock=clock, **kw), fake.models


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
    # The SDK never retries on its own (its default retries 504s and client timeouts, each with the full timeout,
    # which took 72 s on 2026-11-13 and could exceed 3 minutes); retries are owned by the bounded loop below.
    assert opts.timeout == 45000 and opts.retry_options.attempts == 1
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


# --- bounded retries (regression for the 2026-11-13 Copilot failure: 503, 503, then a 504 after 72 s) -----------------

def overloaded():
    return api_error(503, "UNAVAILABLE", "This model is currently experiencing high demand. Spikes in demand are "
                                         "usually temporary. Please try again later.")


def test_overload_is_retried_then_succeeds():
    clock = FakeClock()
    p, models = provider([(2.5, overloaded()), (2.5, overloaded()), (8.0, response('{"answer": "ok"}'))], clock=clock)
    assert p.generate_json("s", "u", SCHEMA) == {"answer": "ok"}
    assert len(models.calls) == 3 and clock.sleeps == [2.0, 4.0]


def test_persistent_overload_is_reported_as_overload_not_a_server_error():
    clock = FakeClock()
    p, models = provider([(2.5, overloaded())] * 3, clock=clock)
    with pytest.raises(LLMError) as e:
        p.generate_json("s", "u", SCHEMA)
    assert e.value.kind == "unavailable"
    assert "overloaded" in str(e.value) and "3 attempts" in str(e.value)
    assert len(models.calls) == 3


def test_gateway_timeout_is_not_retried():
    clock = FakeClock()
    p, models = provider([(30.0, api_error(504, "DEADLINE_EXCEEDED", "slow"))], clock=clock)
    with pytest.raises(LLMError) as e:
        p.generate_json("s", "u", SCHEMA)
    assert e.value.kind == "timeout" and len(models.calls) == 1 and clock.sleeps == []


def test_client_timeout_is_not_retried():
    import httpx2

    p, models = provider([httpx2.ReadTimeout("slow")])
    with pytest.raises(LLMError) as e:
        p.generate_json("s", "u", SCHEMA)
    assert e.value.kind == "timeout" and len(models.calls) == 1


def test_total_time_is_bounded_by_the_budget():
    """A slow overload never makes the user wait past the budget: no retry starts without room for a real attempt,
    and each attempt's timeout is capped to the time that remains."""
    clock = FakeClock()
    p, models = provider([(25.0, overloaded()), (25.0, overloaded()), (25.0, overloaded())], clock=clock,
                         budget_s=45)
    with pytest.raises(LLMError) as e:
        p.generate_json("s", "u", SCHEMA)
    assert e.value.kind == "unavailable"
    assert len(models.calls) == 1            # 25 s used + 2 s backoff leaves < 20 s: no second attempt
    assert clock.t <= 45
    timeouts = [c["config"].http_options.timeout for c in models.calls]
    assert timeouts == [30000]               # min(per-attempt timeout 30 s, remaining 45 s)


def test_retry_timeout_shrinks_to_the_remaining_budget():
    clock = FakeClock()
    p, models = provider([(10.0, overloaded()), (5.0, response('{"answer": "ok"}'))], clock=clock, budget_s=45)
    assert p.generate_json("s", "u", SCHEMA) == {"answer": "ok"}
    assert [c["config"].http_options.timeout for c in models.calls] == [30000, 30000 - 0]  # 33 s left > 30 s cap
    clock2 = FakeClock()
    p2, models2 = provider([(20.0, overloaded()), (5.0, response('{"answer": "ok"}'))], clock=clock2, budget_s=45)
    assert p2.generate_json("s", "u", SCHEMA) == {"answer": "ok"}
    assert models2.calls[1]["config"].http_options.timeout == 23000  # 45 - 20 - 2 s backoff
