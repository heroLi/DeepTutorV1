"""Read-only, allowlisted parent records; no solutions or private plans."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from fastapi import HTTPException

from learning_flow import public_session


class InvalidRecord(ValueError):
    pass


def _timestamp(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise InvalidRecord()
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise InvalidRecord()
    return parsed.astimezone(timezone.utc).isoformat()


def _count(value):
    if type(value) is not int or value < 0:
        raise InvalidRecord()
    return value


def _record(row, learner):
    state = json.loads(row['state'])
    if not isinstance(state, dict):
        raise InvalidRecord()
    for key, expected in (('id', row['id']), ('lesson_id', row['lesson_id']), ('learner', learner)):
        if state.get(key) != expected:
            raise InvalidRecord()
    if not all(re.fullmatch('[0-9a-f]{32}', state[key]) for key in ('id', 'lesson_id')):
        raise InvalidRecord()
    stage, status = state['stage'], state['status']
    if stage not in ('initial', 'transfer') or status not in ('attempting', 'solved', 'completed'):
        raise InvalidRecord()
    if (status == 'completed' and stage != 'transfer') or (status == 'solved' and stage != 'initial'):
        raise InvalidRecord()
    numbers = state['numbers'][stage]
    if (not isinstance(numbers, (list, tuple)) or len(numbers) != 2
            or any(type(n) is not int for n in numbers)
            or not (2 <= numbers[0] <= 48 and 2 <= numbers[1] <= 8)
            or numbers[0] % numbers[1]):
        raise InvalidRecord()
    raw_evidence = state['evidence']
    expected_kinds = ['initial'] if stage == 'initial' else ['initial', 'transfer']
    if not isinstance(raw_evidence, list) or len(raw_evidence) != len(expected_kinds):
        raise InvalidRecord()
    evidence = []
    for item, kind in zip(raw_evidence, expected_kinds):
        if (not isinstance(item, dict)
                or not {'kind', 'first_attempt_correct', 'hints_used', 'attempt_count', 'independent_evidence'} <= item.keys()
                or item['kind'] != kind):
            raise InvalidRecord()
        correct = item['first_attempt_correct']
        independent = item['independent_evidence']
        if (correct is not None and type(correct) is not bool) or type(independent) is not bool:
            raise InvalidRecord()
        hints = _count(item['hints_used'])
        attempts = _count(item['attempt_count'])
        evidence.append(dict(kind=kind, first_attempt_correct=correct, hints_used=hints,
            attempt_count=attempts, independent_evidence=bool(independent and kind == 'transfer'
                and status == 'completed' and correct is True and item.get('hints_used') == 0
                and hints == 0 and attempts == 1),
            first_attempt_at=_timestamp(item.get('first_attempt_at')),
            last_attempt_at=_timestamp(item.get('last_attempt_at'))))
    # Preserve optional historic dates while requiring the original evidence fields.
    # Never expose its hints/feedback or serialize the private state itself.
    projection = public_session({**state, 'evidence': evidence})
    return dict(session_id=state['id'], lesson_id=state['lesson_id'], status=status, stage=stage,
        question=projection['question'], evidence=evidence,
        created_at=_timestamp(state.get('created_at')), updated_at=_timestamp(state.get('updated_at')),
        continue_url=f"/learn?session={state['id']}&learner={learner}",
        curriculum_label=projection['curriculum_label'])


def read_records(db, learner):
    if learner not in ('sister', 'little_sister'):
        raise HTTPException(422, '无效的学习档案')
    try:
        with db() as connection:
            rows = connection.execute('''SELECT s.id, s.lesson_id, s.state
                FROM practice_sessions s JOIN lessons l ON l.id=s.lesson_id AND l.learner=s.learner
                WHERE s.learner=? AND l.learner=? ORDER BY s.rowid''', (learner, learner)).fetchall()
        records = [_record(row, learner) for row in rows]
        # Python's stable sort preserves insertion order for unknown/equal times.
        records.sort(key=lambda item: (item['updated_at'] is not None,
            datetime.fromisoformat(item['updated_at']) if item['updated_at'] else datetime.min.replace(tzinfo=timezone.utc)),
            reverse=True)
    except (ValueError, KeyError, TypeError, IndexError, OverflowError):
        raise HTTPException(500, '练习记录暂时无法读取，请检查本地记录后重试') from None
    completed = sum(record['status'] == 'completed' for record in records)
    return dict(schema_version='1.0', learner=learner,
        generated_at=datetime.now(timezone.utc).isoformat(), records=records,
        summary=dict(sessions=len(records), completed=completed, in_progress=len(records)-completed,
            independent_transfer_evidence=sum(item['independent_evidence']
                for record in records for item in record['evidence'])))
