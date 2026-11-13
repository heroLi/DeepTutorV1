# Undeployed D1 daily-limit regression coverage — 2026-11-13

- Read the official September 1, 2026 D1 free-tier enforcement notice and current D1 error reference. Independent inspection found no new data-protection defect: generic database failures already stop processing safely. No production, client or schema logic was changed and no special quota-recovery behavior was added.
- Added 32 parameterized cases covering both row-read and row-write errors, in bare changelog and prefixed/extended forms. Cold-start readiness, profile authorization, reservation, settlement read/write, and status failure all sanitize to `LEDGER_UNAVAILABLE`; HTTP handlers return 503 without raw errors or invented quota snapshots.
- Pre-provider failures leave the ledger unchanged and make zero fake-provider calls. Settlement failures after a successful fake-provider reply preserve the full pending reservation and never return success. Restoring queries and rebuilding the runtime leaves same-ID replay at `IN_PROGRESS`, with no repeat provider call or refund. Status failure after completed settlement preserves the cached result and exactly-once full charge. The opt-in client does not automatically resend or mutate its action input.
- Full dependency-free suite: 380/380 passed, including all prior 348 cases. Targeted cases run against actual temporary SQLite persistence with injected official D1 errors and a fake provider. They do not exhaust a hosted Cloudflare allowance, prove geographic reachability, or measure any account's quota. No browser/device QA was needed because no shipped UI changed; API action-input preservation is not a claim about a future free-text draft UI.
- Work was isolated in a source-only copy. No Sites source synchronization, version save, deployment, access change, resource creation, real provider request or child-data access occurred. Integration guidance now explicitly excludes Sites deployment of this child-directed application and requires a separately authorized host and identity boundary.

---

# Undeployed client/provider response cleanup — 2026-11-13

## Reproduced defects and minimal repair
- Pure synthetic reproduction showed a cancelled client's late response was discarded but its body received zero cancellation calls. Early response-header rejection similarly omitted body cleanup. No result from that response reached another profile; this was a resource-cleanup defect, not a demonstrated ownership or budget bypass.
- An oversized provider stream whose underlying cancel promise never settled left `readLimitedJson` waiting in its `finally` block with the reader locked. The outer provider eventually timed out instead of immediately reporting the original size error.
- Each client operation now owns an idempotent non-waiting cleanup shared by its inner operation and outer cancellation race. Late/early-rejected unread bodies are closed; acquired readers are cancelled and released. An old operation cannot clear a newer operation's busy guard or cancel its response. Provider-body cleanup also no longer waits, and abort interrupts a suspended read while releasing its lock. Cancellation exceptions cannot replace the original result/error. No automatic retry, provider fallback, budget change or claim refund was introduced.

## Verification and limits
- 348/348 Node tests passed, including 17 new client cleanup and 6 new provider cleanup groups. Covered late cancellation/timeout/disposal/scope change, early header/redirect/length rejection, hanging/rejected/thrown cancellation, active read interruption, reader release, parser/success outcomes and subsequent-request isolation. Independent review, syntax and diff checks passed.
- The full actual local D1/workerd baseline (13 groups, 10 fake-provider calls) and all three interrupted-acknowledgment cases (29 fake-provider calls) passed again with the updated provider. Both retained zero Worker outbound attempts. Path-free evidence/source hashes were refreshed.
- A separate isolated local Miniflare/workerd probe imported the exact provider source and exercised oversized body, explicit abort and timeout while cancellation never settled. Results were respectively `RESPONSE_TOO_LARGE`, `CANCELLED`, `TIMEOUT`; each had one underlying cancel call and an unlocked body. Zero Worker outbound attempts. Its path-free three-case result is `docs/stream-cleanup-workerd-evidence.json`. This focused ephemeral probe is not an additional CI job or a deployed test endpoint.
- These client/server modules remain outside the shipped static assets. No UI, production endpoint, hosting resource, owner-private sharing, learner history, real provider call, credential or fee was changed. The Site remains version 12. Browser/device QA was not rerun for this source-only fix; real provider cancellation, cloud ingress and billing behavior remain unverified and must not be inferred from these tests.

---

# Undeployed API interrupted-acknowledgment reliability — 2026-11-13

