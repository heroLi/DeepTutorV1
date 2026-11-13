# Local dialogue and DeepSeek adapter verification — 2026-11-13

## Final checks and boundaries
- 115/115 Node tests passed. All shipped frontend, server, simulator and test JavaScript passed syntax checks; `git diff --check` passed. No dependency was added.
- The 20 adapter tests use injected fake HTTP responses and synthetic credentials. They cover 36 question/intent pairs, strict protocol/answers, cancellation and timeouts, auth/profile boundaries, CSRF, duplicate/concurrent claims, cached errors/results, conservative cost reservations and scope freezing. No real API call or credential access occurred.
- The Site remains static with a local finite mock. The new HTTP adapter is source code only, not a deployed authenticated service. Durable transactional accounting, rate limiting, real authorization and a specific API budget are still prerequisites.
- Voice unit tests use fake browser capabilities: installed local recognition only, no cloud fallback or pack installation, explicit start, 20-second stop, transcript review without automatic send, cancellation/late callbacks, microphone rejection and local-only synthesis.

## Browser acceptance
- Supported Chromium verified math/Chinese/English dialogue, typed known and unknown questions, literal HTML-like text escaping, empty repeated submissions, keyboard activation, question/profile switching, route departure and reload. Dialogue clears instead of being written to learning records. The repeated hint sentence found in QA was corrected and frontend/server contracts were rechecked.
- Six same-origin fixture viewports (1366×768, 1280×720, 1024×768, 768×1024, 820×1180, 1180×820) had document dimensions equal to their viewports. Questions/actions and the composer remained within the screen; the message area and long question text can scroll internally. Dialogue action buttons measured at least 46px; phone buttons measured 56px.
- A 390×844 phone fixture had 375px usable content width, no horizontal overflow and intentional vertical scrolling. A known typed question and empty repeat submission worked there.
- This browser could not confirm installed local Chinese recognition or a local Chinese voice. Both controls stayed disabled with explanatory text. No microphone permission was granted, no recording was made, and actual recognition/spoken output was not tested. Fake-capability unit tests are not real-device acceptance.
- Existing video still played unmuted, advanced to 10.808879s, paused and reported duration 69.273243s, readyState 4, no media error. Assessment navigation remained reachable; the full previous learning/storage/media suites passed unchanged.
- Console samples contained extension-origin metadata errors, not an observed application error. No production learner records were read or cleared. Only synthetic preview activity was used; no localStorage records are packaged.
- No physical iPad/iPhone/Android, Safari, touch hardware or screen-reader certification. The temporary viewport fixture was removed before release. Site audience and source-repository visibility remain unchanged.

---

# Guided learning loop verification — 2026-11-11

## Final local checks
- 82/82 Node tests passed, covering the previous learning/media suite, three-subject guided-loop model and UI flows, and 19 offline model-safety contract tests. Every shipped and simulator JavaScript file passed `node --check`; `git diff --check` passed.
- Finite original questions only. No live DeepSeek request, microphone/recording, real TTS, uploaded child information, analytics, new dependency or paid provider was used.
- The simulator is not deployed or imported by the browser. Its single-process accounting is expressed in simulated integer units, not money. It does not establish production authentication, a durable budget ledger or real model correctness.

## Browser acceptance
- Used supported desktop Chromium and a temporary same-origin viewport fixture. Desktop/tablet dimensions were 1366×768, 1280×720, 1024×768, 768×1024, 820×1180 and 1180×820. Phone fixture was 390×844 (375px content width with scrollbar).
- Initial long Chinese question, answered guidance and completion views fit all six desktop/tablet document viewports. Question text remained 24–26px; check/continue buttons were at least 52px. Long content can scroll within its pane; primary actions remain in view. Phone layout intentionally scrolls vertically and showed no horizontal overflow.
- Real UI mathematics: first answer 3 was retained as incorrect; guidance step one answered incorrectly and step two correctly; original retry 4 and different transfer answer 5 were separately recorded. Transfer answer was hidden until submission. Reload during the retry restored progress.
- Early review: original due date November 14 was retained until an early incorrect first answer 6 and assisted correction 3 brought the next date forward to November 12. The UI explicitly separates independent and assisted answers. Node tests additionally cover early success, due-day success, overdue tasks, leap/year boundaries, and an early-started review completed after its due date.
- Real UI Chinese loop: 多 → two follow-up choices → 小 → incorrect transfer 短. Result and original errors remained separate and review was scheduled for the next local calendar day.
- Real UI English loop at narrow width: an → two follow-up choices → a → transfer an. Completed evidence and its future date survived a page reload.
- A/B profile switching separated new loop data. Earlier synthetic foundation-practice records, original mistakes/corrections and a 3/4 assessment result remained readable. Parent error totals now include both paths, while foundation completion/correction counts are explicitly scoped.
- Existing video regression: actual unmuted playback advanced to 10.453693s, paused, then the large forward button moved exactly to 15.453693s. The 69.273243s video reported readyState 4, with no media error.
- Selection buttons expose aria-pressed; keyboard focus is retained after selection and moves to the next action after a guiding answer. This is code/state verification, not screen-reader certification.
- Synthetic records remain only on the local preview origin. No production records were read, modified or cleared. No stored QA records are packaged. The temporary viewport fixture was removed before release.

