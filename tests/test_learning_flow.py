"""Synthetic offline child-flow regressions, including refresh and races."""
import json
import os
import re
import tempfile
import uuid
from concurrent.futures import ThreadPoolExecutor

os.environ['TUTOR_DATA_DIR'] = tempfile.mkdtemp(prefix='tutor-flow-test-')
import pytest
from fastapi.testclient import TestClient
import app as service
import learning_flow
from core import demo_plan


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


def lesson(client, *, total=12, groups=3, confirmed=True, edited=False, source='demo'):
    item = client.post('/api/lessons', json={'learner':'sister', 'total':total, 'groups':groups}).json()
    if edited:
        item['plan']['answer'] = '999'
    if confirmed:
        response = client.post(f"/api/lessons/{item['id']}/study", json={
            'learner':'sister', 'reviewed':True, 'plan':item['plan']})
        assert response.status_code == 200
    if source != 'demo':
        with service.db() as c:
            c.execute('UPDATE lessons SET source=? WHERE id=?', (source,item['id']))
    return item


def create(client, item, learner='sister', **extra):
    return client.post(f"/api/lessons/{item['id']}/practice-session", json={
        'learner':learner, 'request_id':str(uuid.uuid4()), **extra})


def session(client, **kwargs):
    return create(client, lesson(client, **kwargs)).json()['session']


def action(client, state, kind, answer=None, **extra):
    body = dict(learner=state['learner'], action_id=str(uuid.uuid4()), expected_revision=state['revision'])
    if answer is not None:
        body['answer'] = answer
    body.update(extra)
    return client.post(f"/api/practice-sessions/{state['id']}/{kind}", json=body)


def correct(state):
    total, groups = map(int, re.findall(r'\d+', state['question']))
    return str(total//groups)


def transfer(client):
    s = session(client)
    s = action(client, s, 'attempt', correct(s)).json()
    return action(client, s, 'next').json()


def test_confirmation_source_and_edited_gate(client):
    assert create(client, lesson(client, confirmed=False)).status_code == 409
    assert create(client, lesson(client, source='model')).status_code == 422
    assert create(client, lesson(client, edited=True)).status_code == 422
    assert create(client, lesson(client), learner='little_sister').status_code == 404
    item = lesson(client)
    with service.db() as c:
        c.execute("UPDATE lessons SET state='ready' WHERE id=?", (item['id'],))
    assert create(client, item).status_code == 200


def test_public_allowlist_no_solution_or_legacy_plan(client):
    s = session(client)
    assert set(s) == {'id','learner','lesson_id','revision','stage','status','question','hint_level',
                      'hint_text','feedback','attempt_count','evidence','curriculum_label'}
    assert s['hint_text'] == '' and s['feedback'] == ''
    serialized = json.dumps(s, ensure_ascii=False)
    for forbidden in ('"answer"', '"plan"', '"scenes"', '"numbers"', '÷', ' = ', '等于', '每人分到 4'):
        assert forbidden not in serialized
    assert s['evidence'][0]['first_attempt_correct'] is None
    assert action(client, s, 'hint').status_code == 409
    assert action(client, s, 'next').status_code == 409


def test_create_refresh_and_cross_profile_isolation(client):
    item = lesson(client)
    first = create(client, item).json()
    assert create(client,item).json() == first
    s = first['session']
    assert first['learn_url'] == f"/learn?session={s['id']}&learner=sister"
    s = action(client,s,'attempt','0').json()
    assert create(client,item).json()['session'] == s
    assert client.get(f"/api/practice-sessions/{s['id']}?learner=sister").json() == s
    assert client.get(f"/api/practice-sessions/{s['id']}?learner=little_sister").status_code == 404
    assert action(client,s,'attempt','4',learner='little_sister').status_code == 404


def test_wrong_retry_and_progressive_hints_preserved(client):
    s = session(client)
    s = action(client,s,'attempt','0').json()
    for level in (1,2,3):
        s = action(client,s,'hint').json()
        assert s['hint_level'] == level and s['hint_text']
        assert s['evidence'][0]['first_attempt_correct'] is False
    assert action(client,s,'hint').status_code == 409
    s = action(client,s,'attempt',correct(s)).json()
    assert s['status'] == 'solved'
    assert s['evidence'][0] == dict(kind='initial',first_attempt_correct=False,hints_used=3,
                                  attempt_count=2,independent_evidence=False,
                                  first_attempt_at=s['evidence'][0]['first_attempt_at'],
                                  last_attempt_at=s['evidence'][0]['last_attempt_at'])
    initial = s['evidence'][0]
    s = action(client,s,'next').json()
    assert s['evidence'][0] == initial
    assert s['hint_level'] == 0 and s['attempt_count'] == 0 and s['hint_text'] == ''
    s = action(client,s,'attempt','0').json()
    s = action(client,s,'hint').json()
    s = action(client,s,'attempt',correct(s)).json()
    assert s['status'] == 'completed'
    assert s['evidence'][-1]['independent_evidence'] is False
    assert s['evidence'][-1]['hints_used'] == 1
    assert action(client,s,'attempt',correct(s)).status_code == 409
    assert action(client,s,'next').status_code == 409
    assert client.get('/api/memory?learner=sister').json()['profile']['attempts'] == 0


def test_transfer_first_wrong_retry_not_independent_even_without_hints(client):
    s = transfer(client)
    s = action(client,s,'attempt','0').json()
    s = action(client,s,'attempt',correct(s)).json()
    assert s['evidence'][-1]['first_attempt_correct'] is False
    assert s['evidence'][-1]['independent_evidence'] is False
    assert s['evidence'][-1]['hints_used'] == 0


def test_independent_only_fresh_first_correct(client):
    s = transfer(client)
    assert s['evidence'][0]['first_attempt_correct'] is True
    assert s['evidence'][0]['independent_evidence'] is False
    s = action(client,s,'attempt',correct(s)).json()
    assert s['status'] == 'completed' and s['evidence'][-1]['independent_evidence'] is True
    assert '不代表' in s['feedback']


def test_transfer_bounded_distinct_for_entire_domain():
    for total in range(2,49):
        for groups in range(2,9):
            if total % groups:
                continue
            assert learning_flow._numbers(demo_plan(total,groups).model_dump()) == (total,groups)
            n,g = learning_flow._fresh_numbers(total,groups)
            assert 2 <= n <= 48 and 2 <= g <= 8 and n % g == 0
            assert n not in (total,total+groups)
            assert n//g not in (total//groups,total//groups+1)


def test_action_replay_stale_and_changed_payload(client):
    s = session(client); action_id = str(uuid.uuid4())
    r = action(client,s,'attempt','0',action_id=action_id)
    assert r.status_code == 200
    assert action(client,s,'attempt','0',action_id=action_id).json() == r.json()
    assert action(client,s,'attempt','4',action_id=action_id).status_code == 409
    assert action(client,s,'hint',action_id=action_id).status_code == 409
    assert action(client,s,'attempt','4').status_code == 409
    s = action(client,r.json(),'attempt','4').json()
    action_id = str(uuid.uuid4())
    nxt = action(client,s,'next',action_id=action_id).json()
    assert action(client,s,'next',action_id=action_id).json() == nxt
    assert action(client,nxt,'next').status_code == 409
    with service.db() as c:
        assert c.execute('SELECT count(*) FROM practice_attempts').fetchone()[0] == 2


def test_concurrent_attempts_only_one_revision(client):
    s = session(client)
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: action(client,s,'attempt','0'), range(2)))
    assert sorted(r.status_code for r in responses) == [200,409]
    saved = client.get(f"/api/practice-sessions/{s['id']}?learner=sister").json()
    assert saved['revision'] == 1 and saved['attempt_count'] == 1