- 325/325 dependency-free Node tests passed: all 317 prior tests plus 8 development-only fault-injector groups. These cover default pass-through, exact ordered SQL targeting, one-shot before/after injection, concurrent matching batches and unchanged native exceptions. Syntax and diff checks passed.
- The existing genuine local D1/workerd 13-group baseline passed again against current source: 10 fake-provider service-binding calls, zero Worker outbound attempts. Its path-free evidence was refreshed with current exact source hashes.
- The new optional recovery harness passed three runs, including an independent repeat. It applied the unchanged schema with the official local Wrangler CLI into three separate uniquely owned temporary states, each using synthetic identity and a 1000 TEST-unit scope. No cloud resource or credential was used.
- Reservation committed / lost acknowledgment: initial HTTP 503, zero provider calls, 100 reserved; restart replay 409 `IN_PROGRESS`, reservation unchanged. Settlement rejected before submission: initial HTTP 503 after one fake-provider call, 100 reserved; restart replay 409 with no repeat provider call. Settlement committed / lost acknowledgment: initial HTTP 503 after one fake-provider call, 100 spent; restart replay 200 with the cached authored answer, no duplicate charge or call.
- In all three cases, same-ID changed fingerprints returned 409, status reads left rows unchanged, and exactly nine additional 100-unit attempts fit the remaining 900. Pending cases retained the original reservation even after later calls settled. Across the recovery cases there were 29 local fake-provider calls and zero Worker outbound attempts. This is conservative TEST bookkeeping, not actual spending.
- Faults are injected at explicit D1 batch boundaries and followed by actual orderly workerd disposal/restart. This is not a hard process crash, network partition, hosted D1 or production identity certification. There is no refund, automatic claim release, unfreeze, new approval or HTTP administrator route. The unresolved production gates remain in the integration documentation.
- Only development harness, tests and documentation changed. Static browser assets, hosting manifest, server/runtime logic, media and local learner records are unchanged. No new Site version or deployment is necessary for these source-only verification changes; the current private preview remains version 12. No browser verification was rerun because no shipped UI changed.

---

# Date-window parent summary verification — 2026-11-13

## Scope and final checks
- 317/317 Node tests passed: 11 new pure projection groups, 5 markup groups and 7 application integration groups, plus all existing tests. Independent review, JavaScript syntax and `git diff --check` passed.
- Adds a read-only current-profile parent summary for the last 7 or 30 device-local calendar days (inclusive), or all dates through today. Uses calendar arithmetic rather than elapsed 24-hour blocks, with year/month/leap-day and America/Los_Angeles spring/fall DST checks.
- Completed foundation groups, submitted assessments, completed small-step practice/review runs and individual answer/guide events use their own timestamps. `activeTest` is not counted twice alongside its submitted assessment copy. Practice/review first answers, assisted retries, transfer answers and guide steps remain distinct. No incomplete base answer is assigned a fabricated timestamp, and no duration, streak or mastery is inferred.
- Base/assessment error counts use original dates. A record with at least one successful retry within the range contributes one corrected record, even after repeated correct retries; it may predate the period. Later corrections never rewrite original history. Future and invalid event dates are excluded and reported without changing the stored record.
- Filters and manual refresh replace only the summary region. Tests verified a pending backup file read can finish and restore normally after either operation; the backup panel is not disposed or reset. This was automated with a synthetic reader, not another browser file-selection test. Invalid or wrong-route controls do nothing; profile changes, route exit, clear, successful restore and reload reset the period to 7 days. Existing storage conflicts block interactions, and protected malformed storage remains untouched.

## Browser acceptance
- The actual application HTML/modules ran in Chromium against a clearly labeled, isolated synthetic storage backend. It did not read or write native localStorage. A profile held foundation completions dated today, 10 days ago and 40 days ago; the view correctly showed 1, 2 and 3 for 7-day, 30-day and all ranges. The 3/4 submitted assessment was not duplicated by its active-test copy.
- A small-step first error 10 days ago was absent from the 7-day stage count but included in the 30-day count. Today's guided retry, transfer error and two guide choices remained separately visible. An older original error with two correct retries today counted once as a period-corrected record. A tomorrow-dated error produced an explicit exclusion notice. All-range still excluded future events.
- Range changes and repeated refresh left the backend write counter at zero and its initial raw string unchanged. Switching to empty profile B showed actual zeros and default 7 days; switching back preserved A. The two profile-switch writes were expected existing behavior, and switching back returned the raw string to its original value.
- With a deliberately invalid optional loop state, the app kept usable base history, showed protection warnings, disabled restore and let the parent view ranges without writes. Navigating away and back reset the period while the original malformed string stayed unchanged. No recovery download, file chooser or production storage was touched in this release's browser checks.
- 390×844, 768×1024, 1024×768 and 1366×768 same-origin iframe viewports had equal client/scroll widths of 375, 753, 1009 and 1351 CSS pixels. All four period/refresh buttons measured at least 52px tall; the phone layout used two columns. Parent history intentionally scrolls vertically; the existing one-screen-priority learning layouts were unchanged. These are responsive Chromium checks, not physical phone/iPad, Safari, touch-hardware or screen-reader certification.
- The ordinary local-preview tab retained its previous synthetic B notebook: ten original errors, six pending, one corrected and three small-step errors. Its new parent view showed the matching counts and separate phases. Enter activated the 30-day control and moved focus to the live status text. No app-origin error was observed; unrelated browser-extension metadata errors were excluded.
- Temporary fixture files were removed before packaging. There are no new dependencies, storage-schema changes, real child records, credentials, model calls, microphone/recording access, external uploads, cloud resources, fees or sharing changes. Media and the undeployed API adapter are unchanged.

