# DeepTutor接入与联调

核对日期：2026-10-27。参考的main分支会变化，建议真实联调时固定版本，并重新检查`deeptutor run --help`。

## 可复用部分

DeepTutor用于教材知识库、资料检索、解题与其原生学习工作区。本项目增加分镜、中文配音、确定性教学动画、视频任务与独立练习记录。

官方资料：

- https://github.com/HKUDS/DeepTutor
- https://github.com/HKUDS/DeepTutor/blob/main/SKILL.md
- https://github.com/HKUDS/DeepTutor/blob/main/docs-for-user/AGENT_SETUP.md
- https://github.com/HKUDS/DeepTutor/blob/main/deeptutor_cli/main.py
- https://github.com/HKUDS/DeepTutor/blob/main/deeptutor_cli/common.py

main.py定义`deeptutor run`，common.py中`stream_turn_as_json`按行输出JSON事件。桥接器提取`content`及最终答复事件，不把thinking记录写进讲解稿；出现error事件时停止。

## 在目标电脑安装

不要先将DeepTutor装进本项目虚拟环境。采用独立环境，避免依赖冲突。安装前阅读官方当前版本的SKILL和AGENT_SETUP。

以下是全应用PyPI安装示例，按官方要求准备Python与Node.js：

```bash
mkdir -p "$HOME/learning-tools/deeptutor-runtime-sister"
python3 -m venv "$HOME/learning-tools/deeptutor-venv"
"$HOME/learning-tools/deeptutor-venv/bin/python" -m pip install -U deeptutor
```

给姐姐、妹妹分别选独立的运行目录，并在同一个目录/`--home`下完成初始化和模型配置。可先只配置一个孩子做联调；不要共用同一个原生学习记忆目录。

```bash
"$HOME/learning-tools/deeptutor-venv/bin/deeptutor" init \
  --home "$HOME/learning-tools/deeptutor-runtime-sister"
```

`init`会引导模型配置。知识库检索通常还需要嵌入模型，不能只安装软件而不配置服务。

本项目`.env`示例（必须用你电脑上的绝对路径，dotenv不会展开$HOME或~）：

```dotenv
TUTOR_DEEPTUTOR_BIN=/Users/你的用户名/learning-tools/deeptutor-venv/bin/deeptutor
TUTOR_DEEPTUTOR_HOME_SISTER=/Users/你的用户名/learning-tools/deeptutor-runtime-sister
TUTOR_DEEPTUTOR_HOME_LITTLE_SISTER=/Users/你的用户名/learning-tools/deeptutor-runtime-little-sister
TUTOR_DEEPTUTOR_KB=
```

`TUTOR_DEEPTUTOR_KB`填写当前运行目录里已建立的知识库名称；空值表示不指定教材库。如果两个目录都启用，应各自创建可用的同名教材库。当前配置只有一个KB名称字段。

实际调用相当于：

```bash
DEEPTUTOR_HOME=/绝对路径/姐姐独立运行目录 \
  /绝对路径/deeptutor run deep_solve \
  '12颗糖平均分给3人，每人几颗？请用小学方法讲解。' \
  --format json
```

需要教材检索时追加`--kb 教材库名称`。参数由Python数组传入，不经过shell拼接。

## 本项目还需要模型配置

DeepTutor最终讲解是文字；当前适配器再用`TUTOR_LLM_*`指向的兼容模型将它变成LessonPlan JSON。也就是说，桥接模式通常至少包含一次DeepTutor任务和一次分镜模型请求。它们不是同一个配置文件，也不会自动共享登录凭据。

照片目前不能直接传给CLI桥接。先在“我的题目”模式识别/输入文字并确认，再用文字接DeepTutor。将来可增加独立OCR步骤后自动转交。

## 联调验收

1. DeepTutor本地`doctor`通过，再进行`doctor --online --format json`真实模型检查。
2. 如果用了知识库，导入少量教材，在DeepTutor中确认能引用到正确段落。
3. 在同一运行目录执行上面的`run deep_solve`，检查是否包含最终content事件。
4. 在小步讲题选择DeepTutor模式生成讲解稿，检查题目、过程、答案、教材依据。
5. 合成视频并回答迁移题；重启两套服务后，确认本项目记录与DeepTutor学习状态仍在。
6. 换到另一个孩子的独立目录，重复测试，检查记录是否混用。

截至本交付，以上真实DeepTutor联调尚未执行。已完成的是CLI文档/源码核对、适配器实现及流事件解析测试。没有声称已安装到你的Mac。

## 稳定性策略

CLI桥接适合家庭MVP与第一轮联调。稳定后可把DeepTutor封装为独立服务，并版本化任务请求、结果协议和鉴权。不要依赖未核实的内部`/api/*`路径，也不要直接操作它的SQLite或记忆文件。
