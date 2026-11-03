"""Synthetic-only parent-record API tests. No fixture reads local family data."""
import json
import os
import tempfile
import uuid

os.environ['TUTOR_DATA_DIR'] = tempfile.mkdtemp(prefix='tutor-records-import-')
import pytest
from fastapi.testclient import TestClient
import app as service
import learning_flow


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(service, 'DATA', tmp_path)
    with service.db() as c:
        c.executescript('''CREATE TABLE lessons (
            id TEXT PRIMARY KEY, learner TEXT, state TEXT, plan TEXT, source TEXT,
            message TEXT, created TEXT, output TEXT DEFAULT '{}');
            CREATE TABLE attempts (id INTEGER PRIMARY KEY,lesson TEXT,learner TEXT,
            answer TEXT,correct INTEGER,created TEXT);''')
        learning_flow.initialize(c)
    return TestClient(service.app)


def seed(learner='sister', **updates):
    state = dict(id=uuid.uuid4().hex, lesson_id=uuid.uuid4().hex, learner=learner,
        stage='initial', status='attempting', revision=0, hint_text='', feedback='',
        numbers={'initial':[12,3], 'transfer':[27,3]},
        evidence=[dict(kind='initial', first_attempt_correct=None, hints_used=0,
                       attempt_count=0, independent_evidence=False)])
    state.update(updates)
    with service.db() as c:
        c.execute('INSERT INTO lessons(id,learner,state,plan,source,message,created) VALUES(?,?,?,?,?,?,?)',
            (state['lesson_id'], learner, 'offline_ready', '{"answer":"PRIVATE_SOLUTION"}', 'demo', '', '2020-01-01'))
        c.execute('INSERT INTO practice_sessions VALUES(?,?,?,?)',
            (state['id'], state['lesson_id'], learner, json.dumps(state)))
    return state


def read(client, learner='sister', export=False):
    return client.get('/api/practice-records' + ('/export' if export else '') + '?learner=' + learner)


def persist(state):
    with service.db() as c:
        c.execute('UPDATE practice_sessions SET state=? WHERE id=?', (json.dumps(state), state['id']))


def snapshot():
    with service.db() as c:
        return {table: [tuple(row) for row in c.execute('SELECT * FROM ' + table)]
            for table in ('lessons', 'practice_sessions', 'practice_actions', 'practice_attempts')}


def test_empty_and_profile_isolation(client):
    response = read(client)
    assert response.headers['cache-control'] == 'no-store'
    empty = response.json()
    assert empty['schema_version'] == '1.0'
    assert empty['records'] == []
    assert empty['summary'] == dict(sessions=0, completed=0, in_progress=0, independent_transfer_evidence=0)
    a, b = seed(), seed('little_sister')
    for learner, state in [('sister', a), ('little_sister', b)]:
        payload = read(client, learner).json()
        assert payload['learner'] == learner
        assert [r['session_id'] for r in payload['records']] == [state['id']]
    assert read(client, 'other').status_code == 422
    # A session whose joined lesson belongs to another profile is not visible.
    with service.db() as c:
        c.execute('UPDATE lessons SET learner=? WHERE id=?', ('little_sister', a['lesson_id']))
    assert read(client).json()['records'] == []


def test_old_timestamps_defaults_and_read_only(client):
    state = seed()
    before = snapshot()
    for _ in range(2):
        payload = read(client).json()
        record = payload['records'][0]
        assert record['created_at'] is None and record['updated_at'] is None
        assert record['evidence'] == [dict(kind='initial',first_attempt_correct=None,hints_used=0,
            attempt_count=0,independent_evidence=False,first_attempt_at=None,last_attempt_at=None)]
        assert record['continue_url'] == f"/learn?session={state['id']}&learner=sister"
        assert '教材对应关系待核对' in record['curriculum_label']
    assert snapshot() == before


def test_sort_known_timestamps_and_stable_unknown(client):
    old1 = seed()
    early = seed(updated_at='2026-10-30T08:00:00+08:00')
    latest = seed(updated_at='2026-10-30T01:00:00Z')
    old2 = seed()
    assert [r['session_id'] for r in read(client).json()['records']] == [s['id'] for s in [latest,early,old1,old2]]


def test_export_allowlist_fresh_read_no_answers_or_reserved_question(client):
    state = seed(provider='SECRET_PROVIDER', answer='SECRET_ANSWER', private_plan='SECRET_PLAN')
    state['evidence'][0]['answer'] = 'SECRET_ATTEMPT'
    persist(state)
    before = snapshot()
    response = read(client, export=True)
    assert response.status_code == 200
    assert response.headers['content-disposition'] == 'attachment; filename="practice-records-sister.json"'
    assert response.headers['cache-control'] == 'no-store'
    body = response.json()
    record = body['records'][0]
    assert set(record) == {'session_id','lesson_id','status','stage','question','evidence','created_at',
                           'updated_at','continue_url','curriculum_label'}
    assert record['question'].startswith('12颗糖')
    for private in ('SECRET_', 'PRIVATE_SOLUTION', '27颗糖', '"numbers"', '"answer"', '"revision"', '"plan"'):
        assert private not in response.text
    assert snapshot() == before
    state['status'] = 'solved'
    persist(state)
    assert read(client, export=True).json()['records'][0]['status'] == 'solved'


