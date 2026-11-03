"""Original bounded language exercises, not a textbook or model-generated course.

Content IDs and solutions stay server-side. English items deliberately avoid
ambiguous vowel/consonant sounds; this is a small a/an practice, not all grammar.
"""
from __future__ import annotations
import json
import uuid
from typing import Literal
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, StrictBool


class LanguageSessionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    learner: Literal['sister', 'little_sister']
    subject: Literal['chinese', 'english']
    request_id: uuid.UUID
    parent_confirmed: StrictBool


# Original sentence contexts. Each pair has distinct prompts and answers.
_CHINESE = [
    ('大', '小', '一个大箱子要用两手抱，旁边的箱子一只手就能拿。与“大”相反的是哪个字？', '比较两个箱子的体积。'),
    ('长', '短', '一根绳子很长，另一根只剩一点。与“长”相反的是哪个字？', '比较绳子从头到尾的长度。'),
    ('高', '低', '一张桌子很高，另一张更靠近地面。与“高”相反的是哪个字？', '想想更靠近地面的位置。'),
    ('多', '少', '一个盘子里苹果多，另一个只有一个。与“多”相反的是哪个字？', '想想只有一个时的数量。'),
    ('冷', '热', '冰水是冷的，刚烧开的水却不是。与“冷”相反的是哪个字？', '想想刚烧开的水的温度，别用手碰。'),
    ('快', '慢', '一只小兔跑得快，蜗牛爬得不快。与“快”相反的是哪个字？', '想想蜗牛前进的速度。'),
    ('上', '下', '书放在架子的上层，鞋放在最靠近地面的那层。与“上”相反的是哪个字？', '想想最靠近地面的方向。'),
    ('远', '近', '山在很远的地方，门口的小树就在眼前。与“远”相反的是哪个字？', '想想就在眼前的距离。'),
]
_ENGLISH = [('cat','a','猫'),('apple','an','苹果'),('egg','an','鸡蛋'),('dog','a','狗'),
            ('book','a','书'),('orange','an','橙子'),('umbrella','an','伞'),('pen','a','笔')]
ITEMS = {}
for i, (word, answer, question, context) in enumerate(_CHINESE):
    ITEMS[f'zh-{i}'] = dict(subject='chinese', question=question + ' 只填一个汉字。', answer=answer,
        hints=['反义词是一组意思相反的词。先想一想题目中的两种情况。', context,
               f'把“{word}”和“{answer}”放在一起比较，它们的意思相反。现在再填一次。'])
for i, (word, answer, meaning) in enumerate(_ENGLISH):
    vowel = answer == 'an'
    ITEMS[f'en-{i}'] = dict(subject='english', question=f'表示“一个/一本/一把”时填 a 还是 an：___ {word}（{meaning}）。只填 a 或 an。', answer=answer,
        hints=['a 和 an 都可放在单数可数名词前。关键看后面单词开头的发音，不只看字母。',
               f'{word} 在本题的标准读音以{"元音" if vowel else "辅音"}音素开头。元音音素前用 an，辅音音素前用 a。',
               f'这个词组是 {answer} {word}。请回到空格，自己填一次。'])


# Accept common valid one-character alternatives in the stated context.
ITEMS['zh-2']['alternatives'] = ['矮']
ITEMS['zh-4']['alternatives'] = ['烫']


def is_language(state):
    return state.get('subject') in ('chinese', 'english')


def item(state, stage=None):
    subject = state['subject']
    keys = state['items']
    if set(keys) != {'initial', 'transfer'} or keys['initial'] == keys['transfer']:
        raise ValueError('Invalid language item state')
    for key in keys.values():
        if key not in ITEMS or ITEMS[key]['subject'] != subject:
            raise ValueError('Invalid language item identity')
    return ITEMS[keys[stage or state['stage']]]


def fresh_items(connection, learner, subject):
    # Minimal content-ID tombstones survive deletion; no answers or child text.
    used = {row['item_id'] for row in connection.execute('SELECT item_id FROM language_reserved_items WHERE learner=?', (learner,))}
    for row in connection.execute('SELECT state FROM practice_sessions WHERE learner=?', (learner,)):
        state = json.loads(row['state'])
        if is_language(state):
            used.update(state['items'].values())
    candidates = [key for key, value in ITEMS.items() if value['subject'] == subject and key not in used]
    if len(candidates) < 2:
        raise HTTPException(422, '本组原创示例已全部安排过，暂时没有未安排的新题；请继续已有练习或由家长安排其他练习。不会把重复题算作新题证据')
    return {'initial': candidates[0], 'transfer': candidates[1]}


def exposed_elsewhere(connection, state):
    key = state['items']['transfer']
    for row in connection.execute('SELECT state FROM practice_sessions WHERE learner=? AND id!=?', (state['learner'], state['id'])):
        old = json.loads(row['state'])
        if is_language(old) and (old['items']['initial'] == key or old['stage'] == 'transfer' and old['items']['transfer'] == key):
            return True
    return False


def create_session(db, request):
    from learning_flow import _evidence, public_session, utc_now
    if not request.parent_confirmed:
        raise HTTPException(422, '请家长先确认这是通用原创离线示例，并同意开始练习')
    with db() as c:
        c.execute('BEGIN IMMEDIATE')
        old = c.execute('SELECT subject,session_id FROM language_session_requests WHERE learner=? AND request_id=?',
                        (request.learner, str(request.request_id))).fetchone()
        if old:
            if old['subject'] != request.subject:
                raise HTTPException(409, '此操作编号已用于另一学科，请重新发起')
            row = c.execute('SELECT state FROM practice_sessions WHERE id=? AND learner=?', (old['session_id'], request.learner)).fetchone()
            if not row:
                raise HTTPException(410, '这次练习已删除；如需新练习，请重新发起')
            state = json.loads(row['state'])
        else:
            keys = fresh_items(c, request.learner, request.subject)
            for key in keys.values():
                c.execute('INSERT INTO language_reserved_items VALUES(?,?)', (request.learner, key))
            timestamp = utc_now()
            lesson_id = uuid.uuid4().hex
            state = dict(id=uuid.uuid4().hex, learner=request.learner, lesson_id=lesson_id,
                subject=request.subject, items=keys, created_at=timestamp, updated_at=timestamp,
                revision=0, stage='initial', status='attempting', hint_text='', feedback='', evidence=[_evidence('initial')])
            title = '语文 · 反义词' if request.subject == 'chinese' else '英语 · a / an'
            c.execute('INSERT INTO lessons(id,learner,state,plan,source,message,created) VALUES(?,?,?,?,?,?,?)',
                (lesson_id, request.learner, 'offline_ready', json.dumps({'title': title}), 'offline_language',
                 '通用原创离线示例；请在孩子练习页继续', timestamp))
            c.execute('INSERT INTO practice_sessions VALUES(?,?,?,?)', (state['id'], lesson_id, request.learner, json.dumps(state)))
            c.execute('INSERT INTO language_session_requests VALUES(?,?,?,?)', (request.learner, str(request.request_id), request.subject, state['id']))
    return {'session': public_session(state), 'learn_url': f"/learn?session={state['id']}&learner={request.learner}"}