---

# Protected invalid-storage recovery verification — 2026-11-13

## Defect and repair
- Isolated synthetic reproduction confirmed the old loader could report malformed stored data as a blank temporary profile while the storage coordinator still permitted a later write. That later write replaced the original invalid string. No real learner records were used or altered in diagnosis.
- The loader now reports structured status for empty, valid, unreadable, malformed JSON/schema, unknown version and partially invalid loop data. The coordinator classifies its single captured snapshot during construction, before any public write can run. Any non-null invalid/partly discarded snapshot makes that page memory-only for its whole lifetime. Empty-string storage is not treated as an absent key.
- Independently valid profiles or base records can be inspected and exported from memory, but the sanitized copy never overwrites the original. An external repair/read-access recovery does not re-enable the old page's writes; a fresh load must capture the repaired baseline.
- A separately labeled, explicit recovery export wraps the exact captured original string as JSON, preserving escaped content, NUL and unpaired surrogate code units. Both original and serialized output are limited to 16 MiB without truncation. The wrapper is rejected by normal profile import. Nothing renders the raw string or automatically downloads, uploads, deletes or resets it.
- Temporary-mode restore is blocked in the chooser and controller choose/late-read/confirm paths. Existing standard export remains available for usable records. Clear confirmation explicitly describes only the current page's temporary memory; completion no longer claims a durable save in this mode.

## Final automated verification
- 294/294 tests passed, including 11 new recovery/model groups and 7 app/controller groups. Independent review, syntax checks and `git diff --check` passed.
- Covered malformed JSON, empty strings, unknown versions, invalid nested schema, independently valid other-profile recovery, partial loop data, direct writes before load, practice/profile/clear/loop/restore attempts, unreadable startup, external repair, detached snapshot loads, bounded export and exact original-string preservation. Existing cross-page conflict tests remain green; this is still best-effort detection rather than an atomic lock.
- Added an end-to-end model round trip for usable A/B data from both a partial loop and a damaged-profile snapshot: normal export, strict parse, restore into an independent empty store, persist, and valid reload. The protected source remained byte-for-string identical with zero writes.

## Browser acceptance and limits
- A clearly labeled temporary Chromium fixture loaded the actual final application HTML/modules against an isolated in-memory synthetic storage object. It never read or overwrote native browser storage. Visible counters showed zero application writes and unchanged original strings after temporary practice, profile switching and confirmed temporary clear.
- Malformed JSON and unknown-version cases displayed specific protection messages, disabled file restore even on empty profiles, and exposed the separately labeled original-copy action. A partial-loop case preserved its usable original math record while leaving the complete original string unchanged.
- Simulated an independent external repair, then switched profiles in the old page: zero writes and restore remained disabled. Only a fresh application load read the valid repaired record; switching to its empty B profile then wrote normally and enabled the ordinary file chooser. This was a synthetic-backend browser test, not a new native cross-tab event test.
- The original-copy download was clicked once. The application reported that download had been initiated, but the browser download-event wait timed out and its internal download-list page was unavailable to the browser tool. No repeat download or alternate security-bypass route was attempted. Browser disk completion was therefore not confirmed. Exact export content, no automatic download and failure handling were verified by automated tests; the UI correctly asks parents to confirm their download themselves.
- The 390×844 iframe had equal 375px client/scroll width and a 54px recovery-export button; the warning, separate export controls and disabled restore remained readable. Desktop layout was also inspected. These checks do not establish physical-phone/iPad, Safari or screen-reader acceptance.
- After closing the isolated fixture, reloaded the ordinary local preview: the earlier synthetic B history still showed ten records, six pending, one corrected and three loop errors, without a temporary-storage warning. No application-origin console errors were observed. Temporary fixture files were removed before packaging and the preview server was stopped.
- No real child data, microphone/recording, file upload, cloud database, real API call, credential, new dependency, paid resource or sharing change was involved. A recovery wrapper is an inspection aid, not automatic migration or a guarantee that damaged history can be repaired. Browser-local records remain neither cross-device sync nor reliable cloud backup.

