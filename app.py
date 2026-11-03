"""Local family application. Not a public multi-tenant service."""
from __future__ import annotations

import json
import os
import shutil
import sqlite3
import subprocess
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from core import ROOT, LessonPlan, NewLesson, load_env, make_plan
from curriculum import CurriculumConfig
from tutor_provider import TutorRequest, TutorResponse, generate_hint
from render import render_lesson
import learning_flow

load_env()
DATA = Path(os.environ.get('TUTOR_DATA_DIR', str(ROOT/'data'))).resolve()
DATA.mkdir(parents=True, exist_ok=True)
POOL = ThreadPoolExecutor(max_workers=1)
SLOTS = threading.BoundedSemaphore(4)
Learner = Literal['sister', 'little_sister']
REVIEW_ZONE = ZoneInfo('Asia/Shanghai')


@contextmanager
def db():
    connection = sqlite3.connect(DATA/'tutor.sqlite', timeout=20)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


with db() as c:
    c.executescript('''
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY, learner TEXT NOT NULL, state TEXT NOT NULL,
      plan TEXT NOT NULL, source TEXT NOT NULL, message TEXT NOT NULL,
      created TEXT NOT NULL, output TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY, lesson TEXT NOT NULL, learner TEXT NOT NULL,
      answer TEXT NOT NULL, correct INTEGER NOT NULL, created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS attempt_learner ON attempts(learner, created);
    CREATE TABLE IF NOT EXISTS curriculum_configs (
      learner TEXT PRIMARY KEY, config TEXT NOT NULL, revision INTEGER NOT NULL, updated TEXT NOT NULL);

    ''')
    learning_flow.initialize(c)
    c.execute("UPDATE lessons SET state='failed',message='服务曾重启，可重新生成' WHERE state IN ('queued','rendering')")

app = FastAPI(title='小步讲题', docs_url='/docs')


@app.middleware('http')
async def local_boundary(request: Request, call_next):
    host = request.headers.get('host','').split(':')[0]
    if host not in ('127.0.0.1','localhost','testserver'):
        return JSONResponse({'detail':'此版本只供本机访问'}, status_code=403)
    origin = request.headers.get('origin')
    if request.method not in ('GET','HEAD','OPTIONS') and origin and origin != str(request.base_url).rstrip('/'):
        return JSONResponse({'detail':'拒绝跨站请求'}, status_code=403)
    try:
        length = int(request.headers.get('content-length','0'))
    except ValueError:
        return JSONResponse({'detail':'无效的请求长度'},status_code=400)
    if length > 5_000_000:
        return JSONResponse({'detail':'请求体过大'},status_code=413)
    return await call_next(request)


def now():
    return datetime.now(timezone.utc).isoformat()


def get_lesson(lesson_id, learner):
    if len(lesson_id) != 32 or any(c not in '0123456789abcdef' for c in lesson_id):
        raise HTTPException(404, '题目不存在')
    with db() as c:
        row = c.execute('SELECT * FROM lessons WHERE id=? AND learner=?', (lesson_id,learner)).fetchone()
    if not row:
        raise HTTPException(404,'此学习档案中没有这道题')
    item = dict(row)
    item['plan'] = json.loads(item['plan'])
    item['output'] = json.loads(item['output'])
    return item


@app.get('/')
def home():
    return FileResponse(ROOT/'index.html')


@app.get('/learn')
def child_practice_page():
    return FileResponse(ROOT/'learn.html')


@app.get('/health')
def health():
    return {'ok':True}


@app.get('/api/config')
def config():
    return {'model_ready':bool(os.environ.get('TUTOR_LLM_BASE_URL') and os.environ.get('TUTOR_LLM_MODEL')),
            'tts':os.environ.get('TUTOR_TTS_PROVIDER','edge'),
            'ffmpeg':bool(shutil.which('ffmpeg') and shutil.which('ffprobe')),
            'deeptutor_ready':bool(os.environ.get('TUTOR_DEEPTUTOR_HOME_SISTER') and
                                  shutil.which(os.environ.get('TUTOR_DEEPTUTOR_BIN','deeptutor')))}