def test_delete_cleans_all_records(client):
    s = session(client)
    action(client,s,'attempt','0')
    assert client.delete(f"/api/lessons/{s['lesson_id']}?learner=sister").status_code == 200
    assert client.get(f"/api/practice-sessions/{s['id']}?learner=sister").status_code == 404
    with service.db() as c:
        for table in ('practice_sessions','practice_attempts','practice_actions'):
            assert c.execute(f'SELECT count(*) FROM {table}').fetchone()[0] == 0


def test_strict_request_validation(client):
    item = lesson(client)
    assert create(client,item,request_id='invalid').status_code == 422
    s = create(client,item).json()['session']
    for extras in ({'action_id':'bad'}, {'expected_revision':True}, {'expected_revision':'0'},
                   {'expected_revision':-1}, {'hidden_answer':'4'}):
        assert action(client,s,'attempt','4',**extras).status_code == 422
    assert action(client,s,'attempt',4).status_code == 422
    assert action(client,s,'attempt','').status_code == 422


def test_concurrent_same_action_and_next_replay(client):
    s = session(client)
    action_id = str(uuid.uuid4())
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: action(client,s,'attempt',correct(s),action_id=action_id),range(2)))
    assert all(r.status_code == 200 for r in responses)
    assert responses[0].json() == responses[1].json()
    solved = responses[0].json()
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: action(client,solved,'next'),range(2)))
    assert sorted(r.status_code for r in responses) == [200,409]
    saved = client.get(f"/api/practice-sessions/{s['id']}?learner=sister").json()
    assert saved['revision'] == 2 and len(saved['evidence']) == 2
    # Schema initialization on restart is non-destructive and state is database-backed.
    with service.db() as c:
        learning_flow.initialize(c)
        assert c.execute('SELECT count(*) FROM practice_attempts').fetchone()[0] == 1
    fresh_client = TestClient(service.app)
    assert fresh_client.get(f"/api/practice-sessions/{s['id']}?learner=sister").json() == saved
    # Replaying a historical accepted action returns its original snapshot, never mutates.
    assert action(client,s,'attempt',correct(s),action_id=action_id).json() == solved
    assert fresh_client.get(f"/api/practice-sessions/{s['id']}?learner=sister").json() == saved


