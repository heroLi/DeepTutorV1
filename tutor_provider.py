"""Offline-first hint boundary. No network, credentials, or learner records.

Use generate_hint(TutorRequest(total=12, groups=3)). ModelHint is the
untrusted provider contract; only the server adds TutorResponse.verified_status.
Source IDs refer to local rules, not approved textbooks or curriculum evidence.
"""
from __future__ import annotations

from typing import Annotated, Any, Literal, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

SCHEMA_VERSION = "1.0"
DIVISION_SOURCE_ID = "offline:division-equal-groups-v1"
KNOWN_SOURCE_IDS = frozenset({DIVISION_SOURCE_ID})
HintLevel = Literal[1, 2, 3]
HintStatus = Literal["ready", "needs_clarification", "unsupported", "provider_error"]


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)


class TutorRequest(_StrictModel):
    schema_version: Literal["1.0"] = SCHEMA_VERSION
    # None means the question is incomplete. Out-of-domain integers are handled
    # honestly as unsupported, not silently clamped or turned into valid examples.
    total: int | None = None
    groups: int | None = None
    hint_level: HintLevel = 1

    @field_validator("hint_level", mode="before")
    @classmethod
    def strict_hint_level(cls, value: Any) -> Any:
        if type(value) is not int:
            raise ValueError("hint_level must be an integer")
        return value


class ModelHint(_StrictModel):
    """All fields are mandatory; a truncated payload is never a valid hint."""

    schema_version: Literal["1.0"]
    status: HintStatus
    hint_level: HintLevel
    hint_text: Annotated[str, Field(min_length=1, max_length=400)]
    next_question: Annotated[str, Field(min_length=1, max_length=160)]
    source_ids: Annotated[list[str], Field(max_length=4)]
    needs_human_review: bool

    @field_validator("hint_level", mode="before")
    @classmethod
    def strict_hint_level(cls, value: Any) -> Any:
        if type(value) is not int:
            raise ValueError("hint_level must be an integer")
        return value

    @field_validator("hint_text", "next_question")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be blank")
        return value

    @field_validator("source_ids")
    @classmethod
    def known_sources(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value) or any(s not in KNOWN_SOURCE_IDS for s in value):
            raise ValueError("unknown or duplicate source ID")
        return value


class TutorResponse(ModelHint):
    # Structural validation is not verification of a model's claims.
    verified_status: Literal["rule_checked", "unverified", "not_applicable"]


@runtime_checkable
class TutorProvider(Protocol):
    requires_outbound: bool

    def generate(self, request: TutorRequest) -> Any:
        """Return an untrusted mapping/JSON string, or raise TimeoutError."""
        ...


def _domain_status(request: TutorRequest) -> HintStatus:
    if request.total is None or request.groups is None:
        return "needs_clarification"
    if not (2 <= request.total <= 48 and 2 <= request.groups <= 8):
        return "unsupported"
    if request.total % request.groups != 0:
        return "unsupported"
    return "ready"


def _payload(request: TutorRequest, status: HintStatus, text: str, question: str) -> dict[str, Any]:
    return dict(schema_version=SCHEMA_VERSION, status=status, hint_level=request.hint_level,
                hint_text=text, next_question=question,
                source_ids=[DIVISION_SOURCE_ID] if status == "ready" else [],
                needs_human_review=status != "ready")


class OfflineTutorProvider:
    requires_outbound = False

    def generate(self, request: TutorRequest) -> dict[str, Any]:
        status = _domain_status(request)
        if status == "needs_clarification":
            return _payload(request, status, "题目还不完整，我需要先确认一共有多少个，要平均分成几组。", "一共有多少个？平均分成几组？")
        if status == "unsupported":
            return _payload(request, status, "这个离线示例只支持总数为2至48、组数为2至8且能整除的平均分问题。请家长或老师一起看这道题。", "可以先确认题目的总数和组数吗？")
        if request.hint_level == 1:
            return _payload(request, status, f"先画出{request.groups}个圈，表示要平均分成的组。平均分要求每组一样多，先不要急着写答案。", "题目里一共有多少个物品？你准备用什么表示它们？")
        if request.hint_level == 2:
            return _payload(request, status, f"用{request.total}个小点表示物品，每轮给每个圈放一个，直到所有小点分完。", "怎样检查每个圈里的小点一样多，而且没有剩下？")
        return _payload(request, status, f"可以用乘法检查：{request.groups} × □ = {request.total}。先试着填空，再数一数每组的物品。", "你想到哪个乘法口诀？能用画圈的方法检查吗？")


class FakeTutorProvider:
    """Deterministic test double. It never performs I/O or sleeps."""
    requires_outbound = False

    def __init__(self, payload: Any = None, *, timeout: bool = False):
        self.payload = payload
        self.timeout = timeout
        self.calls = 0

    def generate(self, request: TutorRequest) -> Any:
        self.calls += 1
        if self.timeout:
            raise TimeoutError("synthetic provider timeout")
        return self.payload


class OutboundProviderBlocked(PermissionError):
    pass


def generate_hint(request: TutorRequest, provider: TutorProvider | None = None, *,
                  allow_outbound: bool = False, outbound_consent: bool = False) -> TutorResponse:
    """Return a validated, fail-closed hint. Invalid requests raise ValidationError.

    Outbound flags do not enable a network implementation in this P0 build.
    Consent is a server-side policy decision, never a request/model-output field.
    """
    # Revalidate even constructed/mutated Pydantic instances at the trust boundary.
    request = TutorRequest.model_validate(request.model_dump(warnings=False) if isinstance(request, TutorRequest) else request)
    provider = OfflineTutorProvider() if provider is None else provider
    if getattr(provider, "requires_outbound", True) is not False:
        if allow_outbound is not True or outbound_consent is not True:
            raise OutboundProviderBlocked("Outbound provider requires explicit enablement and consent")
        raise OutboundProviderBlocked("Outbound providers are not implemented in this offline build")
    # An untrusted provider must not claim support for an out-of-domain question.
    if _domain_status(request) != "ready":
        hint = ModelHint.model_validate(OfflineTutorProvider().generate(request))
        return TutorResponse(**hint.model_dump(), verified_status="not_applicable")
    try:
        raw = provider.generate(request)
        hint = ModelHint.model_validate_json(raw) if isinstance(raw, (str, bytes)) else ModelHint.model_validate(raw)
        if hint.hint_level != request.hint_level:
            raise ValueError("provider changed requested hint level")
        if hint.status == "ready" and not hint.source_ids:
            raise ValueError("ready hint requires a known source")
    except (TimeoutError, ValidationError, ValueError, TypeError):
        hint = ModelHint.model_validate(_payload(request, "provider_error",
            "暂时无法提供可靠提示，请家长或老师一起检查题目。", "我们先确认题目里的总数和组数，好吗？"))
        return TutorResponse(**hint.model_dump(), verified_status="not_applicable")
    # Only this exact local implementation is eligible for rule_checked. A fake,
    # subclass or unrelated provider cannot elevate its own verification status.
    local = type(provider) is OfflineTutorProvider
    data = hint.model_dump()
    if not local:
        data["needs_human_review"] = True
    return TutorResponse(**data, verified_status="rule_checked" if local else "unverified")
