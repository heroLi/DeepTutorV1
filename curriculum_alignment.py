"""Reviewed local alignment metadata. No copyrighted lesson content or network I/O.

Parent metadata is not evidence that a course or exercise matches a textbook.
The production catalogue is intentionally empty pending verified edition sources.
"""
from datetime import date
import hashlib
import inspect
import json
from typing import Literal
from urllib.parse import urlsplit
from pydantic import BaseModel, ConfigDict, Field, model_validator

SUBJECTS = ('chinese', 'math', 'english')
ID = r'^[a-z0-9][a-z0-9_.:-]{0,79}$'

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class Source(StrictModel):
    id: str = Field(pattern=ID)
    url: str = Field(max_length=500)
    publisher: str = Field(min_length=1, max_length=120)
    checked_on: date
    status: Literal['pending', 'verified', 'retired'] = 'pending'
    scope: Literal['textbook_identity', 'unit_structure', 'learning_objective']
    scope_note: str = Field(min_length=1, max_length=240)

    @model_validator(mode='after')
    def safe_reference(self):
        p = urlsplit(self.url)
        if p.scheme != 'https' or not p.hostname or p.username or p.password or p.query or p.fragment:
            raise ValueError('来源必须是无登录信息、查询参数和片段的 HTTPS 页面链接')
        if self.checked_on > date.today():
            raise ValueError('来源核对日期不能在未来')
        return self

class Unit(StrictModel):
    id: str = Field(pattern=ID)
    title: str = Field(min_length=1, max_length=120)
    source_refs: list[str] = Field(min_length=1, max_length=8)
    status: Literal['pending', 'verified', 'retired'] = 'pending'

class ExerciseMapping(StrictModel):
    exercise_id: str = Field(pattern=ID)
    unit_id: str = Field(pattern=ID)
    source_refs: list[str] = Field(min_length=1, max_length=8)
    content_sha256: str = Field(pattern=r'^[a-f0-9]{64}$')
    reviewed_by: str = Field(min_length=1, max_length=100)
    review_note: str = Field(min_length=1, max_length=240)
    reviewed_on: date
    status: Literal['pending', 'verified', 'retired'] = 'pending'

    @model_validator(mode='after')
    def valid_date(self):
        if self.reviewed_on > date.today():
            raise ValueError('映射核对日期不能在未来')
        return self

class CatalogBook(StrictModel):
    id: str = Field(pattern=ID)
    region: Literal['Shanghai'] = 'Shanghai'
    school_system: Literal['five_four'] = 'five_four'
    subject: Literal['chinese', 'math', 'english']
    grade: int = Field(ge=1, le=5, strict=True)
    semester: Literal['first', 'second']
    academic_years: list[str] = Field(min_length=1, max_length=10)
    title: str = Field(min_length=1, max_length=120)
    publisher: str = Field(min_length=1, max_length=80)
    edition: str = Field(min_length=1, max_length=80)
    isbn: str = Field(default='', max_length=24)
    status: Literal['pending', 'verified', 'retired'] = 'pending'
    sources: list[Source] = Field(min_length=1, max_length=32)
    source_refs: list[str] = Field(min_length=1, max_length=8)
    units: list[Unit] = Field(default_factory=list, max_length=100)
    mappings: list[ExerciseMapping] = Field(default_factory=list, max_length=300)

    @model_validator(mode='after')
    def cross_references(self):
        for year in self.academic_years:
            parts = year.split('-')
            if len(parts) != 2 or any(len(p) != 4 or not p.isdigit() for p in parts) or int(parts[1]) != int(parts[0])+1:
                raise ValueError('适用学年必须明确为连续两年')
        if len(set(self.academic_years)) != len(self.academic_years):
            raise ValueError('适用学年不能重复')
        sources = {x.id:x for x in self.sources}
        units = {x.id:x for x in self.units}
        if len(sources) != len(self.sources) or len(units) != len(self.units):
            raise ValueError('来源和单元编号不能重复')
        if len({(m.exercise_id,m.unit_id) for m in self.mappings}) != len(self.mappings):
            raise ValueError('练习映射不能重复')
        for refs in [self.source_refs, *(u.source_refs for u in self.units), *(m.source_refs for m in self.mappings)]:
            if len(set(refs)) != len(refs) or any(r not in sources for r in refs):
                raise ValueError('来源引用必须指向本版本的唯一来源编号')
        if any(m.unit_id not in units for m in self.mappings):
            raise ValueError('练习必须指向本版本中的单元')
        return self

# Only reviewed source edits can populate this tuple; no write API or user URL fetch.
CATALOG: tuple[CatalogBook, ...] = ()
# An installed original exercise is not aligned merely by being in this registry.
EXERCISE_SUBJECTS = {'math:equal-sharing': 'math',
    **{f'language:zh-{i}':'chinese' for i in range(8)},
    **{f'language:en-{i}':'english' for i in range(8)}}



def exercise_fingerprint(exercise_id):
    if exercise_id == 'math:equal-sharing':
        import core, tutor_provider, learning_flow
        # Include presentation, hint and practice logic: code changes invalidate review.
        content = '\n'.join(inspect.getsource(module) for module in (core, tutor_provider, learning_flow))
    elif exercise_id in EXERCISE_SUBJECTS and exercise_id.startswith('language:'):
        from language_practice import ITEMS
        import learning_flow
        content = json.dumps(ITEMS[exercise_id.split(':',1)[1]], ensure_ascii=False, sort_keys=True) + inspect.getsource(learning_flow)
    else:
        return None
    return hashlib.sha256(content.encode()).hexdigest()