def test_transfer_fresh_across_sessions_and_profiles(client):
    first = transfer(client)
    action(client,first,'attempt',correct(first))
    second = transfer(client)
    assert first['question'] != second['question']
    # The other profile has its own question/evidence history.
    item = client.post('/api/lessons',json={'learner':'little_sister','total':12,'groups':3}).json()
    client.post(f"/api/lessons/{item['id']}/study",json={'learner':'little_sister','plan':item['plan'],'reviewed':True})
    other = create(client,item,learner='little_sister').json()['session']
    other = action(client,other,'attempt',correct(other)).json()
    other = action(client,other,'next').json()
    assert other['question'] == first['question']
    assert other['evidence'][-1]['first_attempt_correct'] is None


def test_legacy_correct_quiz_excludes_transfer(client):
    # Default new transfer would be 3/3; legacy 2/3 is unsupported, so use
    # 6/3 by reserving 3/3 as an existing initial question first.
    session(client,total=3,groups=3)
    prior = lesson(client,total=3,groups=3)
    assert client.post(f"/api/lessons/{prior['id']}/answer",json={'learner':'sister','answer':'2'}).json()['correct']
    fresh = transfer(client)
    assert tuple(map(int,re.findall(r'\d+',fresh['question']))) not in {(3,3),(6,3)}


def test_exhausted_pool_honest_and_help_seeking(client):
    excluded = {(n,g) for g in range(2,9) for n in range(g,49,g)}
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        learning_flow._fresh_numbers(12,3,excluded)
    assert exc.value.status_code == 422
    s = session(client)
    s = action(client,s,'attempt','还不会').json()
    assert '还不对' not in s['feedback'] and '提示' in s['feedback']
    assert s['evidence'][0]['first_attempt_correct'] is False
    assert s['evidence'][0]['independent_evidence'] is False
    assert action(client,s,'hint').status_code == 200


def test_transfer_exposed_by_later_initial_is_not_independent(client):
    reserved = transfer(client)
    total,groups = map(int,re.findall(r'\d+',reserved['question']))
    session(client,total=total,groups=groups)
    finished = action(client,reserved,'attempt',correct(reserved)).json()
    assert finished['status'] == 'completed'
    assert finished['evidence'][-1]['first_attempt_correct'] is True
    assert finished['evidence'][-1]['independent_evidence'] is False


def test_timestamps_record_real_actions_and_replay_is_unchanged(client, monkeypatch):
    monkeypatch.setattr(learning_flow, 'utc_now', lambda:'2026-11-03T08:00:00+00:00')
    s = session(client)
    with service.db() as c:
        before = json.loads(c.execute('SELECT state FROM practice_sessions WHERE id=?',(s['id'],)).fetchone()['state'])
    assert before['created_at']==before['updated_at']=='2026-11-03T08:00:00+00:00'
    assert s['evidence'][0]['first_attempt_at'] is None
    monkeypatch.setattr(learning_flow, 'utc_now', lambda:'2026-11-03T08:01:00+00:00')
    aid=str(uuid.uuid4());attempt=action(client,s,'attempt','0',action_id=aid).json()
    assert attempt['evidence'][0]['first_attempt_at']=='2026-11-03T08:01:00+00:00'
    assert attempt['evidence'][0]['last_attempt_at']=='2026-11-03T08:01:00+00:00'
    monkeypatch.setattr(learning_flow, 'utc_now', lambda:'2026-11-03T08:02:00+00:00')
    assert action(client,s,'attempt','0',action_id=aid).json()==attempt
    with service.db() as c:
        stored=json.loads(c.execute('SELECT state FROM practice_sessions WHERE id=?',(s['id'],)).fetchone()['state'])
    assert stored['updated_at']=='2026-11-03T08:01:00+00:00'
    retried=action(client,attempt,'attempt',correct(attempt)).json()
    assert retried['evidence'][0]['first_attempt_at']=='2026-11-03T08:01:00+00:00'
    assert retried['evidence'][0]['last_attempt_at']=='2026-11-03T08:02:00+00:00'


def test_old_first_attempt_timestamp_not_invented_on_retry(client,monkeypatch):
    s=session(client);s=action(client,s,'attempt','0').json()
    with service.db() as c:
        state=json.loads(c.execute('SELECT state FROM practice_sessions WHERE id=?',(s['id'],)).fetchone()['state'])
        for field in ('created_at','updated_at'):state.pop(field,None)
        for field in ('first_attempt_at','last_attempt_at'):state['evidence'][0].pop(field,None)
        c.execute('UPDATE practice_sessions SET state=? WHERE id=?',(json.dumps(state),s['id']))
    monkeypatch.setattr(learning_flow,'utc_now',lambda:'2026-11-03T08:03:00+00:00')
    retried=action(client,s,'attempt',correct(s)).json()
    assert retried['evidence'][0]['first_attempt_at'] is None
    assert retried['evidence'][0]['last_attempt_at']=='2026-11-03T08:03:00+00:00'
    with service.db() as c:
        stored=json.loads(c.execute('SELECT state FROM practice_sessions WHERE id=?',(s['id'],)).fetchone()['state'])
    assert 'created_at' not in stored
