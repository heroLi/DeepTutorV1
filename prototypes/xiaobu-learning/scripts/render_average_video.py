"""Deterministic, genuinely animated MP4 with local Mandarin narration.
Inputs: nine independently synthesized offline AIFF clips and licensed CJK font.
No network, models or private data. Output is H.264/AAC with burned subtitles.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess, json, math, re, argparse
from functools import lru_cache
W,H,FPS=1280,720,24
BG='#fbfaf5';INK='#193d36';GREEN='#256650';MUTED='#60716b';GOLD='#e6a756'
SCRIPTS=[
'今天，我们来分糖果。十二颗糖，平均分给三个小朋友，每人分到几颗？',
'先找条件。一共十二颗糖，分给三个人。平均分，就是每个人得到的糖一样多。',
'我们一颗一颗轮流分。第一轮，每人一颗。一共分掉三颗，还剩九颗。',
'第二轮，每人再得一颗。现在每人两颗，还剩六颗。',
'第三轮，每人有三颗，还剩三颗。',
'最后一轮，每人又得一颗。糖分完了，每人正好四颗。',
'所以，十二除以三，等于四。十二是糖的总数，三是人数，四是每个人得到的颗数。',
'再检查一下。四乘三等于十二。三个人都是四颗，刚好用完十二颗，答案正确。',
'现在轮到你了。十八颗糖，平均分给三个小朋友，每人几颗？先暂停想一想，再回到练习里试一试。']
TITLES=['一起分糖果','读题：找到三个关键条件','第 1 轮 · 每人轮流拿一颗','第 2 轮 · 继续平均分','第 3 轮 · 一样多，别着急','第 4 轮 · 分完啦','列式：把过程写成算式','检查：答案真的对吗？','换一道题，你来试试']
@lru_cache(None)
def font(size):return ImageFont.truetype(str(FONT),size)
def text(d,xy,s,size=36,fill=INK):d.text(xy,s,font=font(size),fill=fill)
def centered(d,cx,y,s,size=36,fill=INK):text(d,(cx-font(size).getlength(s)/2,y),s,size,fill)
def wrap(s,size,maxw):
 out=[];line=''
 for c in s:
  if c=='\n' or (line and font(size).getlength(line+c)>maxw):out.append(line);line='' if c=='\n' else c
  else:line+=c
 if line:out.append(line)
 return out

def candy(d,x,y,scale=1,color=GOLD):
 # The center and wrapper animate as one object, not a static background pan.
 r=13*scale
 d.polygon([(x-r,y),(x-r-11*scale,y-12*scale),(x-r-11*scale,y+12*scale)],fill=color)
 d.polygon([(x+r,y),(x+r+11*scale,y-12*scale),(x+r+11*scale,y+12*scale)],fill=color)
 d.rounded_rectangle((x-r,y-r,x+r,y+r),radius=8*scale,fill=color,outline='#bd8239',width=max(1,round(scale)))
 d.line((x-5*scale,y-r+3*scale,x+5*scale,y+r-3*scale),fill='#fff4de',width=max(1,round(3*scale)))

def child(d,cx,y,color):
 d.ellipse((cx-26,y-26,cx+26,y+26),fill=color)
 d.ellipse((cx-11,y-6,cx-7,y-2),fill=INK);d.ellipse((cx+7,y-6,cx+11,y-2),fill=INK)
 d.arc((cx-9,y-3,cx+9,y+11),0,180,fill=INK,width=2)

def sourcepos(i):return (420+(i%6)*88,225+(i//6)*45)
def targetpos(i):
 g=i%3;n=i//3
 return (250+g*390+(n%2)*64-32,422+(n//2)*54)

def captions(n,duration):
 parts=[x for x in re.split(r'(?<=[。？！])',n) if x]
 # Sentence boundaries use exact recorded clip boundaries; intra-clip timing is proportional.
 out=[];t=0;weight=sum(len(p) for p in parts)
 for p in parts:
  end=t+len(p)/weight*duration;out.append((t,end,p));t=end
 return out

def render(scene,t,duration,caption,total_progress):
 im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
 d.rounded_rectangle((44,24,184,67),16,fill=GREEN);centered(d,114,28,'小步讲题',24,'white')
 text(d,(208,31),'原创示例 · 平均分',22,MUTED);text(d,(1080,31),f'{scene+1:02} / 09',22,GREEN)
 text(d,(54,90),TITLES[scene],40)
 text(d,(56,148),'12 颗糖，平均分给 3 个小朋友，每人几颗？' if scene<8 else '18 颗糖，平均分给 3 个小朋友，每人几颗？',28,MUTED)
 if scene==0:
  d.rounded_rectangle((60,209,770,555),26,fill='white',outline='#dde5dc',width=2)
  centered(d,415,230,'一共有 12 颗糖',32)
  for i in range(12):
   a=min(1,max(0,t*5-i*.18));x=240+(i%4)*116;y=325+(i//4)*78
   if a>0:candy(d,x,y,1.55*a)
  d.rounded_rectangle((800,209,1220,555),26,fill='#e5efe7')
  centered(d,1010,230,'分给 3 个小朋友',29)
  for g in range(3):child(d,900+g*110,360,['#d0e1c4','#f2d49e','#ddd7eb'][g])
  centered(d,1010,440,'每人一样多',35,GREEN)
 elif scene==1:
  cards=[('12','颗糖','总数'),('3','个人','份数'),('一样多','','平均分')]
  for i,(big,unit,small) in enumerate(cards):
   x=55+i*408;show=t>=i*.5
   d.rounded_rectangle((x,220,x+358,545),25,fill=['#f6e6cf','#e5efe7','#e7e6f1'][i])
   centered(d,x+179,250,small,27,MUTED)
   if show:centered(d,x+179,310,big,74 if i<2 else 47,GREEN);centered(d,x+179,425,unit,31)
 elif 2<=scene<=5:
  round_no=scene-1;previous=(round_no-1)*3
  start=1.5 if scene==2 else .35
  animate_for=max(1.7,duration-start-1.3)
  progress=max(0,min(3,(t-start)/animate_for*3));done=previous+min(3,int(progress))
  moving=previous+int(progress) if progress<3 and progress>0 else None
  frac=progress%1
  d.rounded_rectangle((55,202,1225,300),22,fill='#f1eee1')
  text(d,(75,224),'待分的糖',24,MUTED)
  for i in range(done,12):
   if i==moving:continue
   candy(d,*sourcepos(i),.98)
  text(d,(1025,226),f'还剩 {12-done} 颗',26,GREEN)
  for g in range(3):
   cx=250+g*390
   d.rounded_rectangle((cx-175,340,cx+175,556),25,fill='white',outline='#bad0bd',width=2)
   child(d,cx,337,['#d0e1c4','#f2d49e','#ddd7eb'][g]);centered(d,cx,364,f'第 {g+1} 位小朋友',22,MUTED)
   count=sum(1 for i in range(done) if i%3==g)
   centered(d,cx,512,f'{count} 颗',25,GREEN)
  for i in range(done):candy(d,*targetpos(i),1.05)
  if moving is not None:
   sx,sy=sourcepos(moving);ex,ey=targetpos(moving);f=frac*frac*(3-2*frac)
   candy(d,sx+(ex-sx)*f,sy+(ey-sy)*f-55*math.sin(math.pi*f),1.15)
 elif scene==6:
  d.rounded_rectangle((58,213,1222,557),28,fill='white',outline='#dde5dc',width=2)
  centered(d,640,240,'12  ÷  3  =  4',80,GREEN)
  for x,a,b in [(330,'糖的总数','12 颗'),(640,'平均分成','3 份'),(950,'每人得到','4 颗')]:
   d.line((x,365,x,387),fill='#b5c9b7',width=3);centered(d,x,400,a,28,MUTED);centered(d,x,448,b,37)
 elif scene==7:
  for g in range(3):
   cx=250+g*390;d.rounded_rectangle((cx-165,211,cx+165,433),22,fill='#e5efe7')
   centered(d,cx,224,'4 颗',33,GREEN)
   for n in range(4):candy(d,cx-40+(n%2)*80,310+(n//2)*65,1.3)
  centered(d,640,459,'4 × 3 = 12',61,GREEN);centered(d,640,535,'每人一样多，刚好分完。',29)
 else:
  d.rounded_rectangle((60,217,1220,555),28,fill='#e5efe7')
  centered(d,640,245,'现在，换你来分',40,GREEN)
  centered(d,640,325,'18  ÷  3  =  ?',77,INK)
  centered(d,640,451,'先暂停想一想，再回到练习试一题',28,GREEN)
  centered(d,640,502,'我们不着急。',25,MUTED)
 # Burned-in captions, readable in landscape/full-screen. Exact same text is provided as VTT.
 d.rounded_rectangle((44,585,1236,690),18,fill=INK)
 ls=wrap(caption,37,1110)
 if len(ls)>2:raise ValueError('Subtitle exceeds two lines: '+caption)
 top=599 if len(ls)>1 else 616
 for j,line in enumerate(ls):centered(d,640,top+j*44,line,37,'white')
 d.rounded_rectangle((44,703,1236,710),3,fill='#dce5d8');d.rounded_rectangle((44,703,max(48,44+1192*total_progress),710),3,fill=GREEN)
 return im

def duration(path):return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(path)]).decode().strip())
def stamp(t,sep='.'):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}{sep}{ms%1000:03}'
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--audio-dir',required=True);a.add_argument('--output-dir',required=True);a.add_argument('--font',required=True);a.add_argument('--work-dir',required=True);a=a.parse_args()
 FONT=Path(a.font);audio=Path(a.audio_dir);out=Path(a.output_dir);work=Path(a.work_dir);out.mkdir(parents=True,exist_ok=True);work.mkdir(parents=True,exist_ok=True)
 clips=sorted(audio.glob('*.aiff'))
 if len(clips)!=9:raise ValueError(f'Expected 9 AIFF clips, found {len(clips)}')
 lengths=[math.ceil((duration(c)+.55)*FPS)/FPS for c in clips];total=sum(lengths);offset=0;vtt=['WEBVTT\n'];timeline=[]
 for i,(clip,secs,narration) in enumerate(zip(clips,lengths,SCRIPTS)):
  caps=captions(narration,secs-.4);segment=work/f'segment-{i}.mp4'
  cmd=['ffmpeg','-y','-v','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(clip),'-map','0:v','-map','1:a','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','44100','-af','apad','-t',str(secs),'-movflags','+faststart',str(segment)]
  p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
  try:
   for f in range(round(secs*FPS)):
    t=f/FPS;cap=next((c for start,end,c in caps if start<=t<end),'')
    frame=render(i,t,secs,cap,(offset+t)/total);p.stdin.write(frame.tobytes())
    if f==round((secs-.6)*FPS):frame.save(work/f'review-scene-{i+1:02}.jpg',quality=92)
   p.stdin.close();rc=p.wait()
   if rc:raise RuntimeError('FFmpeg encoding failed')
  finally:
   if p.poll() is None:p.kill()
  timeline.append({'scene':i+1,'start':offset,'duration':secs,'narration':narration,'title':TITLES[i]})
  for start,end,cap in caps:vtt.append(f'{stamp(offset+start)} --> {stamp(offset+end)}\n{cap}\n')
  offset+=secs;print(f'Scene {i+1}/9 rendered, {secs:.2f}s',flush=True)
 (work/'concat.txt').write_text(''.join(f"file 'segment-{i}.mp4'\n" for i in range(9)))
 subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','1','-i',str(work/'concat.txt'),'-c','copy','-movflags','+faststart',str(out/'average-sharing.mp4')],check=True)
 (out/'average-sharing.vtt').write_text('\n'.join(vtt),encoding='utf-8');(work/'timeline.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2),encoding='utf-8')
 render(0,5,lengths[0],'12 颗糖，平均分给 3 个小朋友',0).save(out/'average-sharing-poster.jpg',quality=94)
 print(json.dumps({'duration':total,'video':str(out/'average-sharing.mp4'),'size':(out/'average-sharing.mp4').stat().st_size},ensure_ascii=False),flush=True)