REFERENCE_SOURCES = [
    dict(url='https://edu.sh.gov.cn/xxgk2_zdgz_jcjy_04/20260810/339e915d906842caaf98736d562df96a.html',
         title='上海市教育委员会关于印发2026年秋季中小学教学用书目录的通知',
         publisher='上海市教育委员会', published_on='2026-08-10', checked_on='2026-11-03',
         state='reference_only', note='目录参考入口；未据此核验具体版本、单元或原创练习适配'),
    dict(url='https://edu.sh.gov.cn/xxgk2_zdgz_jcjy_04/20260918/4bc7f85fcd764ea19acc489974b7d980.html',
         title='2026年秋季上海市编写教学用书目录中“待审”用书审查通过及部分教学用书准用号调整情况的公告',
         publisher='上海市教育委员会', published_on='2026-08-31', checked_on='2026-11-03',
         state='reference_only', note='目录更新参考入口；未据此核验具体版本、单元或原创练习适配'),
]


def _sources_ok(book, refs, scope):
    sources = {s.id:s for s in book.sources}
    return bool(refs and all(sources[r].status == 'verified' for r in refs)
                and any(sources[r].scope == scope for r in refs))


def _book_ready(book):
    return book.status == 'verified' and _sources_ok(book, book.source_refs, 'textbook_identity')


def _unit_ready(book, unit):
    return _book_ready(book) and unit.status == 'verified' and _sources_ok(book, unit.source_refs, 'unit_structure')


def _mappings(book, unit):
    return [m for m in book.mappings if m.unit_id == unit.id and m.status == 'verified'
            and EXERCISE_SUBJECTS.get(m.exercise_id) == book.subject
            and exercise_fingerprint(m.exercise_id) == m.content_sha256
            and _sources_ok(book, m.source_refs, 'learning_objective')]


def public_catalog():
    books = []
    for book in CATALOG:
        if not _book_ready(book):
            continue
        units = [u for u in book.units if _unit_ready(book, u)]
        books.append(dict(id=book.id, subject=book.subject, grade=book.grade, semester=book.semester,
            academic_years=book.academic_years, title=book.title, publisher=book.publisher, edition=book.edition, isbn=book.isbn,
            units=[dict(id=u.id,title=u.title) for u in units],
            sources=[s.model_dump(mode='json') for s in book.sources if s.status == 'verified']))
    return dict(schema_version='1.0', region='Shanghai', school_system='five_four', subjects=list(SUBJECTS),
        textbooks=books, reference_sources=REFERENCE_SOURCES, note='目录仅含已核验的版本与单元元数据；不代表孩子实际用书，亦不代表已具备完整同步课程。')


def _identity_matches(config, parent, book):
    return (config.grade == book.grade and config.semester == book.semester
        and config.academic_year in book.academic_years
        and parent.subject == book.subject and parent.material_type == 'student_textbook'
        and all(getattr(parent,key) == getattr(book,key) for key in ('title','publisher','edition','isbn')))


def validate_selection(config):
    """Validate explicit selections, not free-text parent metadata."""
    for parent in config.textbooks:
        if not parent.catalog_id:
            if parent.unit_id:
                raise ValueError('选择单元前请先选择已核验教材版本')
            continue
        book = next((b for b in CATALOG if b.id == parent.catalog_id), None)
        if not book or not _book_ready(book):
            raise ValueError('此教材版本尚未由系统核验，不能保存为已选目录')
        if not _identity_matches(config, parent, book):
            raise ValueError('目录版本与家长填写的学科、年级、学期或教材身份不符')
        if parent.unit_id and not any(u.id == parent.unit_id and _unit_ready(book,u) for u in book.units):
            raise ValueError('此单元尚未在所选教材版本中核验')


def alignment(config):
    result = {}
    parent_status = config.subject_status()
    for subject in SUBJECTS:
        parent = next((b for b in config.textbooks if b.subject == subject), None)
        confirmed = parent_status[subject]['parent_metadata_confirmed']
        item = dict(parent_metadata_confirmed=confirmed, content_aligned=False,
            state='pending', label='尚未同步教材', reasons=[],
            catalog_id=parent.catalog_id if parent else '', unit_id=parent.unit_id if parent else '',
            sources=[], mapped_exercise_ids=[], mapping_evidence=[])
        if not confirmed:
            item['reasons'].append('请家长确认实际年级、学年学期、教材身份和当前单元')
        book = next((b for b in CATALOG if parent and b.id == parent.catalog_id), None)
        if not book or not _book_ready(book):
            item['reasons'].append('尚未选择来源已核验的教材版本')
        elif not _identity_matches(config, parent, book):
            item['reasons'].append('所选版本与家长教材身份或年级学期不符，请重新核对')
        else:
            unit = next((u for u in book.units if u.id == parent.unit_id), None)
            item['sources'] = [s.model_dump(mode='json') for s in book.sources if s.status == 'verified']
            if not unit or not _unit_ready(book,unit):
                item['reasons'].append('当前单元尚未在该版本来源中核验')
            elif parent.current_unit != unit.title:
                item['reasons'].append('家长确认的当前单元与目录单元不符')
            else:
                mappings = _mappings(book,unit)
                if not mappings:
                    item['reasons'].append('本单元尚无经过来源和内容审查的原创练习映射')
                elif confirmed:
                    item.update(content_aligned=True, state='verified_mapping',
                        label='当前单元有已核验的原创练习映射（非完整课程）',
                        mapped_exercise_ids=[m.exercise_id for m in mappings],
                        mapping_evidence=[m.model_dump(mode='json', include={'exercise_id', 'unit_id', 'source_refs',
                            'content_sha256', 'reviewed_on', 'review_note', 'status'}) for m in mappings])
        result[subject] = item
    return result