---

# Filtered, paginated wrong notebook verification — 2026-11-13

## Final checks
- 276/276 Node tests passed, including 12 new pure-projection and 6 new app/UI groups. Independent review, JavaScript syntax checks and `git diff --check` passed.
- The notebook is a read-only projection until the existing explicit correction action. It changes no storage schema or backup format, makes no network requests and retains the storage coordinator's checks. Media, backend files, hosting configuration and owner-private audience are unchanged.
- Tests cover all subject/type filter combinations, repeated mistakes, deterministic chronological ordering, missing/invalid projection fields, inherited-key filters, fixed six-record pages, out-of-range inputs, correction page clamp, detached/frozen inputs, escaped text/IDs, A/B separation, route/profile/clear/restore resets and conflict blocking. Loop first/retry/transfer/review evidence uses its own original question and never acquires a fabricated correction status.

## Real browser acceptance
- Using ordinary supported Chromium controls, created synthetic records only in the local preview's profile B: a four-error English assessment, a Chinese loop with separate incorrect first/retry/transfer choices and two additional repeated math `I do not know` attempts. Existing profile A was left unchanged. No records or fixtures are included in deployment assets.
- Ten mixed records displayed as six then four, newest first. Pending-only filtering gave seven then one. Corrected the final pending item from original math choice 3 to 4; returning retained the filter, clamped to page 1/1 with six pending items and kept all ten original records. Corrected-only showed the original choice and separate correction date. Reload retained the correction but reset temporary filters.
- English plus corrected-only produced an honest zero-match state rather than a global no-history claim. Switching to A reset filters and showed its one unchanged original math error; returning to B and reloading retained B's ten records. Chinese plus loop-only showed three separate stages with their own choice-specific reasons and no correction button.
- A temporary same-origin iframe tested 390×844, 768×1024, 1024×768 and 1366×768 layouts. All had equal document client/scroll widths (375, 753, 1009 and 1351 CSS pixels respectively, after scrollbars), without horizontal overflow. New filter and pagination controls measured at least 52px tall. The phone layout used two-column filters, and actual filter/next-page actions worked. Record browsing intentionally scrolls vertically; the existing one-screen question/answer workspace is unchanged.
- Pagination/correction returns focused the visible live summary; button pressed/disabled states matched the selected filter and boundaries. This is state/keyboard-focus verification, not a screen-reader certification.
- Video regression: actual unmuted MP4 playback advanced to 21.359311 seconds, paused via the large button, with readyState 4, no media error and duration 69.273243 seconds. Returning to the notebook reset its transient filters without altering its counts.
- Recent browser error logs contained no application-origin errors. The temporary iframe page was removed before packaging. The preview server was stopped after QA. No physical phone/iPad, Safari, touch-hardware or spoken-output testing is claimed.

## Boundaries
- No real child data, microphone access, file selection/upload, provider request, new dependency or paid resource was used in this change. Hosted records remain browser-local, not cloud-synchronized or a reliable cloud backup. Same-browser profiles are not authenticated identities.
- Small-step errors are historical evidence, not an assertion that the learner still cannot answer. Static questions and repeat exposures do not establish mastery. This is still a finite authored preview, not textbook alignment or live DeepSeek tutoring.

---

# Multi-tab conflict protection and backup browser acceptance — 2026-11-13

