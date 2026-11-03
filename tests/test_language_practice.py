"""Synthetic multilingual practice: no models, network or personal information."""
import json
import os
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor

os.environ['TUTOR_DATA_DIR'] = tempfile.mkdtemp(prefix='language-test-')
import pytest
from fastapi.testclient import TestClient
import app as service
import learning_flow
from language_practice import ITEMS


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


def create(client, subject='chinese', **extra):
    return client.post('/api/language-practice-sessions', json=dict(
        learner='sister', subject=subject, request_id=str(uuid.uuid4()), parent_confirmed=True, **extra))


def new(client, subject='chinese', learner='sister', request_id=None):
    return client.post('/api/language-practice-sessions', json=dict(learner=learner,
        subject=subject, request_id=request_id or str(uuid.uuid4()), parent_confirmed=True))


def action(client, state, kind, answer=None, **extra):
    body = dict(learner=state['learner'], expected_revision=state['revision'], action_id=str(uuid.uuid4()))
    if answer is not None:
        body['answer'] = answer
    body.update(extra)
    return client.post(f"/api/practice-sessions/{state['id']}/{kind}", json=body)


def private(state):
    with service.db() as c:
        return json.loads(c.execute('SELECT state FROM practice_sessions WHERE id=?', (state['id'],)).fetchone()['state'])


def solution(state):
    s = private(state)
    return ITEMS[s['items'][s['stage']]]['answer']


@pytest.mark.parametrize('subject', ['chinese', 'english'])
def test_complete_first_then_fresh_transfer_records_export(client, subject):
    state = new(client, subject).json()['session']
    assert state['subject'] == subject
    assert state['hint_level'] == state['attempt_count'] == 0
    assert state['hint_text'] == ''
    assert action(client, state, 'hint').status_code == 409
    assert action(client, state, 'next').status_code == 409
    original = state['question']
    state = action(client, state, 'attempt', solution(state)).json()
    assert not state['evidence'][0]['independent_evidence']
    state = action(client, state, 'next').json()
    assert state['question'] != original
    state = action(client, state, 'attempt', solution(state)).json()
    assert state['status'] == 'completed'
    assert state['evidence'][-1]['independent_evidence']
    export = client.get('/api/practice-records/export?learner=sister')
    assert export.status_code == 200 and export.headers['cache-control'] == 'no-store'
    record = export.json()['records'][0]
    assert record['subject'] == subject and record['question'] == state['question']
    assert '非特定教材' in record['curriculum_label']
    assert export.json()['summary']['independent_transfer_evidence'] == 1
    assert action(client, state, 'attempt', solution(state)).status_code == 409


@pytest.mark.parametrize('subject', ['chinese', 'english'])
def test_progressive_hints_do_not_claim_independent(client, subject):
    state = new(client, subject).json()['session']
    state = action(client, state, 'attempt', solution(state)).json()
    state = action(client, state, 'next').json()
    state = action(client, state, 'attempt', '还不会').json()
    texts = []
    for level in range(1, 4):
        state = action(client, state, 'hint').json()
        assert state['hint_level'] == level
        texts.append(state['hint_text'])
    assert len(set(texts)) == 3
    assert action(client, state, 'hint').status_code == 409
    state = action(client, state, 'attempt', solution(state)).json()
    assert state['status'] == 'completed'
    assert not state['evidence'][-1]['independent_evidence']
    assert state['evidence'][-1]['attempt_count'] == 2


@pytest.mark.parametrize('subject', ['chinese', 'english'])
def test_no_answer_future_content_or_private_state_in_payload(client, subject):
    state = new(client, subject).json()['session']
    raw = private(state)
    assert ITEMS[raw['items']['transfer']]['question'] not in json.dumps(state, ensure_ascii=False)
    for field in ('items', 'answer', 'answers', 'plan', 'hints', 'numbers'):
        assert field not in state
    records = client.get('/api/practice-records?learner=sister').json()
    serialized = json.dumps(records, ensure_ascii=False)
    assert ITEMS[raw['items']['transfer']]['question'] not in serialized
    assert '"answer"' not in serialized and '"items"' not in serialized
    assert client.get('/api/lessons?learner=sister').json() == []
    lesson = client.get(f"/api/lessons/{state['lesson_id']}?learner=sister").json()
    assert set(lesson['plan']) == {'title'}
    assert client.post(f"/api/lessons/{state['lesson_id']}/answer", json={'learner':'sister','answer':'test'}).status_code == 422


def test_invalid_schema_confirmation_and_cross_origin(client):
    body = dict(learner='sister', subject='chinese', request_id=str(uuid.uuid4()), parent_confirmed=True)
    for field, value in [('learner','real-child'), ('subject','science'), ('request_id','invalid'), ('parent_confirmed','true')]:
        assert client.post('/api/language-practice-sessions', json={**body,field:value}).status_code == 422
    assert client.post('/api/language-practice-sessions', json={**body,'parent_confirmed':False}).status_code == 422
    assert client.post('/api/language-practice-sessions', json={**body,'provider':'deepseek'}).status_code == 422
    assert client.post('/api/language-practice-sessions', json=body, headers={'origin':'https://elsewhere.invalid'}).status_code == 403


def test_creation_double_click_action_retry_refresh_and_stale_revision(client):
    key = str(uuid.uuid4())
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: new(client, request_id=key), range(2)))
    assert all(r.status_code == 200 for r in responses)
    state = responses[0].json()['session']
    assert responses[1].json()['session']['id'] == state['id']
    assert new(client, subject='english', request_id=key).status_code == 409
    action_id = str(uuid.uuid4())
    first = action(client, state, 'attempt', '错', action_id=action_id).json()
    assert action(client, state, 'attempt', '错', action_id=action_id).json() == first
    assert action(client, state, 'attempt', '不同', action_id=action_id).status_code == 409
    assert action(client, state, 'hint').status_code == 409
    assert client.get(f"/api/practice-sessions/{state['id']}?learner=sister").json() == first
    assert new(client, request_id=key).json()['session'] == first


