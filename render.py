"""Deterministic teaching graphics, per-scene TTS and MP4/SRT composition."""
from __future__ import annotations

import asyncio
import json
import math
import os
import re
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFont

from core import ROOT, LessonPlan

W, H, FPS = 1280, 720, 20
BG, INK, TEAL, GOLD = '#F8F5EE', '#233D3A', '#247B6C', '#E8AE4D'


@lru_cache
def font(size):
    path = os.environ.get('TUTOR_FONT') or str(ROOT / 'assets/XiaoBuLearningSansSC.ttf')
    if not Path(path).exists():
        raise RuntimeError('缺少中文字体，请设置TUTOR_FONT')
    face = ImageFont.truetype(path, size)
    try:
        face.set_variation_by_axes([500])
    except (OSError,ValueError):
        pass  # User-supplied static fonts have no variable weight axis.
    return face


def lines(text, size, width):
    result, line = [], ''
    for char in text:
        if char == '\n' or (line and font(size).getlength(line + char) > width):
            result.append(line)
            line = '' if char == '\n' else char
        else:
            line += char
    if line:
        result.append(line)
    return result


def text(draw, xy, value, size, color=INK):
    draw.text(xy, value, font=font(size), fill=color)


def paragraph(draw, xy, value, size, width, max_lines=2, color=INK):
    parts = lines(value, size, width)
    if len(parts) > max_lines:
        parts = parts[:max_lines]
        parts[-1] = parts[-1][:-1] + '…'
    for i, line in enumerate(parts):
        text(draw, (xy[0], xy[1] + i * (size + 9)), line, size, color)


def frame(plan, index, elapsed, duration, caption='', preview=False):
    scene = plan.scenes[index]
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((48, 28, 200, 68), 18, fill=TEAL)
    text(d, (67, 33), '小步讲题', 23, 'white')
    text(d, (226, 34), f'{index+1:02d} / {len(plan.scenes):02d}', 22, TEAL)
    if preview:
        text(d, (920, 35), '无声预览 · 未合成配音', 19, '#8A5819')
    text(d, (62, 85), scene.title, 38)
    paragraph(d, (64, 147), plan.question, 23, 1148, max_lines=2)
    d.rounded_rectangle((48, 233, 755, 551), 25, fill='white')
    d.rounded_rectangle((777, 233, 1232, 551), 25, fill='#E5EFE8')
    # Board lines enter one by one; already drawn equations are never regenerated.
    for n, line in enumerate(scene.board):
        if elapsed >= 0.25 + n * 0.7:
            y = 260 + n * 88
            d.ellipse((71, y+9, 82, y+20), fill=GOLD)
            paragraph(d, (100, y), line, 30, 620, max_lines=2)
    if scene.visual.kind == 'groups':
        v = scene.visual
        rows, count = math.ceil(v.groups/2), v.total // v.groups
        cell_h = 270 / rows
        for group in range(v.groups):
            x, y = 795 + group % 2 * 211, 249 + group // 2 * cell_h
            d.rounded_rectangle((x, y, x+197, y+cell_h-9), 12, outline='#96BAA9', width=2)
            text(d, (x+10, y+5), f'第{group+1}组', 16, TEAL)
            for item in range(count):
                # Round-robin arrival: each group receives one object per round.
                arrival = (item * v.groups + group + 1) / v.total * max(1, duration-1.5)
                if elapsed >= arrival:
                    xx = x + 16 + item % 8 * 23
                    yy = y + 37 + item // 8 * 20
                    d.ellipse((xx, yy, xx+12, yy+12), fill=GOLD, outline='#AE7729')
    else:
        text(d, (805, 255), '一起想一想', 25, TEAL)
        paragraph(d, (807, 312), ['找出已知条件', '理解题意', '选择合适的方法', '检查，再试一题'][min(index,3)], 33, 386, 3)
        text(d, (807, 480), '暂停视频，也可以慢慢想', 19, '#486A5C')
    d.rounded_rectangle((48, 579, 1232, 681), 18, fill=INK)
    paragraph(d, (76, 596), caption, 26, 1128, 2, 'white')
    d.rounded_rectangle((48, 698, 1232, 705), 3, fill='#E0E5DD')
    p = (index + min(1, elapsed / duration)) / len(plan.scenes)
    d.rounded_rectangle((48, 698, max(50, 48 + 1184*p), 705), 3, fill=TEAL)
    return im


def run(args, timeout=180):
    result = subprocess.run(args, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f'{Path(args[0]).name}处理失败；请检查媒体依赖与字体')
    return result


def media_duration(path):
    r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(path)])
    return float(json.loads(r.stdout)['format']['duration'])