- Final suite: 258/258 Node tests passed, including 13 new storage-coordinator and 13 new application conflict groups. Independent model/UI review, JavaScript syntax and whitespace checks passed. No storage schema, backup version, backend, dependency or hosting configuration changed.
- Initial parsing and the saved-record baseline come from one captured snapshot. Every ordinary application mutation/route is checked, and every persistent write uses the guarded facade. Successful writes alone advance the exact baseline; a detected external change or later read failure makes that page permanently blocked until reload. Native storage events are filtered by storage area/key and re-read the actual current value instead of trusting possibly late event payloads.
- Initial unreadability remains a distinct temporary-learning mode: the page can continue in memory but never silently resumes persistent writes when storage becomes readable. The UI consistently explains this, including after repeated failed saves. Quota-failed saves retain the previous baseline and the original unsaved warning behavior.
- A fixed, accessible conflict dialog stops video/voice, cancels in-progress local file reading and prevents stale confirmations/routes from writing. Explicit A/B rescue downloads use only that page's in-memory profiles, warn that other-page changes are absent and state only that download was initiated. Only a separate user click reloads latest records. Cleanup errors or unavailable native modal support retain the write guard and a visible fallback.
- Real desktop Chromium with two ordinary pages: page A played the existing MP4; a profile switch in page B triggered A's conflict dialog, focused its heading and paused video at 15.890196s. Escape did not dismiss the protection. A real rescue download contained the expected synthetic A profile: one completed practice and one original wrong record. Page B then saved a new correct answer; explicitly reloading A read B's current profile and preserved that answer. No hidden storage injection or forced UI bypass was used.
- Completed the earlier missing valid-backup browser acceptance: exactly one first valid-file selection, source/count preview, explicit restore to empty B, success focus/status, full reload persistence and A unchanged. B then had one completed practice, one wrong and three attempts; both nonempty profiles disabled repeat restore. The already executed malformed-file selection was not repeated. The short-lived B record made for the two-page test was cleaned through the application's confirmation before this restore; all records were authored synthetic QA, not production learners.
- A same-origin layout fixture exercised the actual conflict dialog at 390 x 844, 768 x 1024, 1024 x 768 and 1366 x 768. No horizontal overflow; phone rescue/reload controls were 54 CSS pixels high. The phone dialog measured 341 x 794.375 CSS pixels inside its 390 x 844 viewport; larger dialog layouts were 620 x 644.75. Actual desktop modal presentation and focus were inspected. Not physical-device, Safari or assistive-technology certification.
- Check/read followed by setItem is not a cross-tab atomic transaction: simultaneous writers may still race before either observes a change. This does not provide cloud sync, a security boundary or guaranteed elimination of concurrent lost updates. Keep one learning page open and explicitly preserve any needed in-memory backup before reloading.
- The temporary layout page and downloaded QA JSON files are excluded from source/deployment. No app-origin console error was observed in the inspected recent logs. No real child data, microphone, provider call, fee, main-branch write or sharing change.

---

# Local voice interruption and dialogue clearing — 2026-11-13

- Final suite: 232/232 Node tests, including 21 local-voice and 8 dialogue groups, passed. Independent final review and syntax/whitespace checks passed. No new dependency or network transport was added.
- Added an explicit clear-current-dialogue control. It stops voice, removes only transient messages/draft, disables reading the old answer and returns focus to the input. Repeated clear and a fresh conversation work; learning records are untouched. Escape stops active voice without erasing text and is advertised with aria-keyshortcuts.
- Local recognition availability has a five-second application wait limit. Reprobe, document hiding and disposal cancel the application wait, clear timers and ignore late resolutions/rejections. This does not claim the browser exposes cancellation of its underlying availability operation. No cloud recognizer or language-pack installation fallback exists.
- Hidden-document handling aborts active recognition and cancels synthesis, blocks new hidden starts and never automatically restarts on visibility return. The existing explicit-click and 20-second recognition limits remain. A synchronous callback reentry found by independent review was fixed before release: teardown/notification cannot launch new work, and disposed/hidden state is rechecked before a native start. Regression evidence confirms starts=0, not start-then-abort.
- Real desktop Chromium exercised authored local dialogue, draft+message clearing, repeated clear, new dialogue, question switching, keyboard Enter and focus restoration. Profile A's prior synthetic practice/wrong counts stayed intact and B stayed empty. The real browser did not provide confirmed local Chinese recognition or a local Chinese voice, so production controls correctly stayed disabled; no actual microphone permission was requested.
- A temporary, clearly labeled browser fixture supplied synthetic recognition/synthesis objects to the production modules. It verified transcript review without auto-submit, Escape preserving text, clear stopping simulated reading and the actual 20-second UI timeout. This did not capture audio or produce speech. The cloud-browser tabs remained visible to the document API, so actual background-event/device behavior was not verified there; hidden-state handling is covered by deterministic simulated document events.
- Desktop 1180 x 757 and same-origin iframe layouts 1366 x 768, 1024 x 768 and 768 x 1024 retained a one-screen document with composer/actions inside. At 390 x 844 the intentional stacked page had no horizontal overflow and its clear control was 52 CSS pixels high (44 on desktop/tablet). This is not physical iPad/phone, Safari, microphone, audible TTS or assistive-technology certification.
- Temporary QA pages were removed before packaging. At that checkpoint no file chooser/import was attempted; the valid-backup browser path was subsequently completed in the multi-tab checkpoint above. No learner data, secret, real provider request, fee, hosting migration, main-branch change or sharing change.

---

# Parent-managed local backup verification — 2026-11-13