def test_profile_isolation_and_cross_subject_mix(client):
    a = new(client).json()['session']
    b = new(client, 'english').json()['session']
    other = new(client, learner='little_sister').json()['session']
    assert other['question'] == a['question']  # independent synthetic learner history
    assert client.get(f"/api/practice-sessions/{a['id']}?learner=little_sister").status_code == 404
    assert action(client, a, 'attempt', '小', learner='little_sister').status_code == 404
    records = client.get('/api/practice-records?learner=sister').json()['records']
    assert {r['subject'] for r in records} == {'chinese','english'}
    assert len(client.get('/api/practice-records?learner=little_sister').json()['records']) == 1
    assert client.delete(f"/api/lessons/{a['lesson_id']}?learner=little_sister").status_code == 404


@pytest.mark.parametrize('subject', ['chinese', 'english'])
def test_exhaustion_and_deletion_keep_seen_item_tombstones(client, subject):
    seen = set()
    for _ in range(4):
        key = str(uuid.uuid4())
        response = new(client, subject, request_id=key)
        assert response.status_code == 200
        state = response.json()['session']
        ids = set(private(state)['items'].values())
        assert not seen & ids
        seen |= ids
        assert client.delete(f"/api/lessons/{state['lesson_id']}?learner=sister").status_code == 200
        assert new(client, subject, request_id=key).status_code == 410
    assert new(client, subject).status_code == 422
    assert client.get('/api/practice-records?learner=sister').json()['records'] == []
    assert new(client, subject, learner='little_sister').status_code == 200


def test_english_case_fullwidth_and_real_sound_rule(client):
    state = new(client, 'english').json()['session']
    assert action(client, state, 'attempt', ' Ａ ').json()['status'] == 'solved'
    assert all('发音' in item['hints'][0] and '音素' in item['hints'][1] for item in ITEMS.values() if item['subject'] == 'english')


def test_valid_chinese_context_synonym(client):
    new(client)  # reserve first pair, second initial is high/low table
    state = new(client).json()['session']
    assert action(client, state, 'attempt', '矮').json()['status'] == 'solved'


def test_math_after_language_and_language_after_math(client):
    new(client)
    lesson = client.post('/api/lessons', json={'learner':'sister','total':12,'groups':3}).json()
    assert client.post(f"/api/lessons/{lesson['id']}/study", json={'learner':'sister','reviewed':True,'plan':lesson['plan']}).status_code == 200
    math = client.post(f"/api/lessons/{lesson['id']}/practice-session", json={'learner':'sister','request_id':str(uuid.uuid4())}).json()['session']
    math = action(client, math, 'attempt', '4').json()
    math = action(client, math, 'next').json()
    assert math['stage'] == 'transfer'
    assert new(client, 'english').status_code == 200
    assert len(client.get('/api/practice-records?learner=sister').json()['records']) == 3


def test_corrupt_language_state_returns_bounded_record_error(client):
    state = new(client).json()['session']
    raw = private(state)
    raw['items']['transfer'] = 'secret-invalid-id'
    with service.db() as c:
        c.execute('UPDATE practice_sessions SET state=? WHERE id=?', (json.dumps(raw),state['id']))
    response = client.get('/api/practice-records?learner=sister')
    assert response.status_code == 500 and 'secret-invalid-id' not in response.text


def test_language_never_calls_provider_and_legacy_mutations_blocked(client, monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError('Language practice must not invoke a model or provider')
    monkeypatch.setattr(learning_flow, 'generate_hint', forbidden)
    state = new(client, 'english').json()['session']
    state = action(client, state, 'attempt', '还不会').json()
    assert action(client, state, 'hint').status_code == 200
    from core import demo_plan
    body = {'learner':'sister', 'reviewed':True, 'plan':demo_plan(12,3).model_dump(mode='json')}
    for route in ('render', 'study'):
        assert client.post(f"/api/lessons/{state['lesson_id']}/{route}", json=body).status_code == 409
    assert client.post(f"/api/lessons/{state['lesson_id']}/practice-session", json={
        'learner':'sister','request_id':str(uuid.uuid4())}).status_code == 422


def test_delete_removes_answers_dates_and_responses_but_keeps_minimal_tombstones(client):
    state = new(client).json()['session']
    state = action(client, state, 'attempt', 'synthetic-secret-answer').json()
    assert client.delete(f"/api/lessons/{state['lesson_id']}?learner=sister").status_code == 200
    with service.db() as c:
        for table in ('lessons', 'practice_sessions', 'practice_attempts', 'practice_actions'):
            assert c.execute(f'SELECT COUNT(*) AS n FROM {table}').fetchone()['n'] == 0
        assert [r['name'] for r in c.execute('PRAGMA table_info(language_reserved_items)')] == ['learner','item_id']
        assert [r['name'] for r in c.execute('PRAGMA table_info(language_session_requests)')] == ['learner','request_id','subject','session_id']
        assert c.execute('SELECT COUNT(*) AS n FROM language_reserved_items').fetchone()['n'] == 2


def test_distinct_concurrent_requests_reserve_distinct_questions(client):
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: new(client, 'english'), range(2)))
    states = [r.json()['session'] for r in responses]
    assert all(r.status_code == 200 for r in responses)
    assert not set(private(states[0])['items'].values()) & set(private(states[1])['items'].values())
