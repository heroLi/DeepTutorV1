# 小步学习 · 私密体验

A private, buildless static learning preview for 小步讲题 / DeepTutorV1.

## What works
- A bounded learning loop uses original synthetic questions and deterministic local rules: first attempt, structured follow-up questions, choice-specific explanations, a different transfer problem, browser-local review dates and an evidence-based parent summary. The interface explicitly labels this as a rules simulation, not a connected DeepSeek conversation.
- Three original sample topics: equal sharing, contextual Chinese antonyms, and English a/an.
- Two-question guided practice, progressive hints and a distinct follow-up question. Desktop/iPad learning routes use a viewport-sized workspace with questions and actions beside guidance. Main actions stay outside scrollable content; long questions or accumulated hints may scroll within their own pane. Phones keep a stacked layout.
- The math practice page can switch between hints and the existing video after an attempt, without leaving the question. Redraws stop old playback; the same question restores its video position paused. No language video is implied.
- Sample assessments display one question at a time, with numbered navigation, saved question position and answers, and a gated final submission. Results show one explanation at a time. Wrong-question retries and completion summaries also use the compact workspace.
- 69-second real animated H.264/AAC video explaining 12 ÷ 3 = 4, with offline Mandarin Tingting narration and burned-in Chinese subtitles. The video ends with an 18 ÷ 3 transfer prompt. Large child-friendly buttons below the video provide play/pause, 5-second rewind/forward and replay at the end. Native controls still provide pause, seek and full screen. Buttons have descriptive accessible labels, quiet state announcements and 80px minimum touch height on phone layouts; compact learning panes retain at least 64px media controls.
- Two anonymous browser-local profiles A/B, ongoing practice restore, original mistake records, correction retries, four-question sample-unit assessments, stored result explanations and a parent summary.
- Records persist only in this browser through localStorage, are not cloud backups, may be lost when browser data is cleared and do not sync across devices. Both profiles are visible to anyone using the same browser; they are not separate authenticated accounts. A user can clear the current profile after confirmation.
- Voice dialogue is explicitly unavailable. No microphone request, speech recognition, live model request or API key exists in this app.

## Provenance and scope
- Source project: https://github.com/heroLi/DeepTutorV1/tree/dev/offline-learning-20261103
- Verified upstream commit: aa08554c4fc242c6c2653a92720097580c037b2d.
- Guided-practice content adapts the original bounded average-sharing rule and `language_practice.py`. Assessment items are additional bounded original examples, not textbook units.
- This is a separate static preview adapter. It is mirrored under `prototypes/xiaobu-learning/` on the original development branch; the original FastAPI/SQLite application is not replaced or deployed by it. Sites retains a separate source repository and hosting identity.
- Review dates use the device local calendar: independent transfer/review success proposes three days, otherwise one day. Early practice cannot delay an existing due date, and an early error may bring it forward. Only opening the page evaluates due items; no notifications or cloud scheduler are created. Fixed review items may repeat.
- No names, school, ages, free-form child input, photos or audio recordings are collected. Selected answers, timestamps and progress are saved on the current device only.
- No cloud database, analytics, remote model, live TTS or video-generation service is invoked. The video is a pre-rendered local asset; its offline narration source and exact script are retained in `sources/narration`.
- The finite questions and answers are inspectable in browser source, so this is not a secure assessment. Scores do not establish mastery.
- Does not provide Shanghai textbook alignment, DeepSeek dialogue, uploads, cross-device records or a full family learning system.
- Hosting audience is owner-only via Sites. Never broaden sharing without the user's request.

## Offline model safety contract
`server-sim/` is an executable contract simulator and test fixture, not a deployed backend. It exercises trusted-caller/profile checks, strict request and response allowlists, deterministic answer validation, integer simulated-budget reservations, idempotency and conservative cancellation/timeout handling. It makes no HTTP or provider calls and uses no credentials. The browser does not import it; client-side records and limits are not production security controls. See `docs/SAFE_MODEL_ADAPTER.md` for the exact boundaries and prerequisites for a future authorized integration.

## Verify and render
`npm test`, `node --check dist/app.js`, `node --check dist/model.js` and supported Sites browser preview. No dependency installation/build needed.

`scripts/render_average_video.py` creates a real 1280×720, 24fps video from nine offline AIFF narration files and a licensed Chinese font. Pass `--audio-dir sources/narration`, `--output-dir dist/media`, `--work-dir <render-workspace>` and `--font <XiaoBuLearningSansSC.ttf>`. Font provenance/license are in `sources/`. The font is not needed to serve the finished video. Subtitle clip boundaries are based on measured audio lengths; sentence timing within clips is approximate.

## Source distribution
The existing GitHub source repository is public. Owner-only access applies to the hosted Sites preview, not to source code. Repository visibility is unchanged; no learner records or hosting credentials are included.

The GitHub mirror excludes `.openai/`, Git metadata, raw narration AIFF files and all browser/runtime records. It includes the finished MP4, poster and captions so the static page works from a checkout. Raw narration inputs are retained in the original private Sites source, so the GitHub mirror alone is not a full video re-render kit. Never copy a hosting identity or credentials when serving the prototype elsewhere.
