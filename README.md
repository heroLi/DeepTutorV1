# 小步讲题 Tutor Video

把一道小学数学题变成可理解、可复习的配音动画讲解。

这是可运行的本机家庭 MVP，不是已上线的完整商业产品。已实现从平均分示例到中文配音 MP4、字幕和课后练习的闭环；通用题目、题图与 DeepTutor 接入代码需要配置真实服务后联调。

## 离线分步学习（2026-11-03）

无需模型、配音或视频依赖即可走完规则示例的学习与复习：

1. 选择学习档案，输入糖果总数和人数。仅支持 2～48 颗糖、2～8 人且能整除的平均分。
2. 生成讲解稿，由家长核对题目、步骤与练习答案并勾选确认。
3. 点击“开始离线分步学习”，用“上一步 / 下一步”按孩子的节奏读题、理解、列式和检查。
4. 点击“我来试一题”，填写答案。答错会给提示，记录仍按两个档案分别保存。
5. 在“复习小记”重新打开这道题。当天先答错再改对，不算当天独立掌握。

这是参数化规则示例，不是任意题目的 AI 解题。输入自由文本或题图仍属于需要配置远程模型的另一模式。家长确认的讲解稿在进入离线学习后锁定；需要修改或改用视频时，请新建题目。原来的视频生成入口仍保留，配音可能联网。

如已有 FastAPI、Uvicorn、Pydantic、HTTPX、Pillow，可直接运行 `python -m uvicorn app:app --host 127.0.0.1 --port 8765`。不要为了离线学习运行会自动安装依赖的启动脚本。此处地址仅属于运行电脑的本机，不是可对外打开的分享链接。

新增无 pytest 依赖的回归检查：

```bash
python -m unittest discover -s tests -p test_offline_learning.py -v
node tests/test_offline_ui.js
```

这些检查不替代原 pytest 全套或真实浏览器/儿童试用验收。2026-11-03 云端检查与限制见 `docs/OFFLINE_LEARNING_VALIDATION.md`。

## 先看成品

- `examples/rendered/lesson.mp4`：12颗糖平均分给3人的配音动画，约38秒。
- `examples/rendered/captions.srt`：可导入剪辑软件的字幕。
- `examples/rendered/plan.json`：同一题的完整结构化讲解稿。

## 第一版能做什么

| 环节 | 当前实现 | 验证状态 |
|---|---|---|
| 题目输入 | 参数化平均分示例；文字输入；模型模式接收题图 | 示例已实测；通用模型/题图待真实密钥联调 |
| 资料输入 | 粘贴教材、笔记文字；可调用DeepTutor已有知识库 | 文本结构已实现；DeepTutor知识库未联调 |
| 讲解稿 | 读题、理解、列式、检查；可修改JSON后确认 | 示例已验证 |
| 中文配音 | Edge普通话；Mac系统中文声音；兼容`/audio/speech`的服务 | Edge已实际生成；其他两种待目标机验证 |
| 教学画面 | 固定板书模板；按轮次出现的平均分动画 | 已渲染检查 |
| 视频导出 | 1280×720、20fps、H.264/AAC MP4、SRT、分镜时间轴 | 已生成并检查音视频流 |
| 练习闭环 | 唯一答案判分、错误提示、答题历史、间隔复习 | 自动化测试通过 |
| 家庭档案 | 姐姐/妹妹分别保存题目与练习记录 | 数据分离测试通过；不是独立权限账号 |
| DeepTutor桥接 | 官方`deeptutor run deep_solve --format json`，可带`--kb` | 已对照CLI源码；没有完成真实部署联调 |

## Mac启动

需要 Python 3.11+ 和 FFmpeg。已具备环境时，不需要先安装DeepTutor即可运行平均分示例。

```bash
cd tutor-video
brew install ffmpeg  # 已安装可跳过；需要先有Homebrew
chmod +x start.sh
./start.sh
```

打开 `http://127.0.0.1:8765`。

1. 选择姐姐或妹妹的档案。
2. 保持“平均分示例”，点击生成讲解稿。
3. 核对题目、板书、讲解和练习题答案，勾选确认。
4. 生成视频，等待页面更新后播放。
5. 回答课后练习，在“复习小记”查看记录。

Edge配音需要网络。如果不通，在项目根目录复制`.env.example`为`.env`，设置：

```dotenv
TUTOR_TTS_PROVIDER=macos
TUTOR_MACOS_VOICE=Tingting
```

