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
- A new question-dialogue page offers nine authored questions, four finite follow-up intents and local text matching. Unknown text is not treated as model understanding. Recent dialogue exists only in page memory and is cleared on question/profile/route changes and refresh; it never changes learning scores or records.
- Optional voice input requires the browser to confirm an already-installed on-device zh-CN recognizer; there is no cloud fallback or language-pack download. Recognition starts only on an explicit click, is capped at 20 seconds, and places a transcript in the input for review before a separate local submission. Read-aloud uses only a voice explicitly marked local by the browser. Unsupported capabilities remain disabled with an explanation. Physical-device recognition and actual spoken output have not been verified.

## Provenance and scope
- Source project: https://github.com/heroLi/DeepTutorV1/tree/dev/offline-learning-20261103
- Verified upstream commit: aa08554c4fc242c6c2653a92720097580c037b2d.
- Guided-practice content adapts the original bounded average-sharing rule and `language_practice.py`. Assessment items are additional bounded original examples, not textbook units.
- This is a separate static preview adapter. It is mirrored under `prototypes/xiaobu-learning/` on the original development branch; the original FastAPI/SQLite application is not replaced or deployed by it. Sites retains a separate source repository and hosting identity.
- Review dates use the device local calendar: independent transfer/review success proposes three days, otherwise one day. Early practice cannot delay an existing due date, and an early error may bring it forward. Only opening the page evaluates due items; no notifications or cloud scheduler are created. Fixed review items may repeat.
- No real child information is used in the examples or tests. The page asks users not to type personal details. Optional text/transcripts are processed only in page memory, never persisted or transmitted by the app; no recording is stored. Selected practice answers, timestamps and progress remain browser-local.
- No cloud database, analytics, remote model, remote TTS or video-generation service is invoked. The video is a pre-rendered local asset; its offline narration source and exact script are retained in `sources/narration`.
- The finite questions and answers are inspectable in browser source, so this is not a secure assessment. Scores do not establish mastery.
- Does not provide Shanghai textbook alignment, live DeepSeek dialogue, arbitrary-question tutoring, uploads, cross-device records or a full family learning system.
- Hosting audience is owner-only via Sites. Never broaden sharing without the user's request.

## Offline model safety contract
`server-sim/` is an executable contract simulator and test fixture, not a deployed backend. It exercises trusted-caller/profile checks, strict request and response allowlists, deterministic answer validation, integer simulated-budget reservations, idempotency and conservative cancellation/timeout handling. It makes no HTTP or provider calls and uses no credentials. The browser does not import it; client-side records and limits are not production security controls. See `docs/SAFE_MODEL_ADAPTER.md` for the exact boundaries and prerequisites for a future authorized integration.

## Undeployed DeepSeek adapter
`server/` adds an HTTP protocol adapter and a default-disabled runtime, Sites-specific identity adaptation, owner/profile authorization, a D1-compatible SQL ledger, atomic budget reservations, request-rate/inflight limits, and bounded incoming-body reads. An authenticated read-only status route explains conservative quota, rate/inflight and operational stop conditions without invoking a model or exposing identities; diagnostic cold starts do not reopen POST. Local tests run real SQLite files, independent worker-thread connections and fake provider responses; no paid call is made. The static Site does not run or call this backend. The SQL migration and platform ingress adapter have NOT been deployed or verified on hosted D1/Sites. Live use still requires reviewed deployment wiring, a safely provisioned approval scope, specific spending authorization, current pricing and a server-side secret manager. See `docs/DEEPSEEK_INTEGRATION.md`. Supplying a key alone is not sufficient.

## Source-only browser API client
`client/tutor-client.js` prepares a disabled-by-default, same-origin transport with explicit expected mode, finite inputs and exact authored response checks. It has bounded reads, no retries or automatic fallback, and isolates cancellation/late results and mutated caller objects. It is not imported by the hosted page and never receives free-form text or recordings. See `docs/CLIENT_TRANSPORT.md`. Common local secrets/databases are ignored, with narrow release-boundary regression tests; these do not replace a production security review.

## Runnable local HTTP fixture
`npm run demo:api` starts a real HTTP simulation on `127.0.0.1` with an independent temporary SQLite database and a fake provider. It exposes the narrow status/dialogue routes using synthetic identity and TEST units only. This is not production authentication and cannot be reached remotely through the printed localhost URL. It reads no real keys and must not be tunneled or deployed. See `docs/LOCAL_API_DEMO.md` for requests, limits and cleanup.

## Verify and render
Tests require Node 22.13+ for the built-in SQLite test adapter (current local validation uses Node 24). `npm test`, `node --check dist/app.js`, `node --check dist/model.js` and supported Sites browser preview. No dependency installation/build needed.

`scripts/render_average_video.py` creates a real 1280×720, 24fps video from nine offline AIFF narration files and a licensed Chinese font. Pass `--audio-dir sources/narration`, `--output-dir dist/media`, `--work-dir <render-workspace>` and `--font <XiaoBuLearningSansSC.ttf>`. Font provenance/license are in `sources/`. The font is not needed to serve the finished video. Subtitle clip boundaries are based on measured audio lengths; sentence timing within clips is approximate.

## Source distribution
The existing GitHub source repository is public. Owner-only access applies to the hosted Sites preview, not to source code. Repository visibility is unchanged; no learner records or hosting credentials are included.

The GitHub mirror excludes `.openai/`, Git metadata, raw narration AIFF files and all browser/runtime records. It includes the finished MP4, poster and captions so the static page works from a checkout. Raw narration inputs are retained in the original private Sites source, so the GitHub mirror alone is not a full video re-render kit. Never copy a hosting identity or credentials when serving the prototype elsewhere.