class CurriculumUpdate(BaseModel):
    model_config = {'extra': 'forbid'}
    config: CurriculumConfig
    expected_revision: int = Field(ge=0, strict=True)


@app.get('/api/curriculum')
def curriculum_get(learner: Learner):
    with db() as c:
        row = c.execute('SELECT * FROM curriculum_configs WHERE learner=?', (learner,)).fetchone()
    config = CurriculumConfig.model_validate_json(row['config']) if row else CurriculumConfig()
    return {'learner': learner, 'config': config.model_dump(mode='json'),
            'revision': row['revision'] if row else 0, 'subjects': config.subject_status()}


@app.put('/api/curriculum')
def curriculum_save(learner: Learner, request: CurriculumUpdate):
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        row = c.execute('SELECT revision,config FROM curriculum_configs WHERE learner=?', (learner,)).fetchone()
        revision = row['revision'] if row else 0
        if revision != request.expected_revision:
            raise HTTPException(409, '配置已经更新，请重新打开后再保存')
        if row:
            previous = CurriculumConfig.model_validate_json(row['config'])
            term_changed = any(getattr(previous, key) != getattr(request.config, key)
                               for key in ('grade', 'semester', 'academic_year'))
            previous_books = {book.subject: book for book in previous.textbooks}
            for book in request.config.textbooks:
                old_book = previous_books.get(book.subject)
                book_changed = old_book is not None and any(
                    getattr(old_book, key) != getattr(book, key)
                    for key in ('title', 'publisher', 'edition', 'isbn', 'material_type', 'source_refs'))
                if term_changed or book_changed:
                    if book.status == 'verified':
                        book.status = 'needs_update'
                    book.verified_on = None
                    book.progress_confirmed = False
                    book.current_unit = ''
        c.execute('INSERT INTO curriculum_configs VALUES(?,?,?,?) ON CONFLICT(learner) DO UPDATE SET config=excluded.config,revision=excluded.revision,updated=excluded.updated',
                  (learner, request.config.model_dump_json(), revision+1, now()))
    return curriculum_get(learner)


@app.post('/api/tutor/hint', response_model=TutorResponse)
def offline_hint(request: TutorRequest):
    # HTTP callers cannot choose a provider, grant consent, or send learner history.
    return generate_hint(request)


@app.post('/api/lessons/{lesson_id}/practice-session')
def practice_create(lesson_id: str, request: learning_flow.SessionRequest):
    return learning_flow.create_session(db, lesson_id, request)


@app.get('/api/practice-sessions/{session_id}')
def practice_read(session_id: str, learner: Learner):
    return learning_flow.read_session(db, session_id, learner)


@app.post('/api/practice-sessions/{session_id}/attempt')
def practice_attempt(session_id: str, request: learning_flow.AttemptRequest):
    return learning_flow.act(db, session_id, request, 'attempt')


@app.post('/api/practice-sessions/{session_id}/hint')
def practice_hint(session_id: str, request: learning_flow.ActionRequest):
    return learning_flow.act(db, session_id, request, 'hint')


@app.post('/api/practice-sessions/{session_id}/next')
def practice_next(session_id: str, request: learning_flow.ActionRequest):
    return learning_flow.act(db, session_id, request, 'next')


@app.post('/api/lessons')
def create(request: NewLesson):
    try:
        plan = make_plan(request)
    except ValueError as e:
        raise HTTPException(422,str(e)[:220])
    except RuntimeError as e:
        raise HTTPException(502,str(e))
    lesson_id = uuid.uuid4().hex
    with db() as c:
        c.execute('INSERT INTO lessons(id,learner,state,plan,source,message,created) VALUES(?,?,?,?,?,?,?)',
            (lesson_id,request.learner,'draft',plan.model_dump_json(),request.mode,
             '请核对题目、答案、讲解与练习题，再生成视频',now()))
    return get_lesson(lesson_id,request.learner)