- Final ordinary suite: 216/216 Node tests passed, including 13 backup-model, 12 controller/UI and 5 timezone groups. Independent final source review found no security or record-integrity blockers; JavaScript syntax and whitespace checks passed.
- A strict versioned JSON parser rejects duplicate/unknown/dangerous keys, unsupported shapes, oversized/deep/excessive structures and semantically inconsistent practice, test, wrong-answer and learning-loop records. The 2 MiB limit rejects rather than truncates. Parsed backups are immutable; restore clones into an empty profile only and preserves the other profile and input objects.
- The UI previews profile/time/counts and requires explicit confirmation. It rechecks empty target and the last observed saved store, writes successfully before replacing in-memory state, and rejects stale other-page changes. Cancel, route/profile changes, read timeout/late completion, duplicate confirm, storage failures, object-URL cleanup and download errors have regressions. This check is not an atomic cross-tab lock or cloud synchronization.
- Corrected a pre-existing timezone bug: a historical review's early flag must not be recomputed in the restoring device's timezone. Shanghai/Los Angeles round-trips retain entire stores; invalid types and incompatible practice/review shapes remain rejected. This preserves a historical snapshot, not a claim of record authenticity.
- Real desktop Chromium QA completed a synthetic two-question math practice, recorded one wrong attempt, downloaded an actual profile-A JSON and parsed its exact completed/wrong counts. The nonempty A profile disallowed restore, empty B stayed separate, and an invalid local JSON was rejected without changing B. The UI only states that download was initiated, not that the user saved it.
- At that checkpoint the next valid-file chooser operation was awaiting approval. Model/controller tests covered preview/cancel/restore/reload, but actual chooser acceptance was not yet complete. It was subsequently completed in the multi-tab checkpoint above, without repeating the earlier invalid-file operation or using an alternate upload route.
- The real desktop question/video workspace remained one screen at 1180 x 757; playback, pause and +/-5 second controls worked on the existing 69.273243-second MP4. New backup-panel layouts were inspected at 390 x 844, 768 x 1024, 1024 x 768 and 1366 x 768 using a temporary same-origin iframe; no horizontal overflow. Phone download and file controls were 54 and 62 CSS pixels high. This is responsive desktop-browser testing, not physical-device/Safari/assistive-technology acceptance.
- Temporary layout fixtures and synthetic downloaded records are excluded from source and deployment. QA used only fabricated choices on the local preview origin; no production learning records were read or changed. Browser logs showed extension metadata errors, not an observed application error.
- This is manual, browser-local backup, not secure parent authentication, reliable cloud storage or automatic sync. No real model call, fee, microphone/recording upload, secret lookup, hosting migration or sharing change.

---

# Actual local D1/workerd verification — 2026-11-13

- 186/186 ordinary Node tests passed after the Worker transport fix and optional-harness release guard. Independent provider review passed, including a rejected response whose body cancellation never settles.
- Fixed a real workerd incompatibility: provider transport now uses manual redirects, accepts only the fixed endpoint's unredirected 200, never follows Location, and cancels rejected or late bodies without blocking. Browser-client redirect policy remains unchanged.
- The portable optional dev/d1-readiness harness was executed from this checkout against the official installed Miniflare/Wrangler toolchain. Original schema applied with official --local CLI (12 commands); 13 protocol/persistence groups passed using the genuine local D1 binding, not our Node SQLite-shaped helper.
- Actual D1 covered operator-only initialization, non-mutating status, owner/profile authorization, refusal/cache of 302, correct finite dialogue, idempotency, two-way pending concurrency, rollback of an earlier batch insert after a trigger failure, restart persistence, total budget, freeze and cold-frozen diagnostics.
- The provider core SHA is 847d3f4a3a6431a4427cfcd1ff0dd7f691062657687d5d2e8c815f37a96318cb. No error-to-manual compatibility wrapper remains: the fixture forwards its URL/init unchanged into a named local service binding. Ten fake-provider calls, zero external outbound attempts.
- The CLI child uses private HOME/XDG/TMP and a minimal explicit environment; no inherited cloud credentials/proxies, metrics or metadata fetch. Only an owned temporary database is created/removed. Hard termination may leave synthetic temporary state; logs/evidence are ignored and the committed summary has no machine paths.
- Ordinary npm test does not run this optional workerd suite or install its dependencies. The exact local tool versions, commands, restrictions and reviewed result are in dev/d1-readiness/README.md and docs/d1-workerd-evidence.json.
- This is not production Sites ingress, cloud D1 provisioning, billing approval, distributed deployment, physical-device playback or real model verification. The private static Site remains v6, with unchanged manifest, media and sharing; no real child data, key or model spending.

