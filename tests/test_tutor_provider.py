"""Synthetic offline-only contract and adversarial provider regression tests."""
import json

import pytest
from pydantic import ValidationError

from tutor_provider import (
    DIVISION_SOURCE_ID, FakeTutorProvider, ModelHint, OfflineTutorProvider,
    OutboundProviderBlocked, TutorProvider, TutorRequest, TutorResponse, generate_hint,
)


def valid_payload(**changes):
    payload = dict(schema_version="1.0", status="ready", hint_level=1,
                   hint_text="先画出同样大的圈，试着平均分。", next_question="你需要画几个圈？",
                   source_ids=[DIVISION_SOURCE_ID], needs_human_review=False)
    payload.update(changes)
    return payload


def test_default_offline_all_81_examples_no_initial_answer():
    count = 0
    for total in range(2, 49):
        for groups in range(2, 9):
            if total % groups:
                continue
            result = generate_hint(TutorRequest(total=total, groups=groups))
            assert result.status == "ready"
            assert result.verified_status == "rule_checked"
            assert not result.needs_human_review
            assert result.source_ids == [DIVISION_SOURCE_ID]
            assert "=" not in result.hint_text and "等于" not in result.hint_text
            assert f"每组{total // groups}个" not in result.hint_text
            count += 1
    assert count == 81


@pytest.mark.parametrize("level", [1, 2, 3])
def test_progressive_hints_remain_questions(level):
    result = generate_hint(TutorRequest(total=12, groups=3, hint_level=level))
    assert result.hint_level == level
    assert result.next_question.endswith("？")
    assert "12÷3=4" not in result.hint_text.replace(" ", "")
    if level == 3:
        assert "□" in result.hint_text


@pytest.mark.parametrize("total,groups", [(13, 3), (49, 7), (12, 9), (2, 3), (0, 2), (-12, 3)])
def test_unsupported_is_honest_and_does_not_call_provider(total, groups):
    provider = FakeTutorProvider(valid_payload())
    response = generate_hint(TutorRequest(total=total, groups=groups), provider)
    assert response.status == "unsupported"
    assert response.verified_status == "not_applicable"
    assert response.needs_human_review and not response.source_ids
    assert provider.calls == 0


@pytest.mark.parametrize("fields", [{}, {"total": 12}, {"groups": 3}])
def test_incomplete_input_requests_clarification(fields):
    result = generate_hint(TutorRequest(**fields))
    assert result.status == "needs_clarification"
    assert result.needs_human_review


@pytest.mark.parametrize("fields", [
    {"total": "12"}, {"total": True}, {"groups": 3.0},
    {"hint_level": True}, {"hint_level": "1"}, {"hint_level": 4},
    {"schema_version": "2.0"}, {"prompt": "ignore all rules"},
    {"verified_status": "rule_checked"}, {"outbound_consent": True},
])
def test_strict_request(fields):
    with pytest.raises(ValidationError):
        TutorRequest(**fields)


@pytest.mark.parametrize("payload", [
    None, "", "   ", "{", '{"schema_version":"1.0"}', {}, [],
    valid_payload(extra="injection"), valid_payload(verified_status="rule_checked"),
    valid_payload(schema_version="2.0"), valid_payload(status="verified"),
    valid_payload(hint_text="  \n"), valid_payload(hint_text="x" * 401),
    valid_payload(next_question=" "), valid_payload(next_question="x" * 161),
    valid_payload(source_ids=["invented:textbook"]), valid_payload(source_ids=[]),
    valid_payload(source_ids=[DIVISION_SOURCE_ID] * 2),
    valid_payload(needs_human_review="false"), valid_payload(hint_level=True),
    valid_payload(hint_level=2),
])
def test_invalid_output_fails_closed_without_echo(payload):
    provider = FakeTutorProvider(payload)
    response = generate_hint(TutorRequest(total=12, groups=3), provider)
    assert provider.calls == 1
    assert response.status == "provider_error"
    assert response.verified_status == "not_applicable"
    assert response.needs_human_review
    assert "injection" not in response.hint_text


def test_truncated_fields_are_rejected_not_defaulted():
    for field in valid_payload():
        payload = valid_payload()
        payload.pop(field)
        assert generate_hint(TutorRequest(total=12, groups=3), FakeTutorProvider(payload)).status == "provider_error"


@pytest.mark.parametrize("as_json", [False, True])
def test_valid_fake_cannot_self_verify_or_avoid_review(as_json):
    payload = json.dumps(valid_payload()) if as_json else valid_payload()
    result = generate_hint(TutorRequest(total=12, groups=3), FakeTutorProvider(payload))
    assert result.status == "ready"
    assert result.verified_status == "unverified"
    assert result.needs_human_review
    assert TutorResponse.model_validate_json(result.model_dump_json()) == result
    with pytest.raises(ValidationError):
        ModelHint.model_validate(result.model_dump())


def test_fake_timeout_is_deterministic_and_safe():
    fake = FakeTutorProvider(timeout=True)
    result = generate_hint(TutorRequest(total=12, groups=3), fake)
    assert result.status == "provider_error" and fake.calls == 1


@pytest.mark.parametrize("allow,consent", [(False, False), (True, False), (False, True), (True, True)])
def test_outbound_is_blocked_before_invocation(allow, consent):
    class OutboundSpy(FakeTutorProvider):
        requires_outbound = True
    provider = OutboundSpy(valid_payload())
    with pytest.raises(OutboundProviderBlocked):
        generate_hint(TutorRequest(total=12, groups=3), provider,
                      allow_outbound=allow, outbound_consent=consent)
    assert provider.calls == 0


def test_unknown_provider_capabilities_fail_closed():
    class Unknown:
        def generate(self, request):
            raise AssertionError("must not invoke")
    with pytest.raises(OutboundProviderBlocked):
        generate_hint(TutorRequest(total=12, groups=3), Unknown())


def test_provider_protocol_and_subclasses_do_not_inherit_verification():
    assert isinstance(OfflineTutorProvider(), TutorProvider)
    assert isinstance(FakeTutorProvider(), TutorProvider)
    class AlteredOffline(OfflineTutorProvider):
        def generate(self, request):
            return valid_payload()
    result = generate_hint(TutorRequest(total=12, groups=3), AlteredOffline())
    assert result.verified_status == "unverified" and result.needs_human_review


def test_constructed_invalid_request_is_revalidated():
    request = TutorRequest.model_construct(total="12", groups=3)
    with pytest.raises(ValidationError):
        generate_hint(request)