@app.get('/api/lessons')
def lesson_list(learner: Learner):
    with db() as c:
        rows = c.execute('SELECT id,state,plan,created FROM lessons WHERE learner=? ORDER BY created DESC', (learner,)).fetchall()
    return [{'id':r['id'],'state':r['state'],'title':json.loads(r['plan'])['title'],'created':r['created']} for r in rows]


@app.get('/api/lessons/{lesson_id}')
def lesson(lesson_id: str, learner: Learner):
    return get_lesson(lesson_id,learner)


class RenderRequest(BaseModel):
    learner: Learner
    plan: LessonPlan
    reviewed: bool


def update(lesson_id, state, message, output=None):
    with db() as c:
        if output is None:
            c.execute('UPDATE lessons SET state=?,message=? WHERE id=?',(state,message,lesson_id))
        else:
            c.execute('UPDATE lessons SET state=?,message=?,output=? WHERE id=?',
                      (state,message,json.dumps(output),lesson_id))


def work(lesson_id, plan):
    try:
        update(lesson_id,'rendering','正在生成中文配音与画面')
        out = render_lesson(plan, DATA/lesson_id, lambda message:update(lesson_id,'rendering',message))
        update(lesson_id,'ready','无声预览已完成' if not out['has_audio'] else '讲题视频已完成',out)
    except (RuntimeError,ValueError,OSError,subprocess.SubprocessError) as e:
        # Unexpected exceptions are also handled below; no stack trace goes to UI.
        update(lesson_id,'failed',str(e)[:200])
    except Exception:
        update(lesson_id,'failed','视频任务失败，请检查本地运行终端和依赖')
    finally:
        SLOTS.release()


@app.post('/api/lessons/{lesson_id}/render')
def render(lesson_id: str, request: RenderRequest):
    get_lesson(lesson_id,request.learner)
    if not request.reviewed:
        raise HTTPException(422,'请先核对讲解稿与练习答案')
    if not SLOTS.acquire(blocking=False):
        raise HTTPException(429,'已有4个视频任务，请稍后再试')
    try:
        with db() as c:
            changed = c.execute("UPDATE lessons SET state='queued',plan=?,message='等待生成',output='{}' WHERE id=? AND state IN ('draft','failed')",
                                (request.plan.model_dump_json(),lesson_id)).rowcount
        if not changed:
            raise HTTPException(409,'任务正在生成或已经完成；如需新版本，请新建题目')
        POOL.submit(work,lesson_id,request.plan)
    except Exception:
        SLOTS.release()
        raise
    return get_lesson(lesson_id,request.learner)


@app.post('/api/lessons/{lesson_id}/study')
def study(lesson_id: str, request: RenderRequest):
    """Confirm a text lesson without invoking a model, speech or video worker."""
    get_lesson(lesson_id, request.learner)
    if not request.reviewed:
        raise HTTPException(422, '请家长先核对讲解稿与练习答案')
    with db() as c:
        changed = c.execute(
            "UPDATE lessons SET state='offline_ready',plan=?,message='离线分步学习已准备好，无需配音或视频',output='{}' WHERE id=? AND state IN ('draft','failed')",
            (request.plan.model_dump_json(), lesson_id)).rowcount
    if not changed:
        raise HTTPException(409, '此题已经开始学习或正在生成，请打开原题继续')
    return get_lesson(lesson_id, request.learner)


@app.get('/api/lessons/{lesson_id}/files/{name}')
def artifact(lesson_id: str, name: str, learner: Learner):
    item = get_lesson(lesson_id,learner)
    if item['state'] != 'ready' or name not in ('lesson.mp4','captions.srt','plan.json','poster.png','timeline.json'):
        raise HTTPException(404,'文件尚未生成')
    path = DATA/lesson_id/name
    if not path.is_file():
        raise HTTPException(404,'文件不存在')
    return FileResponse(path)


