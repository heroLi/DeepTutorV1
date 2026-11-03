"""Bounded offline practice. Private state is never serialized to the child API.

This is a local family application, not authentication or a multi-tenant boundary.
Only a fresh transfer's unaided first attempt is independent evidence, not mastery.
"""
from __future__ import annotations

import json
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from core import demo_plan
from tutor_provider import TutorRequest, generate_hint

Learner = Literal['sister', 'little_sister']


class SessionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    learner: Learner
    request_id: uuid.UUID


class ActionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    learner: Learner
    action_id: uuid.UUID
    expected_revision: int = Field(ge=0, strict=True)


class AttemptRequest(ActionRequest):
    answer: str = Field(min_length=1, max_length=60, strict=True)


def initialize(connection):
    connection.executescript('''
        CREATE TABLE IF NOT EXISTS practice_sessions (
            id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL, learner TEXT NOT NULL,
            state TEXT NOT NULL, UNIQUE(lesson_id, learner));
        CREATE TABLE IF NOT EXISTS practice_actions (
            session_id TEXT NOT NULL, action_id TEXT NOT NULL,
            payload TEXT NOT NULL, response TEXT NOT NULL,
            PRIMARY KEY(session_id, action_id));
        CREATE TABLE IF NOT EXISTS practice_attempts (
            id INTEGER PRIMARY KEY, session_id TEXT NOT NULL,
            kind TEXT NOT NULL, answer TEXT NOT NULL, correct INTEGER NOT NULL,
            hints_used INTEGER NOT NULL);
    ''')


def _numbers(plan):
    # Do not trust edited narration, answers, visuals or quiz as a rule source.
    match = re.fullmatch(r'(\d+)颗糖，平均分给(\d+)个小朋友，每人分到几颗？', plan.get('question', ''))
    if match:
        total, groups = map(int, match.groups())
        if 2 <= total <= 48 and 2 <= groups <= 8 and total % groups == 0:
            if plan == demo_plan(total, groups).model_dump(mode='json'):
                return total, groups
    raise HTTPException(422, '孩子练习目前只支持未经编辑的离线平均分示例；请新建示例并由家长确认')


