"""Synthetic edition evidence only; production catalogue has no inferred units."""
import copy
import json
from datetime import date
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
import app as service
import curriculum_alignment as alignment
from curriculum import CurriculumConfig


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(service, 'DATA', tmp_path)
    with service.db() as c:
        c.execute('CREATE TABLE curriculum_configs(learner TEXT PRIMARY KEY, config TEXT, revision INTEGER, updated TEXT)')
    monkeypatch.setattr(alignment, 'CATALOG', ())
    return TestClient(service.app)


def book_data():
    return dict(id='synthetic-math', subject='math', grade=2, semester='first',
        academic_years=['2026-2027'], title='合成数学教材', publisher='测试出版社', edition='测试2026版', isbn='synthetic-isbn', status='verified',
        sources=[dict(id=scope,url='https://example.org/'+scope,publisher='测试官方机构',checked_on='2020-01-01',status='verified',scope=scope,scope_note='合成测试：逐项核对来源覆盖本版本及相应核验范围')
                 for scope in ('textbook_identity','unit_structure','learning_objective')],
        source_refs=['textbook_identity'], units=[dict(id='u1',title='合成平均分单元',source_refs=['unit_structure'],status='verified')],
        mappings=[dict(exercise_id='math:equal-sharing',unit_id='u1',source_refs=['learning_objective'],
            content_sha256=alignment.exercise_fingerprint('math:equal-sharing'),reviewed_by='synthetic-reviewer',
            review_note='合成测试：人工审查本题能力目标与单元目标相符，不是实际教材映射', reviewed_on='2020-01-01',status='verified')])


def config():
    return dict(grade=2,semester='first',academic_year='2026-2027',textbooks=[dict(subject='math',
        title='合成数学教材',publisher='测试出版社',edition='测试2026版',isbn='synthetic-isbn',status='verified',
        verified_on=date.today().isoformat(),source_refs=['synthetic:copyright'],current_unit='合成平均分单元',
        progress_confirmed=True,catalog_id='synthetic-math',unit_id='u1')])


def install(monkeypatch, data=None):
    book=alignment.CatalogBook.model_validate(data or book_data())
    monkeypatch.setattr(alignment,'CATALOG',(book,))
    return book


def save(client, value, revision=0):
    return client.put('/api/curriculum?learner=sister',json={'config':value,'expected_revision':revision})


def test_empty_catalog_never_claims_sync_and_official_links_only_reference(client):
    response=client.get('/api/curriculum/catalog'); assert response.status_code==200
    catalog=response.json();assert catalog['textbooks']==[]
    assert all(s['state']=='reference_only' for s in catalog['reference_sources'])
    assert catalog['reference_sources'][1]['published_on']=='2026-08-31'
    state=client.get('/api/curriculum/alignment?learner=sister').json()
    assert set(state['subjects'])=={'chinese','math','english'}
    assert all(not s['content_aligned'] and s['mapping_evidence']==[] for s in state['subjects'].values())
    assert response.headers['cache-control']=='no-store'
    assert client.get('/api/curriculum/alignment?learner=unknown').status_code==422


def test_parent_metadata_not_content_alignment(client):
    c=config();c['textbooks'][0].update(catalog_id='',unit_id='')
    result=save(client,c).json()
    assert result['subjects']['math']['textbook_aligned']
    assert result['subjects']['math']['parent_metadata_confirmed']
    assert not result['subjects']['math']['content_aligned']
    assert not result['alignment']['subjects']['math']['content_aligned']
    assert result['alignment']==client.get('/api/curriculum/alignment?learner=sister').json()
    assert not client.get('/api/curriculum/alignment?learner=little_sister').json()['subjects']['math']['parent_metadata_confirmed']


def test_verified_identity_unit_review_and_content_fingerprint_chain(client,monkeypatch):
    install(monkeypatch)
    response=save(client,config());assert response.status_code==200,response.text
    state=response.json()['alignment']['subjects']['math']
    assert state['content_aligned'] and state['state']=='verified_mapping'
    assert response.json()['subjects']['math']['content_aligned'] == state['content_aligned']
    reread=client.get('/api/curriculum?learner=sister').json()
    assert reread['subjects']['math']['content_aligned'] == reread['alignment']['subjects']['math']['content_aligned'] == True
    assert state['mapped_exercise_ids']==['math:equal-sharing']
    evidence=state['mapping_evidence'][0]
    assert set(evidence)=={'exercise_id','unit_id','source_refs','content_sha256','reviewed_on','review_note','status'}
    assert evidence['content_sha256']==alignment.exercise_fingerprint('math:equal-sharing')
    assert 'reviewed_by' not in evidence and 'answer' not in evidence
    assert evidence['source_refs']==['learning_objective']
    assert '非完整课程' in state['label']
    assert len(state['sources'])==3
    assert client.get('/api/curriculum/catalog').json()['textbooks'][0]['units']==[{'id':'u1','title':'合成平均分单元'}]