class Answer(BaseModel):
    learner: Learner
    answer: str = Field(min_length=1,max_length=60)


def normalize(value):
    import unicodedata
    return ''.join(unicodedata.normalize('NFKC',value).split()).rstrip('。.')


@app.post('/api/lessons/{lesson_id}/answer')
def answer(lesson_id: str, request: Answer):
    item = get_lesson(lesson_id,request.learner)
    if item['state'] not in ('ready', 'offline_ready'):
        raise HTTPException(409,'请先由家长确认讲解稿，开始离线学习或完成讲解视频')
    quiz = item['plan']['quiz']
    correct = normalize(request.answer) == normalize(quiz['answer'])
    with db() as c:
        c.execute('INSERT INTO attempts(lesson,learner,answer,correct,created) VALUES(?,?,?,?,?)',
                  (lesson_id,request.learner,request.answer,int(correct),now()))
    return {'correct':correct,'feedback':'答对了！过几天再来试试。' if correct else quiz['hint']}


@app.get('/api/memory')
def memory(learner: Learner):
    with db() as c:
        rows = c.execute('''SELECT a.*, l.plan FROM attempts a JOIN lessons l ON a.lesson=l.id
                            WHERE a.learner=? ORDER BY a.created''',(learner,)).fetchall()
    raw = [dict(r) for r in rows]
    grouped = {}
    for row in raw:
        plan = json.loads(row.pop('plan'))
        entry = grouped.setdefault(row['lesson'],{'lesson':row['lesson'],'knowledge':plan['knowledge'],
            'wrong_count':0,'by_day':{},'last':row['created']})
        if not row['correct']:
            entry['wrong_count'] += 1
        # A day only passes when its first attempt was correct; repeated guessing
        # cannot turn a failed day into an independent successful review.
        day = datetime.fromisoformat(row['created']).astimezone(REVIEW_ZONE).date().isoformat()
        entry['by_day'].setdefault(day,bool(row['correct']))
        entry['last'] = row['created']
    summaries = []
    for entry in grouped.values():
        streak = 0
        for passed in entry.pop('by_day').values():
            streak = streak+1 if passed else 0
        entry['independent_days'] = streak
        days = [1,1,3,7][min(streak,3)]
        entry['review_on'] = (datetime.fromisoformat(entry['last']).astimezone(REVIEW_ZONE)+timedelta(days=days)).date().isoformat()
        entry['status'] = '间隔复习表现良好' if streak >= 3 else '继续复习'
        summaries.append(entry)
    return {'traces':raw,'summaries':summaries,
            'profile':{'attempts':len(raw),'wrong':sum(not x['correct'] for x in raw),
                       'reviewing':sum(x['status']=='继续复习' for x in summaries)},
            'note':'旧版练习记录，不等同于DeepTutor原生三层记忆；孩子练习的首次作答、提示与新题证据单独保存在练习会话中，不计入这里的复习天数；尚无跨题型能力评估。'}


@app.delete('/api/lessons/{lesson_id}')
def delete(lesson_id: str, learner: Learner):
    get_lesson(lesson_id,learner)
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        row = c.execute('SELECT state FROM lessons WHERE id=?',(lesson_id,)).fetchone()
        if row['state'] in ('queued','rendering'):
            raise HTTPException(409,'生成中暂不能删除')
        learning_flow.delete_sessions(c, lesson_id)
        c.execute('DELETE FROM attempts WHERE lesson=?',(lesson_id,))
        c.execute('DELETE FROM lessons WHERE id=?',(lesson_id,))
    shutil.rmtree(DATA/lesson_id,ignore_errors=True)
    return {'deleted':True}