## Review fixes
- Clarified old/new statistics and empty states to avoid contradictory zero-error messages.
- Changed the math transfer example to 20 ÷ 4 = 5 so it differs from the first answer.
- Early review errors may bring a date forward but never delay an existing due date. Scheduling uses submission date, not a stale early-start flag.
- Rejected invalid skipped stages and non-ISO persisted times. Malformed new-loop data does not invalidate legacy records or the other profile.
- Random run-ID suffixes and revision checks prevent stale/double actions from being applied to a later phase or another profile's similarly numbered run.

## Limits
- No physical iPad, iPhone, Android, Safari or touch-hardware tests. Responsive iframe checks are not real-device certification.
- Review scheduling is local and recalculated when opened. It creates no notifications, cloud scheduler or cross-device synchronization. Device date/time changes affect it. Concurrent tabs are not synchronized.
- Repeated practice/review uses fixed authored examples, not generated unseen questions. Scores and successful retries are evidence of those choices, not proof of mastery.
- The original FastAPI application is not replaced by the isolated prototype directory. Site publication and GitHub synchronization are separately verified by their returned source/deployment records.

---

# One-screen learning workspace verification — 2026-11-11

## Final checks
- 45/45 Node tests passed, including original learning/storage/media behavior plus assessment cursor validation, old-save compatibility, workspace UI flows, guidance gating, media bookmark/lifecycle cleanup and compact completion. JavaScript syntax checks and `git diff --check` passed.
- No paid services, dependencies, real child data, microphone permissions, model calls or new network services were introduced. Existing owner-private hosting and browser-local data boundaries remain unchanged.

## Browser and viewport verification
- Used supported Chromium controls and a temporary same-origin iframe with explicit viewport dimensions: 1366×768, 1280×720, 1024×768, 768×1024, 820×1180, 1180×820, plus mobile 390×844. The QA fixture is excluded from the release.
- A normal answered mathematics question, standalone video, and paged result view had document dimensions equal to the six desktop/tablet viewports, with main answer/navigation/media controls inside the viewport. Before the change, the answered math page was 1059px tall at 1366×768 and 1280×720.
- The final real desktop tab (1180×757) displayed the question, choices, feedback, video and large controls together with no page overflow. Actual unmuted video playback advanced to 12.27s and paused successfully.
- Questions remained 24–26px. Choices measured 60–64px tall; standard answer/navigation buttons were 52px tall. Standalone media buttons measured at least 64px on tested desktop/tablet layouts; phone controls remained about 84.6px tall.
- Long Chinese question content at 1280×720 required approximately 38px of internal scrolling, and three accumulated math hints at 1024×768 required approximately 49px. Main actions remained fixed and visible outside those scroll areas. This is a one-screen-priority design, not a promise that arbitrary long content never scrolls.
- Portrait Chinese practice at 768×1024 displayed its full question, choices, hint and actions with no page overflow. Language practice had no false video tab.
- Phone layout remained vertically stacked with no horizontal overflow (375px content width inside the 390px fixture). Answer checking and actual video playback still worked; phone vertical scrolling remains intentional.
- Larger-than-desktop iframe controls sometimes required keyboard activation because they were below the visible host browser window; layout measurements used the iframe viewport itself. These checks are not physical iPad/iPhone/Android, Safari, touch-hardware or screen-reader certification.

## Flow regression
- Same-question math video position restored exactly at 5.300922s after switching to hints and back, paused rather than autoplaying. Advancing to the second question returned to hint mode and kept guidance gated until an attempt. New media instances did not leave old audio playing.
- Incorrect math answer, all three hints, correction, second-question completion and the compact completion summary worked. A/B profiles remained separate.
- Assessment navigation retained earlier choices, disabled submission until all four answers, and restored both answers and question 4 after a full reload and returning through Continue. A deliberately incorrect run scored 3/4, with answers shown only after submission.
- Paged explanation navigation, stored result return, original wrong-answer record and successful correction retry worked. Existing data was not cleared.
- Synthetic browser QA records remain only in the local preview origin; no localStorage records are packaged or deployed. Production learning records were not read or changed.

---

# Video-control update verification — 2026-11-11

