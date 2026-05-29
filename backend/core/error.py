import time
import logging
import functools
import traceback
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


class AgentError(Exception):
    """Base class for all agentic workflow errors."""

    def __init__(self, message: str, original: Exception | None = None):
        super().__init__(message)
        self.original = original
        self.message = message

    def __str__(self):
        return self.message


# ── LLM / Model errors ──────────────────────────────────────────────────────────


class LLMRateLimitError(AgentError):
    """LLM rate limit or quota exceeded. (HTTP 429)"""

    pass


class TokenLimitError(AgentError):
    """Prompt or completion exceeds model context window."""

    pass


class ToolCallError(AgentError):
    """LLM generated invalid tool call JSON or skipped tool calling."""

    def __init__(
        self,
        message: str,
        failed_generation: str = "",
        original: Exception | None = None,
    ):
        super().__init__(message, original)
        self.failed_generation = failed_generation


class ModelUnavailableError(AgentError):
    """Model endpoint is down or overloaded. (HTTP 502/503)"""

    pass


class AuthenticationError(AgentError):
    """Invalid or expired API key. (HTTP 401)"""

    pass


class BadRequestError(AgentError):
    """Malformed request — usually prompt/schema mismatch. (HTTP 400)"""

    pass


# ── Tool / Data errors ───────────────────────────────────────────────────────────


class ToolExecutionError(AgentError):
    """Tool function raised an exception during execution."""

    def __init__(self, tool_name: str, message: str, original: Exception | None = None):
        super().__init__(message, original)
        self.tool_name = tool_name


class DataFetchError(AgentError):
    """External data source returned empty/None. Retries exhausted."""

    def __init__(self, source: str, symbol: str, original: Exception | None = None):
        super().__init__(f"Data fetch failed for {symbol} from {source}", original)
        self.source = source
        self.symbol = symbol


class DataParseError(AgentError):
    """Fetched data was malformed or missing expected fields."""

    pass


# ── Graph / Workflow errors ───────────────────────────────────────────────────────


class NodeExecutionError(AgentError):
    """
    A LangGraph node crashed with a truly unexpected (unclassified) exception.
    This is ONLY raised for raw unknown errors — typed AgentErrors bubble through
    the node layer unchanged, so this class signals 'something we didn't anticipate'.
    """

    def __init__(self, node_name: str, message: str, original: Exception | None = None):
        super().__init__(message, original)
        self.node_name = node_name


class StateError(AgentError):
    """Required key missing or None in LangGraph state."""

    def __init__(self, key: str, original: Exception | None = None):
        super().__init__(f"Required state key missing or None: '{key}'", original)
        self.key = key


class MaxRetriesExceeded(AgentError):
    """Retry budget exhausted for a retryable operation."""

    def __init__(
        self, operation: str, attempts: int, original: Exception | None = None
    ):
        super().__init__(
            f"Max retries ({attempts}) exceeded for: {operation}", original
        )
        self.operation = operation
        self.attempts = attempts


# ── 2. ERROR CLASSIFIER ─────────────────────────────────────────────────────────


def classify_llm_error(exc: Exception) -> AgentError:
    """
    Inspect a raw LLM/Groq/Anthropic exception and return the correct typed
    AgentError subclass. Called only for raw (untyped) exceptions.
    """
    exc_str = str(exc).lower()
    exc_type = type(exc).__name__

    if any(
        k in exc_str
        for k in ["rate_limit", "rate limit", "429", "too many requests", "quota"]
    ):
        return LLMRateLimitError(
            "LLM rate limit hit — back off and retry", original=exc
        )

    if "tool_use_failed" in exc_str or "failed_generation" in exc_str:
        failed_gen = ""
        if hasattr(exc, "response"):
            try:
                body = exc.response.json()
                failed_gen = body.get("error", {}).get("failed_generation", "")
            except Exception:
                pass
        return ToolCallError(
            "LLM generated prose instead of a valid tool call JSON.",
            failed_generation=failed_gen,
            original=exc,
        )

    if any(
        k in exc_str
        for k in [
            "context_length",
            "token",
            "maximum context",
            "too long",
            "max_tokens",
        ]
    ):
        return TokenLimitError("Prompt exceeds model context window", original=exc)

    if any(
        k in exc_str
        for k in ["401", "authentication", "invalid api key", "unauthorized"]
    ):
        return AuthenticationError("Invalid or expired API key", original=exc)

    if any(
        k in exc_str
        for k in ["502", "503", "service unavailable", "bad gateway", "overloaded"]
    ):
        return ModelUnavailableError(
            "Model endpoint unavailable — retry later", original=exc
        )

    if "400" in exc_str or "bad_request" in exc_str.replace(" ", "_"):
        return BadRequestError(f"Bad request to LLM API: {exc}", original=exc)

    return AgentError(f"Unclassified LLM error [{exc_type}]: {exc}", original=exc)


# ── 4. DECORATORS ───────────────────────────────────────────────────────────────


def handle_llm_errors(reraise: bool = True) -> Callable[[F], F]:
    """
    Decorator for any method that calls an LLM API directly.
    """

    def decorator(fn: F) -> F:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            label = fn.__qualname__
            try:
                return fn(*args, **kwargs)

            except AgentError:
                # Already typed — pass through without re-wrapping
                raise

            except Exception as raw_exc:
                typed = classify_llm_error(raw_exc)
                logger.error(f"[{label}] {type(typed).__name__}: {typed.message}")
                if isinstance(typed, ToolCallError) and typed.failed_generation:
                    logger.debug(
                        f"[{label}] failed_generation preview: "
                        f"{typed.failed_generation[:300]}"
                    )
                raise typed

        return wrapper  # type: ignore

    return decorator


def handle_node_errors(node_name: str) -> Callable[[F], F]:
    """
    Decorator for LangGraph node functions.

    Behaviour:
    - Already-typed AgentErrors → re-raised immediately, NO wrapping as NodeExecutionError
      This means AuthenticationError, RateLimitError, etc. arrive at FastAPI unchanged
      with the correct HTTP status — no stacking.
    - Truly unknown raw exceptions → wrapped as NodeExecutionError so LangGraph
      surfaces a clean error instead of a raw traceback.
    """

    def decorator(fn: F) -> F:
        @functools.wraps(fn)
        def wrapper(state: dict, *args, **kwargs):
            try:
                return fn(state, *args, **kwargs)

            except AgentError:
                # Already typed — let it bubble up unchanged.
                # FastAPI will map it directly to the right HTTP status.
                raise

            except Exception as exc:
                # Truly unknown — wrap with node context for debugging
                tb = traceback.format_exc()
                logger.error(
                    f"[node:{node_name}] unhandled exception\n"
                    f"state_keys={list(state.keys())}\n{tb}"
                )
                raise NodeExecutionError(
                    node_name=node_name,
                    message=f"Node '{node_name}' crashed: {exc}",
                    original=exc,
                )

        return wrapper  # type: ignore

    return decorator


# ── 5. STATE VALIDATOR ──────────────────────────────────────────────────────────


def validate_state(state: dict, *required_keys: str) -> None:
    """
    Assert all required keys exist in LangGraph state and are not None/empty.
    Raises StateError immediately with the missing key name.
    """
    for key in required_keys:
        if key not in state or state[key] is None or state[key] == "":
            raise StateError(key=key)
