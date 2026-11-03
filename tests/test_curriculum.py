import os
import tempfile
from datetime import date

os.environ.setdefault('TUTOR_DATA_DIR', tempfile.mkdtemp(prefix='curriculum-test-'))
import pytest
from fastapi.testclient import TestClient
import app as service
from curriculum import CurriculumConfig

@pytest.fixture
def client():
    with service.db() as c:
        c.execute('DELETE FROM curriculum_configs')
    with TestClient(service.app) as c:
        yield c


def config():
    return {'grade': 3, 'semester': 'first', 'academic_year': '2026-2027',
            'textbooks': [{'subject': 'math', 'title': '合成教材示例', 'publisher': '测试出版社',
                          'edition': '测试版', 'source_refs': ['synthetic:copyright-page'],
                          'verified_on': date.today().isoformat(), 'status': 'verified',
                          'current_unit': '家长填写的示例单元', 'progress_confirmed': True}]}

def save(client, value, rev=0, learner='sister'):
    return client.put('/api/curriculum?learner='+learner,json={'config':value,'expected_revision':rev})

def test_unconfirmed_defaults_no_inferred_grade_or_units(client):
    value=client.get('/api/curriculum?learner=sister').json()
    assert value['revision']==0
    assert value['config']['grade'] is None
    assert value['config']['textbooks']==[]
    assert all(not s['textbook_aligned'] for s in value['subjects'].values())


def test_confirmed_metadata_separate_from_actual_content(client):
    r=save(client,config());assert r.status_code==200
    value=r.json();assert value['revision']==1
    assert value['subjects']['math']['textbook_aligned']
    assert '不代表系统已具备' in value['subjects']['math']['note']
    assert client.get('/api/curriculum?learner=little_sister').json()['revision']==0
    assert client.get('/api/curriculum?learner=sister').json()==value


@pytest.mark.parametrize('field,value',[('grade',6),('grade',True),('semester','summer'),('academic_year','2026-2028'),('region','elsewhere'),('invented_units',['one'])])
def test_invalid_schema(client,field,value):
    c=config();c[field]=value
    assert save(client,c).status_code==422


@pytest.mark.parametrize('field',['title','publisher','edition','source_refs','verified_on'])
def test_verified_requires_evidence(client,field):
    c=config();c['textbooks'][0].pop(field)
    assert save(client,c).status_code==422


def test_duplicate_subject_and_blank_source_rejected(client):
    c=config();c['textbooks'].append(c['textbooks'][0].copy());assert save(client,c).status_code==422
    c=config();c['textbooks'][0]['source_refs']=[' '];assert save(client,c).status_code==422


def test_new_semester_invalidates_previous_verification_and_progress(client):
    assert save(client,config()).status_code==200
    c=config();c['semester']='second'
    result=save(client,c,1).json();book=result['config']['textbooks'][0]
    assert book['status']=='needs_update' and book['verified_on'] is None
    assert not book['progress_confirmed'] and not book['current_unit']
    assert not result['subjects']['math']['textbook_aligned']


def test_stale_update_and_origin_blocked(client):
    assert save(client,config()).status_code==200
    assert save(client,config()).status_code==409
    assert client.put('/api/curriculum?learner=sister',headers={'Origin':'https://evil.invalid'},json={'config':config(),'expected_revision':1}).status_code==403
    assert client.get('/api/curriculum?learner=unknown').status_code==422


@pytest.mark.parametrize('state',['pending','needs_update','retired'])
def test_nonverified_never_claims_alignment(client,state):
    c=config();c['textbooks'][0]['status']=state
    assert not save(client,c).json()['subjects']['math']['textbook_aligned']


def test_workbook_not_student_textbook_alignment(client):
    c=config();c['textbooks'][0]['material_type']='workbook'
    assert not save(client,c).json()['subjects']['math']['textbook_aligned']


def test_hint_api_offline_only_no_provider_selection(client):
    r=client.post('/api/tutor/hint',json={'total':12,'groups':3,'hint_level':1})
    assert r.status_code==200 and r.json()['verified_status']=='rule_checked'
    assert '12 ÷ 3 = 4' not in r.json()['hint_text']
    assert client.post('/api/tutor/hint',json={'provider':'deepseek','total':12,'groups':3}).status_code==422
    assert client.post('/api/tutor/hint',json={'total':13,'groups':3}).json()['status']=='unsupported'
    assert client.post('/api/tutor/hint',json={}).json()['status']=='needs_clarification'