---

# Local Worker/media migration verification — 2026-11-13

- 183/183 Node tests passed, including 5 portable media groups. Existing frontend, API, client, ledger and real-loopback tests remain green. Syntax and whitespace checks passed.
- An independent official Vinext starter installation/build produced a Worker plus static assets with no Site identity or D1/R2 resources. All 13 original assets matched their hashes; the original MP4 remains unchanged.
- Default local workerd asset responses ignored Range. An authored, exact-MP4 adapter using a declared binding and selective Worker-first route corrected this in the isolated build. Final protocol evidence contains 27 passing records plus disabled API assertions, with zero outbound attempts during the protocol run.
- Verified GET/HEAD, range slices/lengths, 416, If-Range, 304, exact routing and 404s. Added portable edge cases cover one-byte/open-ended/clamped/suffix ranges, private/no-store responses, bounds, corrupt/error assets, cancellation, timeout and late-source cancellation without reading late data.
- The module and tests were copied into source without the starter, generated output, duplicate media, new dependencies or real credentials. The module is not imported by the shipped static UI and has not been deployed.
- No browser/device playback, hosted ingress, cloud storage or real model call was verified. Traffic/concurrency and actual platform binding/access behavior remain future deployment gates. See docs/WORKER_MIGRATION.md for exact scope and tool versions.
- The private Site stays v6; its manifest, audience and published assets are unchanged. No cloud resources or API spending were created.

---

# Real loopback HTTP fixture verification — 2026-11-13

- 178/178 Node tests passed, including 7 real loopback HTTP tests. Source/test syntax and whitespace checks passed. No extra dependencies, frontend changes, migrations or cloud deployment.
- `npm run demo:api` was started and its actual status route returned 200, offline-test, TEST. Its origin is only usable on the machine running it. The development entry is a synthetic identity fixture, not production authentication.
- The actual tutor client crosses a real local HTTP connection into the runtime, real temporary SQLite and a fake provider. The test bridge adds Node's missing browser metadata only after checking the client does not manufacture Origin/Fetch Metadata itself. Status, answer, same-ID cache and booked quota were verified.
- Duplicate/in-flight HTTP overlap returns 409/429 as expected; two admitted calls finish with exactly two conservative charges. Ten unique attempts exhaust the fixture budget; duplicates do not call the provider again.
- Host/Origin checks, forbidden bind/live/path options, fake identity-header override, personal-data-shaped extra fields, overlong/slow/late bodies, abort charging and malformed raw HTTP were exercised. Stream errors produce bounded failures instead of leaving sockets/readers hung.
- The server binds only 127.0.0.1, has no real provider/credential configuration route, and removes only its own unique temporary directory on normal shutdown. Hard-kill leftovers are documented; no arbitrary existing path is deleted. No tunnel or public listener was created.
- Independent read-only review covered the implementation and HTTP boundary; the overlap regression uses an explicit internal-fake completion gate rather than a timing window; shutdown waits for admitted handlers. This is not physical-device, browser-hosted API, Cloudflare D1 or real DeepSeek acceptance.
- The hosted private Site remains version 6 with local dialogue. No secret lookup, cloud resource charge, actual child information or sharing change occurred.

---

# Source-only API client verification — 2026-11-13

- 171/171 Node tests passed, including 12 client/SQLite integration cases and 3 release-boundary checks. Independent review, syntax and whitespace checks passed. No shipped frontend or hosting change.
- All 36 fixed question/intent outputs match the frontend/server canonical fixtures. Explicit expected-mode validation prevents silently accepting mock output as DeepSeek. Disabled clients make no request and status never enables them automatically.
- The real SQLite + fake provider bridge verifies read-only status, conservative charging, duplicate caching, budget/owner/profile rejection and cold-start stop diagnostics. It simulates browser same-origin metadata and trusted ingress; no real HTTP/browser/platform connectivity is implied.
- Input extras/accessors, arbitrary text/audio/history and URL/key overrides are rejected. Only fixed relative endpoints and same-origin credentials are used; no client-supplied Origin, identity header, provider credential or direct provider URL is sent.
- BUSY preserves an existing request; explicit cancel/scope change/dispose rejects late results. Total timeout includes stalled headers/body and uncooperative abort. Cancellation does not undo persisted server work or promise a refund.
- Review caught an in-flight mutable-input correlation issue; immutable request ID/intent snapshots now protect request bodies, expected replies and returned context. Self-consistent status values above server 1e12 bounds are rejected.
- JSON/UTF-8/envelope/mode/answer/byte-limit errors fail closed, with no automatic retry or local-model fallback. Client-side correlation is not represented as authenticated server echo.
- `.gitignore` now excludes common local secret and database artifacts. Three regression checks guard static/server source boundaries and schema-only migrations. They detect selected obvious patterns, not every possible secret.
- No child text/recording, real credential, paid model call, D1 provisioning or sharing change. Client source is deliberately outside `dist`; the hosted Site remains its existing local simulation.