@pytest.mark.parametrize('changes,expected', [({},True), ({'first_attempt_correct':False},False),
    ({'hints_used':1},False), ({'attempt_count':2},False), ({'independent_evidence':False},False),
    ({'attempt_count':0},False)])
def test_summary_never_elevates_unsupported_independence(client, changes, expected):
    item = dict(kind='transfer', first_attempt_correct=True,hints_used=0,attempt_count=1,independent_evidence=True)
    item.update(changes)
    state = seed(stage='transfer',status='completed')
    state['evidence'].append(item)
    persist(state)
    body = read(client).json()
    assert body['summary'] == dict(sessions=1,completed=1,in_progress=0,independent_transfer_evidence=int(expected))
    assert body['records'][0]['evidence'][1]['independent_evidence'] is expected
    assert 'mastery' not in json.dumps(body)


def test_pending_transfer_and_initial_never_independent(client):
    s = seed()
    s['evidence'][0].update(first_attempt_correct=True,attempt_count=1,independent_evidence=True)
    persist(s)
    t = seed(stage='transfer')
    t['evidence'].append(dict(kind='transfer', first_attempt_correct=True, hints_used=0, attempt_count=1, independent_evidence=True))
    persist(t)
    body = read(client).json()
    assert body['summary']['independent_transfer_evidence'] == 0
    assert body['summary']['in_progress'] == 2


def test_deletion_reflected_without_stale_export(client):
    state = seed()
    assert len(read(client).json()['records']) == 1
    response = client.delete(f"/api/lessons/{state['lesson_id']}?learner=sister")
    assert response.status_code == 200
    assert read(client, export=True).json()['records'] == []


@pytest.mark.parametrize('corruption', ['{broken', 'null', '{"private":"NEVER_ECHO"}'])
def test_corruption_bounded_visible_and_recovery(client, corruption):
    state = seed()
    with service.db() as c:
        c.execute('UPDATE practice_sessions SET state=? WHERE id=?', (corruption,state['id']))
    before = snapshot()
    for export in (False, True):
        response = read(client, export=export)
        assert response.status_code == 500
        assert 'NEVER_ECHO' not in response.text and 'broken' not in response.text
        assert '无法读取' in response.json()['detail']
    assert snapshot() == before
    persist(state)
    assert read(client).status_code == 200


def test_mismatched_identity_and_invalid_timestamp_fail_closed(client):
    state = seed()
    original = dict(state)
    for updates in ({'learner':'little_sister'}, {'id':uuid.uuid4().hex}, {'lesson_id':uuid.uuid4().hex}, {'updated_at':'yesterday'}, {'stage':'reserved'},
                    {'evidence':[]}, {'numbers':{'initial':[12,0]}}):
        persist({**original, **updates})
        assert read(client).status_code == 500
    persist(original)
    assert read(client).status_code == 200


def test_missing_hint_history_cannot_become_independent(client):
    state = seed(stage='transfer', status='completed')
    state['evidence'].append(dict(kind='transfer', first_attempt_correct=True,
                                 attempt_count=1, independent_evidence=True))
    persist(state)
    assert read(client).status_code == 500


def test_timestamp_evidence_preserved_as_utc(client):
    state = seed(created_at='2026-11-01T08:00:00+08:00', updated_at='2026-11-01T08:01:00+08:00')
    state['evidence'][0].update(first_attempt_at='2026-11-01T08:00:30+08:00',
                               last_attempt_at='2026-11-01T08:01:00+08:00')
    persist(state)
    record = read(client).json()['records'][0]
    assert record['created_at'] == '2026-11-01T00:00:00+00:00'
    assert record['updated_at'] == '2026-11-01T00:01:00+00:00'
    assert record['evidence'][0]['first_attempt_at'] == '2026-11-01T00:00:30+00:00'
    assert record['evidence'][0]['last_attempt_at'] == '2026-11-01T00:01:00+00:00'


@pytest.mark.parametrize('field', ['kind', 'first_attempt_correct', 'hints_used', 'attempt_count', 'independent_evidence'])
def test_missing_core_evidence_is_corrupt_not_zero_history(client, field):
    state = seed()
    del state['evidence'][0][field]
    persist(state)
    for export in (False, True):
        response = read(client, export=export)
        assert response.status_code == 500
        assert '无法读取' in response.json()['detail']