- Final suite: 37/37 Node tests passed, including all 26 previous learning/storage tests and 11 focused video-control tests. JavaScript syntax and `git diff --check` passed.
- Added large, separate **快退 5 秒 / 播放・暂停 / 快进 5 秒** controls below the video. At the end, the center button changes to **再看一次**. Native controls and full screen remain available.
- Real desktop Chromium and a 390 CSS-pixel same-origin iframe (375px inner content) verified actual unmuted playback, pause, exact ±5-second seeks while paused, start clamp at 0, end clamp at 69.273243 seconds, disabled boundary buttons and replay from the beginning.
- Narrow-layout buttons measured about 89.5 × 84.6px on the sides and 111.9 × 84.6px in the center, with no horizontal overflow. Desktop buttons measured about 96.8px tall. Play/pause icons use CSS shapes to avoid platform-dependent Unicode/emoji rendering.
- Enter activated the large play button; native video Space toggled playback and the external button label followed actual paused state. Visible state announcements do not repeat on every time update.
- Automated media tests also cover metadata loading, invalid duration, rejected play, pending-play cancellation, media/source errors, buffering, native events and disposal after route changes.
- Regression: a correct practice answer remained selected and solved after visiting the video and returning to mathematics. A synthetic preview-only record remains in the QA browser; no localStorage records are packaged or deployed, and no production learning records were changed.
- Actual physical iOS/Android hardware and screen-reader audio were not tested. This is desktop-browser responsive and accessibility-state QA, not real-device or assistive-technology certification.
- The temporary responsive QA page was excluded from the release. The video bytes, learning model/storage schema, privacy policy and owner-only Site audience were unchanged.

---

# Preview verification — 2026-11-11, expanded private preview

## Automated verification
- 26 Node tests passed on final model, storage and UI files. JavaScript syntax and `git diff --check` passed.
- Tests cover original guided practice, hints, grading, anonymous-profile separation, persistence, corrupt/unsupported storage recovery, assessment completion/restore, original mistake preservation, correction retries and profile clearing.
- There are no live model, speech-recognition, microphone, remote TTS or analytics calls. Voice dialogue controls are explicitly unavailable.

## Real browser verification
- Desktop Chromium and a 390 CSS-pixel iframe containing the same production page were used. The narrower content viewport measured 375 CSS pixels with no horizontal overflow.
- Math wrong answer was recorded with its original choice, persisted after reload and remained in profile A while profile B was empty. An explicit retry marked the original record corrected without replacing the original answer.
- An assessment retained in-progress choices across reload, required all four answers, scored 3/4 for the deliberately incorrect run, showed explanations only after submission and retained the result after reload.
- Parent summary showed actual practice, assessment and mistake counts. Completing the two-question practice persisted its completed summary.
- Profile B could hold an independent in-progress assessment. Cancelling a replacement preserved its selected answer. Cancelling clear kept its data; confirming clear reset B without changing A.
- Final synthetic A and B QA data were cleared using the application's confirmation flow. The parent page returned to honest empty-state counts. No QA answers are included in deployment assets.
- Video controls played the actual 69.27-second asset with `muted=false`, `readyState=4`, advancing playback time and visibly changing scenes. Pause worked. The same asset played in the narrow responsive iframe. No media error was reported.
- Desktop and narrow video, parent summary, question and assessment layouts were visually checked. Actual physical iOS/Android hardware was not tested; this is responsive browser QA, not real-phone acceptance.
- A temporary same-origin responsive QA harness was removed before packaging. Browser developer tools were not used to bypass any policy limitation.

## Video verification
- `ffprobe`: H.264, 1280 × 720, yuv420p, 24 fps; AAC, 44.1 kHz, mono; duration 69.273243 seconds.
- Full FFmpeg decode completed without errors. Audio has non-zero signal; source narration peak is -3.3 dB. Browser playback was unmuted, but this does not claim independent human listening acceptance.
- Nine scene review images and representative full-size frames were visually checked. Animated candy positions change between real frames; this is not a still image labeled as a video.
- Twelve candies are distributed round-robin among three children, four each; the explanation verifies 4 × 3 = 12. The ending prompts the learner to try 18 ÷ 3 without revealing its answer.
- Chinese captions are burned into the MP4 and also supplied as VTT. Clip boundaries follow measured narration duration; within-clip sentence timing is approximate.

## Boundaries
- Three sample assessment units are original examples, not verified Shanghai textbook units. Static answers are inspectable in source, so scores are not secure examinations or claims of mastery.
- Records are browser-local localStorage only. They are not a reliable cloud backup, do not sync across devices and can be lost when browser data is cleared. Simultaneous multi-tab updates are not synchronized.
- A/B profiles organize records and do not authenticate separate people. Anyone using the same browser can switch and view them.
- No real child information, names, ages, schools, photos, recorded voice or free-form questions were collected. Only synthetic QA choices were used.
- The original FastAPI/SQLite family application and its GitHub branch are unchanged; this Site is a separate static adapter.