---

# Read-only API status verification — 2026-11-13

- 156/156 Node tests passed, including 9 ledger-status and 12 HTTP-status cases. All source/test JavaScript syntax and whitespace checks passed. Frontend, media, migration and hosting configuration are unchanged.
- A single SQLite SELECT snapshot returns only owner-authorized bounded quota/status fields. Repeated inspection leaves profiles, scopes and claims byte-for-byte unchanged and invokes no provider. Unknown scope and another owner receive the same safe rejection.
- TEST/CNY units and conservative accounting labels are explicit. Counts and stop reasons match the real reservation guards for budget, in-flight requests, rolling limits, frozen/expired scopes and invalid clocks. No claim/token, owner ID, credential or raw SQL appears in the response.
- Integrated fake-provider POST still works; subsequent GET shows committed conservative spend and budget exhaustion without another call. Async rejected, false/undefined, invalid or excessive readiness bounds cannot authorize requests.
- Independent review reproduced two gaps, both fixed and covered: ordinary browser same-origin GET without Origin now uses same-origin fetch metadata plus the custom header; frozen/expired/clock-invalid/price-expired cold starts retain authenticated read-only diagnostics while POST remains stopped. Wrong/absent Origin and metadata are not broadly accepted.
- Diagnostic instances require explicit reconstruction rather than silently resuming. Missing auth boundary, schema, credentials, approval and mismatched scope/currency/cap are not relaxed by the diagnostics path.
- These are local SQL/runtime contract tests, not a real browser-to-hosted-API, Cloudflare D1 or DeepSeek connectivity acceptance. No cloud resources, fees, real child data, keys or sharing changes were introduced. The public-source development branch is updated separately; hosted preview remains version 6.

---

# Persistent backend and identity-adapter verification — 2026-11-13

- 135/135 Node tests passed: 13 new persistent-ledger tests and 7 runtime/auth/body tests, plus the full prior suite. Syntax and whitespace checks passed. No new runtime dependency was installed; tests use built-in SQLite (Node 22.13+).
- Temporary SQLite files execute the real schema and D1-compatible SQL adapter. Two worker threads with independent database connections and a start barrier compete for the final available reservation and the same request ID. Exactly one claim wins; duplicate settlement charges once.
- Closing/reopening the database retains pending claims, cached success/error, spent/reserved balances, frozen scopes and limits. Lost responses after committed reservation or settlement do not create a free retry. No claim timeout or scope expiry refunds uncertain costs.
- Write-time guards reject another owner/profile, disabled profiles, changed fingerprints/currency/cap, scope reuse, invalid periods, low budget, too many in-flight calls, rolling-rate excess and clock rollback. Admin helpers are not exposed as HTTP routes.
- The composed runtime was tested with real SQLite, synthetic identity admission, synthetic CNY approval/pricing and an injected fake provider along the live code path. It consumed its reservation persistently, replayed without another call after restart and blocked the next request above budget. This was NOT a real DeepSeek call. Mock/TEST mismatch, expired scopes, missing credentials/approval/transport and arbitrary child-text/audio fields were rejected.
- Authentication rejects unadmitted/header-forged requests before reading the body or using the ledger. Only an explicitly trusted Sites ingress may supply the stable user ID; email/name are ignored, and bypass access does not become user identity. The real platform ingress has not been wired or verified.
- Incoming reads are limited to 1 KiB and a deadline; malformed UTF-8/JSON, oversize, aborted or hanging streams fail closed. Even hanging cancellation and late body data cannot reach a reservation or provider call.
- Independent read-only review found no blocking HTTP-exploitable defect; the suggested SQLite+CNY full-runtime regression was added and passed.
- No frontend/media or sharing changes. Browser layout QA was not repeated because shipped assets are unchanged; all prior UI/media model tests passed. The hosted Site remains version 6 with local simulated dialogue, not this backend.
- No production migration, D1 provisioning, real identity record, credential lookup, paid call or actual child data was used. Genuine D1 transactions and Sites dispatch boundaries still require hosted staging acceptance before enabling live mode.

---

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
