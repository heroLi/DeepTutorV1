"""Parent-entered Shanghai primary curriculum metadata, not a textbook catalogue."""
from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Subject = Literal['chinese', 'math', 'english']

class Textbook(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    subject: Subject
    title: str = Field(default='', max_length=120)
    publisher: str = Field(default='', max_length=80)
    edition: str = Field(default='', max_length=80)
    isbn: str = Field(default='', max_length=24)
    material_type: Literal['student_textbook', 'workbook', 'teacher_book'] = 'student_textbook'
    status: Literal['pending', 'verified', 'needs_update', 'retired'] = 'pending'
    source_refs: list[str] = Field(default_factory=list, max_length=8)
    verified_on: date | None = None
    current_unit: str = Field(default='', max_length=120)
    progress_confirmed: bool = False
    catalog_id: str = Field(default='', max_length=80)
    unit_id: str = Field(default='', max_length=80)

    @model_validator(mode='after')
    def check_evidence(self):
        if any(not s.strip() or len(s) > 200 for s in self.source_refs):
            raise ValueError('资料来源需为1至200字的链接或本地资料编号')
        if self.status == 'verified' and not all((self.title, self.publisher, self.edition, self.source_refs, self.verified_on)):
            raise ValueError('标为已核对前，请补全书名、出版社、版次、来源与核验日期')
        if self.verified_on and self.verified_on > date.today():
            raise ValueError('核验日期不能在未来')
        if self.progress_confirmed and not self.current_unit:
            raise ValueError('确认进度前请填写当前单元')
        return self

class CurriculumConfig(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    schema_version: Literal['1.0'] = '1.0'
    region: Literal['Shanghai'] = 'Shanghai'
    school_system: Literal['five_four'] = 'five_four'
    grade: int | None = Field(default=None, ge=1, le=5, strict=True)
    semester: Literal['first', 'second'] | None = None
    academic_year: str = Field(default='', max_length=9)
    textbooks: list[Textbook] = Field(default_factory=list, max_length=3)

    @model_validator(mode='after')
    def check_metadata(self):
        if self.academic_year:
            parts = self.academic_year.split('-')
            if (len(parts) != 2 or any(len(p) != 4 or not p.isdigit() for p in parts)
                    or int(parts[1]) != int(parts[0])+1):
                raise ValueError('学年请按2026-2027的格式填写')
        if len({b.subject for b in self.textbooks}) != len(self.textbooks):
            raise ValueError('每科仅保留一份当前教材配置')
        return self

    def subject_status(self):
        result = {}
        for subject in ('chinese', 'math', 'english'):
            book = next((b for b in self.textbooks if b.subject == subject), None)
            aligned = bool(self.grade and self.semester and self.academic_year and book and book.status == 'verified' and book.material_type == 'student_textbook'
                           and book.progress_confirmed and book.current_unit)
            result[subject] = {
                'textbook_aligned': aligned,  # Legacy parent-metadata flag, not course alignment.
                'parent_metadata_confirmed': aligned,
                'content_aligned': False,
                'label': f'家长已核对教材进度：{book.current_unit}' if aligned else '按能力练习 · 教材进度待核对',
                'note': '此配置不代表系统已具备该教材的课程内容或单元题库。',
            }
        return result