def _fresh_numbers(total, groups, excluded=None):
    # The legacy parent plan exposes total+groups and its solution too. Exclude it.
    excluded = set() if excluded is None else excluded
    candidates = [(n, g) for g in range(2, 9) for n in range(g, 49, g)
                  if (n, g) not in excluded and n not in (total, total + groups)
                  and n // g not in (total // groups, total // groups + 1)]
    if not candidates:
        raise HTTPException(422, '当前离线示例的新题已经练过，请家长安排其他练习；重复题不会算作新题证据')
    return next((pair for pair in candidates if pair[1] == groups), candidates[0])


def _legacy_solved_pairs(connection, learner):
    pairs = set()
    rows = connection.execute('''SELECT DISTINCT l.plan FROM attempts a JOIN lessons l ON l.id=a.lesson
                                  WHERE a.learner=? AND l.learner=? AND a.correct=1 AND l.source='demo' ''',
                              (learner, learner)).fetchall()
    for row in rows:
        try:
            n, g = _numbers(json.loads(row['plan']))
        except HTTPException:
            continue
        pairs.add((n + g, g))
    return pairs


def _exposed_elsewhere(connection, state, pair):
    # A reserved question can become visible through another lesson between
    # session creation and answering. Recheck inside the same write transaction.
    rows = connection.execute('SELECT state FROM practice_sessions WHERE learner=? AND id!=?',
                              (state['learner'], state['id'])).fetchall()
    for row in rows:
        old = json.loads(row['state'])
        if pair == tuple(old['numbers']['initial']):
            return True
        if old['stage'] == 'transfer' and pair == tuple(old['numbers']['transfer']):
            return True
    return pair in _legacy_solved_pairs(connection, state['learner'])


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def _evidence(kind):
    return dict(kind=kind, first_attempt_correct=None, hints_used=0,
                attempt_count=0, independent_evidence=False,
                first_attempt_at=None, last_attempt_at=None)


def public_session(state):
    total, groups = state['numbers'][state['stage']]
    current = state['evidence'][-1]
    return dict(id=state['id'], learner=state['learner'], lesson_id=state['lesson_id'],
                revision=state['revision'], stage=state['stage'], status=state['status'],
                question=f'{total}颗糖，平均分给{groups}个小朋友，每人分到几颗？只填数字。',
                hint_level=current['hints_used'], hint_text=state['hint_text'],
                feedback=state['feedback'], attempt_count=current['attempt_count'],
                evidence=state['evidence'], curriculum_label='按能力练习 · 本题教材对应关系待核对 · 单次证据不代表掌握')


def _load(connection, session_id, learner):
    row = connection.execute('SELECT state FROM practice_sessions WHERE id=? AND learner=?',
                             (session_id, learner)).fetchone()
    if row is None:
        raise HTTPException(404, '此学习档案中没有这次练习')
    return json.loads(row['state'])


def create_session(db, lesson_id, request):
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        lesson = c.execute('SELECT * FROM lessons WHERE id=? AND learner=?',
                           (lesson_id, request.learner)).fetchone()
        if not lesson:
            raise HTTPException(404, '此学习档案中没有这道题')
        if lesson['state'] not in ('offline_ready', 'ready'):
            raise HTTPException(409, '请先由家长确认讲解稿')
        if lesson['source'] != 'demo':
            raise HTTPException(422, '孩子练习目前只支持离线规则示例')
        total, groups = _numbers(json.loads(lesson['plan']))
        row = c.execute('SELECT state FROM practice_sessions WHERE lesson_id=? AND learner=?',
                        (lesson_id, request.learner)).fetchone()
        if row:
            state = json.loads(row['state'])
        else:
            # Reserve both stages transactionally. A later session cannot relabel a
            # previously presented or reserved question as fresh evidence.
            excluded = set()
            prior = c.execute('SELECT state FROM practice_sessions WHERE learner=?',
                              (request.learner,)).fetchall()
            for previous in prior:
                old = json.loads(previous['state'])
                excluded.update(tuple(pair) for pair in old['numbers'].values())
            excluded.update(_legacy_solved_pairs(c, request.learner))
            fresh = _fresh_numbers(total, groups, excluded)
            timestamp = utc_now()
            state = dict(id=uuid.uuid4().hex, learner=request.learner, lesson_id=lesson_id,
                         created_at=timestamp, updated_at=timestamp,
                         revision=0, stage='initial', status='attempting', hint_text='', feedback='',
                         numbers={'initial': [total, groups], 'transfer': fresh},
                         evidence=[_evidence('initial')])
            c.execute('INSERT INTO practice_sessions VALUES(?,?,?,?)',
                      (state['id'], lesson_id, request.learner, json.dumps(state)))
    return {'session': public_session(state),
            'learn_url': f"/learn?session={state['id']}&learner={request.learner}"}


def read_session(db, session_id, learner):
    with db() as c:
        return public_session(_load(c, session_id, learner))


def act(db, session_id, request, kind):
    payload = json.dumps({'kind': kind, **request.model_dump(mode='json')}, sort_keys=True)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        state = _load(c, session_id, request.learner)
        replay = c.execute('SELECT payload,response FROM practice_actions WHERE session_id=? AND action_id=?',
                           (session_id, str(request.action_id))).fetchone()
        if replay:
            if replay['payload'] != payload:
                raise HTTPException(409, '这次操作编号已使用，请刷新练习后重试')
            return json.loads(replay['response'])
        if request.expected_revision != state['revision']:
            raise HTTPException(409, '练习已更新，请刷新后继续')
        current = state['evidence'][-1]
        total, groups = state['numbers'][state['stage']]
        if kind == 'next':
            if state['stage'] != 'initial' or state['status'] != 'solved':
                raise HTTPException(409, '先完成当前题目，再试一道新题')
            state.update(stage='transfer', status='attempting', hint_text='', feedback='这是一道新的练习题。先自己试一试。')
            state['evidence'].append(_evidence('transfer'))
        elif state['status'] != 'attempting':
            raise HTTPException(409, '本题已完成，请继续新题或查看练习记录')
        elif kind == 'hint':
            if not current['attempt_count']:
                raise HTTPException(409, '先自己试一次，再打开提示')
            if current['hints_used'] >= 3:
                raise HTTPException(409, '已显示全部三层提示，可以再试一次')
            level = current['hints_used'] + 1
            hint = generate_hint(TutorRequest(total=total, groups=groups, hint_level=level))
            if hint.status != 'ready':
                raise HTTPException(503, '提示暂时不可用，请稍后重试')
            current['hints_used'] = level
            state['hint_text'] = hint.hint_text
            state['feedback'] = '可以按提示画一画，再试一次。'
        elif kind == 'attempt':
            value = ''.join(unicodedata.normalize('NFKC', request.answer).split()).rstrip('。.')
            correct = value == str(total // groups)
            attempt_timestamp = utc_now()
            if current['attempt_count'] == 0:
                current['first_attempt_correct'] = correct
                current['first_attempt_at'] = attempt_timestamp
            else:
                current.setdefault('first_attempt_at', None)
            current['last_attempt_at'] = attempt_timestamp
            current['attempt_count'] += 1
            current['independent_evidence'] = bool(state['stage'] == 'transfer'
                and current['first_attempt_correct'] and current['hints_used'] == 0
                and not _exposed_elsewhere(c, state, (total, groups)))
            c.execute('INSERT INTO practice_attempts(session_id,kind,answer,correct,hints_used) VALUES(?,?,?,?,?)',
                      (session_id, state['stage'], request.answer, int(correct), current['hints_used']))
            if correct:
                state['status'] = 'solved' if state['stage'] == 'initial' else 'completed'
                state['feedback'] = ('答对了！接下来换一道新题。' if state['stage'] == 'initial' else
                    '这次新题独立答对了！这是一条练习证据，不代表已经掌握。' if current['independent_evidence'] else
                    '答对了！已保留首次作答和提示记录，可以以后继续练习。')
            else:
                state['feedback'] = ('没关系，可以打开提示，跟着画一画，再试一次。' if value == '还不会' else
                                     '还不对。想一想每组要一样多，可以再试一次，或打开提示。')
        else:
            raise ValueError('Unknown practice action')
        state['updated_at'] = utc_now()
        state['revision'] += 1
        result = public_session(state)
        c.execute('UPDATE practice_sessions SET state=? WHERE id=?', (json.dumps(state), session_id))
        c.execute('INSERT INTO practice_actions VALUES(?,?,?,?)',
                  (session_id, str(request.action_id), payload, json.dumps(result)))
        return result


def delete_sessions(connection, lesson_id):
    for table in ('practice_actions', 'practice_attempts'):
        connection.execute(f'DELETE FROM {table} WHERE session_id IN (SELECT id FROM practice_sessions WHERE lesson_id=?)', (lesson_id,))
    connection.execute('DELETE FROM practice_sessions WHERE lesson_id=?', (lesson_id,))