def synthesize(value, dest):
    provider = os.environ.get('TUTOR_TTS_PROVIDER', 'edge')
    if provider == 'preview':
        return None
    if provider == 'edge':
        import edge_tts
        # Some enterprise environments supply an additional CA. Add it to the
        # library's trust store; certificate verification remains enabled.
        extra_ca = os.environ.get('TUTOR_EXTRA_CA') or os.environ.get('SSL_CERT_FILE')
        if extra_ca:
            from edge_tts.communicate import _SSL_CTX
            _SSL_CTX.load_verify_locations(cafile=extra_ca)
        async def generate():
            await asyncio.wait_for(edge_tts.Communicate(value,
                os.environ.get('TUTOR_EDGE_VOICE', 'zh-CN-XiaoxiaoNeural'), rate='-12%').save(str(dest)), 45)
        try:
            asyncio.run(generate())
        except Exception as e:
            raise RuntimeError('中文配音失败。请检查Edge网络，或在.env选择macos/openai；无声预览需显式选择preview') from e
    elif provider == 'macos':
        if not shutil.which('say'):
            raise RuntimeError('macos配音仅适用于安装了中文系统声音的Mac')
        aiff = dest.with_suffix('.aiff')
        run(['say', '-v', os.environ.get('TUTOR_MACOS_VOICE', 'Tingting'), '-r', '155', '-o', str(aiff), value])
        run(['ffmpeg', '-y', '-v', 'error', '-i', str(aiff), '-ar', '24000', str(dest)])
        aiff.unlink()
    elif provider == 'openai':
        base, model = os.environ.get('TUTOR_TTS_BASE_URL', '').rstrip('/'), os.environ.get('TUTOR_TTS_MODEL')
        if not base or not model:
            raise ValueError('请配置TUTOR_TTS_BASE_URL、TUTOR_TTS_MODEL和TUTOR_TTS_VOICE')
        headers = {'Content-Type': 'application/json'}
        if os.environ.get('TUTOR_TTS_API_KEY'):
            headers['Authorization'] = 'Bearer ' + os.environ['TUTOR_TTS_API_KEY']
        try:
            with httpx.Client(timeout=90) as client:
                r = client.post(base+'/audio/speech', headers=headers, json={
                    'model':model, 'voice':os.environ.get('TUTOR_TTS_VOICE',''),
                    'input':value, 'response_format':'mp3'})
                r.raise_for_status()
                dest.write_bytes(r.content)
        except httpx.HTTPError as e:
            raise RuntimeError('语音服务请求失败，请检查本机配置') from e
    else:
        raise ValueError('未知语音服务；可选edge、macos、openai、preview')
    if not dest.exists() or dest.stat().st_size == 0:
        raise RuntimeError('配音文件为空')
    return media_duration(dest)


def captions(narration, duration):
    chunks = []
    for part in re.split(r'(?<=[。！？；])', narration):
        for start in range(0, len(part), 36):
            if part[start:start+36].strip():
                chunks.append(part[start:start+36])
    # Approximate sentence timing; actual scene boundaries follow measured audio.
    weight, cursor, result = sum(map(len, chunks)), 0., []
    for part in chunks:
        end = cursor + len(part)/weight * duration
        result.append((cursor, end, part))
        cursor = end
    return result


def srt_time(seconds):
    ms = round(seconds*1000)
    return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'


def render_lesson(plan: LessonPlan, folder: Path, progress=lambda _: None):
    if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
        raise RuntimeError('请先安装FFmpeg（需同时包含ffprobe）')
    folder.mkdir(parents=True, exist_ok=True)
    segments, subtitles, timeline, offset = [], [], [], 0.
    silent = os.environ.get('TUTOR_TTS_PROVIDER','edge') == 'preview'
    for index, scene in enumerate(plan.scenes):
        progress(f'配音和绘制第{index+1}/{len(plan.scenes)}段')
        audio = folder / f'{index:02d}.mp3'
        actual = synthesize(scene.narration, audio)
        duration = actual if actual is not None else max(5, len(scene.narration)/4)
        duration = math.ceil((duration + .4)*FPS)/FPS
        caps = captions(scene.narration, duration)
        segment = folder / f'{index:02d}.mp4'
        args = ['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}',
                '-r',str(FPS),'-i','pipe:0']
        if actual is not None:
            args += ['-i',str(audio)]
        args += ['-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p']
        if actual is not None:
            args += ['-c:a','aac','-af','apad','-t',str(duration)]
        args += ['-movflags','+faststart',str(segment)]
        with open(folder / 'ffmpeg.log', 'ab') as log:
            process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=log)
            try:
                for n in range(round(duration*FPS)):
                    t = n/FPS
                    cap = next((c[2] for c in caps if c[0] <= t < c[1]), '')
                    process.stdin.write(frame(plan,index,t,duration,cap,silent).tobytes())
                process.stdin.close()
                if process.wait(timeout=90):
                    raise RuntimeError('视频编码失败，请检查data中的ffmpeg.log')
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
        segments.append(segment.name)
        timeline.append({'scene':index, 'start':round(offset,3), 'duration':duration,
                         'narration':scene.narration})
        for start, end, cap in caps:
            subtitles.append(f'{len(subtitles)+1}\n{srt_time(offset+start)} --> {srt_time(offset+end)}\n{cap}\n')
        offset += duration
    (folder/'concat.txt').write_text(''.join(f"file '{name}'\n" for name in segments))
    run(['ffmpeg','-y','-v','error','-f','concat','-safe','1','-i',str(folder/'concat.txt'),
         '-c','copy','-movflags','+faststart',str(folder/'lesson.mp4')])
    (folder/'captions.srt').write_text('\n'.join(subtitles), encoding='utf-8')
    (folder/'timeline.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2))
    (folder/'plan.json').write_text(plan.model_dump_json(indent=2))
    frame(plan,1,30,30,plan.scenes[1].narration[:36],silent).save(folder/'poster.png')
    for name in segments:
        (folder/name).unlink()
    return {'video':'lesson.mp4','duration':round(offset,2),'has_audio':not silent}


if __name__ == '__main__':
    from core import load_env, demo_plan
    load_env()
    print(render_lesson(demo_plan(), ROOT/'examples/rendered', print))
