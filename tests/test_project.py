import json
import os
import tempfile
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

os.environ['TUTOR_DATA_DIR'] = tempfile.mkdtemp(prefix='tutor-test-')
import app as service
from core import demo_plan, extract_deeptutor, image_content, parse_plan

client = TestClient(service.app)


@pytest.fixture(autouse=True)
def clean():
    with service.db() as c:
        c.execute('DELETE FROM attempts')
        c.execute('DELETE FROM lessons')


def create():
    r = client.post('/api/lessons',json={'mode':'demo','learner':'sister','total':12,'groups':3})
    assert r.status_code == 200
    return r.json()


def ready(item):
    with service.db() as c:
        c.execute("UPDATE lessons SET state='ready' WHERE id=?",(item['id'],))


def test_all_supported_divisions():
    for total in range(2,49):
        for groups in range(2,9):
            if total >= groups and total % groups == 0:
                plan = demo_plan(total,groups)
                assert int(plan.answer)*groups == total
                assert int(plan.quiz.answer)*groups == total+groups
                assert plan.scenes[1].visual.total == total


def test_reject_non_divisible_demo():
    assert client.post('/api/lessons',json={'total':13,'groups':3}).status_code == 422


def test_model_structure_and_unclear_question():
    with pytest.raises(ValueError):
        parse_plan('{"error":"题目不清楚"}')
    obj=demo_plan().model_dump()
    obj['scenes'][0]['board']=['长'*100]
    with pytest.raises(ValueError):
        parse_plan(json.dumps(obj))


def test_no_remote_image_fetch():
    with pytest.raises(ValueError):
        image_content('https://example.com/image.jpg')


def test_deeptutor_content_and_errors():
    events=[{'type':'thinking','content':'不要展示的推理记录'},
            {'type':'content','content':'12÷3=4','metadata':{'call_id':'1','trace_kind':'llm_chunk'}},
            {'type':'progress','metadata':{'trace_kind':'call_status','call_state':'complete','call_role':'finish','call_id':'1'}}]
    assert extract_deeptutor('\n'.join(json.dumps(x) for x in events)) == '12÷3=4'
    with pytest.raises(RuntimeError):
        extract_deeptutor('{"type":"error","content":"failed"}')


def test_learner_record_separation():
    item=create()
    assert client.get(f'/api/lessons/{item["id"]}?learner=little_sister').status_code == 404
    assert client.get('/api/lessons?learner=little_sister').json() == []


def test_render_needs_review_and_cannot_duplicate(monkeypatch):
    item=create()
    body={'learner':'sister','plan':item['plan'],'reviewed':False}
    assert client.post(f'/api/lessons/{item["id"]}/render',json=body).status_code == 422
    class FakePool:
        def submit(self,*args): pass
    monkeypatch.setattr(service,'POOL',FakePool())
    body['reviewed']=True
    try:
        assert client.post(f'/api/lessons/{item["id"]}/render',json=body).status_code == 200
        assert client.post(f'/api/lessons/{item["id"]}/render',json=body).status_code == 409
        assert client.delete(f'/api/lessons/{item["id"]}?learner=sister').status_code == 409
    finally:
        service.SLOTS.release()


def test_wrong_then_guess_does_not_mark_daily_mastery():
    item=create();ready(item)
    url=f'/api/lessons/{item["id"]}/answer'
    assert not client.post(url,json={'learner':'sister','answer':'4'}).json()['correct']
    assert client.post(url,json={'learner':'sister','answer':'５'}).json()['correct']
    memory=client.get('/api/memory?learner=sister').json()
    assert memory['summaries'][0]['independent_days'] == 0
    assert memory['profile']['wrong'] == 1
    assert client.get('/api/memory?learner=little_sister').json()['profile']['attempts'] == 0


def test_distinct_days_required_for_review_progress():
    item=create();ready(item)
    with service.db() as c:
        for day in range(3):
            stamp=(datetime.now(timezone.utc)-timedelta(days=4-day)).isoformat()
            c.execute('INSERT INTO attempts(lesson,learner,answer,correct,created) VALUES(?,?,?,?,?)',
                      (item['id'],'sister','5',1,stamp))
    summary=client.get('/api/memory?learner=sister').json()['summaries'][0]
    assert summary['independent_days'] == 3
    assert summary['status'] == '间隔复习表现良好'


def test_local_origin_and_file_allowlist():
    assert client.post('/api/lessons',json={},headers={'Origin':'https://evil.invalid'}).status_code == 403
    assert client.get('/health',headers={'Host':'evil.invalid'}).status_code == 403
    item=create();ready(item)
    assert client.get(f'/api/lessons/{item["id"]}/files/tutor.sqlite?learner=sister').status_code == 404


def test_delete_removes_learning_trace():
    item=create();ready(item)
    client.post(f'/api/lessons/{item["id"]}/answer',json={'learner':'sister','answer':'5'})
    assert client.delete(f'/api/lessons/{item["id"]}?learner=sister').status_code == 200
    assert client.get('/api/memory?learner=sister').json()['profile']['attempts'] == 0


def test_review_dates_use_china_timezone():
    item=create();ready(item)
    with service.db() as c:
        c.execute('INSERT INTO attempts(lesson,learner,answer,correct,created) VALUES(?,?,?,?,?)',
                  (item['id'],'sister','5',1,'2026-10-27T18:00:00+00:00'))
    summary=client.get('/api/memory?learner=sister').json()['summaries'][0]
    # UTC Oct 27 18:00 is Shanghai Oct 28 02:00; next day is Oct 29.
    assert summary['review_on'] == '2026-10-29'