@pytest.mark.parametrize('change',[('catalog_id','unknown'),('unit_id','unknown'),('edition','other'),('isbn','other'),('subject','english')])
def test_selection_wrong_identity_rejected(client,monkeypatch,change):
    install(monkeypatch);c=config();c['textbooks'][0][change[0]]=change[1]
    assert save(client,c).status_code==422


@pytest.mark.parametrize('field,value',[('grade',3),('semester','second'),('academic_year','2027-2028')])
def test_wrong_term_rejected(client,monkeypatch,field,value):
    install(monkeypatch);c=config();c[field]=value
    assert save(client,c).status_code==422


def test_unit_without_catalog_and_client_verification_injection_rejected(client):
    c=config();c['textbooks'][0]['catalog_id']=''
    assert save(client,c).status_code==422
    c=config();c['textbooks'][0]['mapping_verified']=True
    assert save(client,c).status_code==422
    assert client.post('/api/curriculum/catalog',json=book_data()).status_code==405


@pytest.mark.parametrize('target,status',[('book','pending'),('book','retired'),('unit','pending'),('unit','retired'),('identity_source','pending'),('unit_source','retired')])
def test_nonverified_catalog_or_unit_never_selectable(client,monkeypatch,target,status):
    data=book_data()
    if target=='book': data['status']=status
    elif target=='unit':data['units'][0]['status']=status
    else:data['sources'][0 if target=='identity_source' else 1]['status']=status
    install(monkeypatch,data)
    assert save(client,config()).status_code==422
    assert not alignment.alignment(CurriculumConfig.model_validate(config()))['math']['content_aligned']


@pytest.mark.parametrize('change',['pending','retired','bad_hash','unknown_exercise','wrong_subject','source_pending','wrong_scope'])
def test_mapping_requires_independent_review_sources_installed_content(client,monkeypatch,change):
    d=book_data();m=d['mappings'][0]
    if change in ('pending','retired'):m['status']=change
    elif change=='bad_hash':m['content_sha256']='0'*64
    elif change=='unknown_exercise':m['exercise_id']='uninstalled:item'
    elif change=='wrong_subject':m['exercise_id']='language:en-0';m['content_sha256']=alignment.exercise_fingerprint('language:en-0')
    elif change=='source_pending':d['sources'][2]['status']='pending'
    elif change=='wrong_scope':m['source_refs']=['unit_structure']
    install(monkeypatch,d)
    state=save(client,config()).json()['alignment']['subjects']['math']
    assert not state['content_aligned'] and state['mapped_exercise_ids']==[]


def test_parent_progress_and_content_changes_invalidate(client,monkeypatch):
    install(monkeypatch)
    c=config();c['textbooks'][0]['progress_confirmed']=False
    assert not save(client,c).json()['alignment']['subjects']['math']['content_aligned']
    response=save(client,config(),1);assert response.json()['alignment']['subjects']['math']['content_aligned']
    monkeypatch.setattr(alignment,'exercise_fingerprint',lambda _: 'f'*64)
    assert not client.get('/api/curriculum/alignment?learner=sister').json()['subjects']['math']['content_aligned']


def test_changed_term_or_version_clears_selection_and_stale_save_guard(client,monkeypatch):
    install(monkeypatch);assert save(client,config()).status_code==200
    assert save(client,config()).status_code==409
    c=config();c['semester']='second'
    response=save(client,c,1);assert response.status_code==200,response.text
    b=response.json()['config']['textbooks'][0]
    assert b['catalog_id']==b['unit_id']=='' and not b['progress_confirmed']
    assert not response.json()['alignment']['subjects']['math']['content_aligned']


def test_current_unit_name_must_match_verified_unit(client,monkeypatch):
    install(monkeypatch);c=config();c['textbooks'][0]['current_unit']='另一个家长单元'
    state=save(client,c).json()['alignment']['subjects']['math']
    assert not state['content_aligned']
    assert any('单元不符' in r for r in state['reasons'])


@pytest.mark.parametrize('mutation',['missing_source','duplicate_source','invalid_unit','duplicate_mapping','missing_review','bad_url','future_date','extra'])
def test_strict_catalog_schema(mutation):
    d=book_data()
    if mutation=='missing_source':d['units'][0]['source_refs']=['not-present']
    elif mutation=='duplicate_source':d['sources'].append(copy.deepcopy(d['sources'][0]))
    elif mutation=='invalid_unit':d['mappings'][0]['unit_id']='not-present'
    elif mutation=='duplicate_mapping':d['mappings'].append(copy.deepcopy(d['mappings'][0]))
    elif mutation=='missing_review':d['mappings'][0].pop('reviewed_by')
    elif mutation=='bad_url':d['sources'][0]['url']='https://user:password@example.org/path'
    elif mutation=='future_date':d['sources'][0]['checked_on']='2999-01-01'
    elif mutation=='extra':d['copied_textbook_text']='not allowed'
    with pytest.raises(ValidationError):alignment.CatalogBook.model_validate(d)