先运行 `say -v '?'` 查看本机有哪些声音；如无Tingting，在macOS系统设置中下载中文声音，或将上面变量改成已安装的声音名称。修改`.env`后重启服务。

没有语音服务时，可显式设置 `TUTOR_TTS_PROVIDER=preview` 生成标有“无声预览”的视频。配音失败不会自动伪装成成功。

## Linux / Docker

Linux先安装系统提供的FFmpeg，然后运行`./start.sh`。Docker方式：

```bash
docker build -t tutor-video .
docker run --rm -p 127.0.0.1:8765:8765 -v tutor-video-data:/app/data tutor-video
```

配置模型时可增加`--env-file .env`。镜像不包含密钥和家庭学习数据。当前安全边界只允许本机Host，不能直接当作公网服务部署。

## 接入自己的题目

在本机`.env`填写与Chat Completions兼容的模型服务配置。`BASE_URL`是基础路径，代码在后面追加`/chat/completions`：

```dotenv
TUTOR_LLM_BASE_URL=https://你的模型服务/v1
TUTOR_LLM_MODEL=服务商提供的准确模型ID
TUTOR_LLM_API_KEY=在本机填写，不要发到聊天里
```

选择“我的题目”。上传照片时，模型必须支持图像输入，否则改为手动输入文字。识别出的完整题目会显示在讲解稿中，需要先核对。当前没有单独OCR编辑步骤，也不支持直接上传整本PDF。

可以粘贴与本题相关的教材文字。通用题目的数字、推导和练习答案来自模型；代码只检查结构与动画参数，不能证明数学逻辑正确。第一版保留家长确认环节。

## 接DeepTutor

DeepTutor负责资料检索与解题，本项目负责将讲解整理成分镜，再配音、画图、合成视频。

详见 `docs/DEEPTUTOR.md`。每个孩子使用独立的DeepTutor运行目录。当前桥接仍需本项目的`TUTOR_LLM_*`模型把DeepTutor最终讲解转为分镜JSON，不能认为只配置DeepTutor就够了。

## 文件结构

```text
tutor-video/
  app.py                 本机API、SQLite、后台任务、练习与复习
  core.py                分镜协议、示例解题、模型和DeepTutor适配
  render.py              普通话配音、固定画面、动画与MP4合成
  index.html             响应式家庭学习界面
  start.sh               Mac/Linux启动脚本
  Dockerfile             Linux容器入口
  .env.example           模型与配音配置示例
  assets/                中文字体及其许可证
  examples/rendered/     实际生成的配音讲题示例
  tests/                 数学与状态/数据边界测试
  docs/                  架构、DeepTutor接入、开发路线与验证记录
  data/                  首次运行后创建；不包含在交付包中
```

## 开发与测试

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m pytest -q
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8765
```

API交互文档：`http://127.0.0.1:8765/docs`。

在命令行生成样例：`.venv/bin/python render.py`。默认需要Edge网络；视频时间由每段真实音频时长决定。字幕为按句长估算的时间，不是逐字强制对齐。

## 数据与使用边界

- 学习数据默认保存在项目内`data/`，备份该文件夹即可保留记录。请勿把`.env`和`data/`提交到代码仓库。
- 切换姐姐/妹妹只是本机档案选择，不是登录隔离。当前不适合多人公网使用。
- 模型模式会把题目、选中的资料文字及题图发送给配置的模型服务；Edge配音会发送讲解文字。示例出题本身不需要远程模型。
- 删除一道题会删除它的题目、媒体与练习记录；可先导出学习记录。DeepTutor原生数据由其独立运行目录管理，本项目不会自动删除。
- 观看完成不自动算掌握。复习记录要求不同日期首次答对；重复猜答案不计当天独立成功。当前仍是同一道迁移题的复习，不能据此判断跨题型能力。
- 暂未实现真人数字老师、实时语音对话、任意几何图自动构造、批量PDF解析、自动纠正任意模型错误、付费系统与公网账号。

## 后续推进

先在两个孩子各自的一小段教材上试用，记录“讲错、没听懂、画面不清、太快”四类问题，再扩展题型。具体路线见 `docs/PROJECT_PLAN.md`。

原创项目代码采用MIT许可；随包字体遵循`assets/OFL.txt`。DeepTutor是独立项目，不包含在本包中，其许可与依赖以原仓库为准。
