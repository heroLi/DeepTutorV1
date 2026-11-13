# Optional genuine local D1/workerd verification

The baseline harness uses these four authored development-only files in `dev/d1-readiness/`:

- `verify.mjs`
- `worker.mjs`
- `wrangler.local.json`
- this README

Do not copy the starter, node_modules, duplicate server code, video, persistence directories, cloud IDs or credentials. Checked evidence may be retained separately.

## Dependencies and invocation

The application's root package remains dependency-free. This harness is **not** included in ordinary `npm test`, and does not install dependencies itself. It requires Node with the project's supported Web APIs and a separately installed official Sites/Vinext toolchain containing exactly Miniflare `4.20260515.0` and Wrangler `4.92.0`. Those versions are checked at startup. The tested official starter lockfile SHA-256 is `eedaeab6870c0f70f9db869fcaa24abae9b0f945cbc9acb8a43b6e7ed6bcbfca`. Prepare/install that toolchain through the official Sites setup/install workflow; do not assume four source files bundle an emulator.

```sh
node dev/d1-readiness/verify.mjs \
  --source /absolute/path/to/learning-repository \
  --toolchain /absolute/path/to/official-installed-vinext-starter
```

Both arguments are local paths. There is no remote option, URL override or custom cleanup path. The runner reads the chosen repository's actual `server/*.js`, `server/migrations/0001_tutor.sql` and `dist/loop-model.js` without editing them. It supplies those bytes as explicit virtual Worker modules, preserving relative imports; `worker.mjs` is a fixture entry, not a production entrypoint or directly executable server.

## Local storage and identity boundary

The runner creates a uniquely owned temporary directory, applies schema with the official `wrangler d1 execute DB --local --file ... --persist-to ...` command, and deletes only that exact directory. It never runs `--remote`. The CLI child receives a minimal explicit environment: private HOME/XDG/TMP locations, PATH, CI, disabled Wrangler metrics and disabled Cloudflare metadata lookup. It does not inherit cloud credentials or proxy configuration. The emulator identifier `local-only-xiaobu-d1` is not a registered database or platform ID.

Miniflare/workerd provides the genuine local D1 binding. No custom Node SQLite-shaped binding is used. The existing operator-only server API initializes synthetic owner/profile A/B and a TEST-only scope outside HTTP. The fixture's fixed synthetic identity and request attestation are **not production Sites authentication**.

Provider requests go through an explicit local service binding, never global fetch. The bridge passes the core's URL/init unchanged and asserts `redirect:manual`; an official-looking URL string is just the service-binding Request URL and does not make an external request. External outbound attempts throw and must remain zero. No real model, child text, microphone data, API key or cloud resource is used.

## Core compatibility requirement

The probe found that workerd rejects `redirect:error`. The verified reviewed provider-core revision now uses `manual`, rejects non-200/redirected/final-URL-mismatched responses, and cancels refused/late bodies. The harness does not hide this difference with a redirect conversion wrapper. Evidence records the exact core file hash; the tested revision is `966ddf3e66b858716323ff3e0e1756c665907992de9d08bd76aaa754170b509c`.

## Verified assertions

The final candidate was actually executed against the selected source checkout and official installed toolchain, with 13 verification groups passing:

1. Official local migration executes all 12 schema commands without splitting or altering SQL.
2. Real D1 operator initialization.
3. Status leaves domain table snapshots unchanged.
4. Scope owner isolation.
5. Synthetic 302 is never followed; cached failure does not retry.
6. Correct dialogue, persisted conservative charge and idempotent replay.
7. Separate synthetic A/B profile authorization.
8. Two pending requests fill the in-flight cap; third is 429, duplicate pending ID is 409, with no extra provider call.
9. Actual D1 batch rolls back an earlier insert when a later immutable-scope trigger aborts.
10. Workerd restart retains spent balance and cached result.
11. Ten 100-unit attempts exhaust the 1000-unit TEST budget.
12. Freeze stops attempts without another provider call.
13. Cold frozen runtime still exposes authenticated read-only diagnostics.

Ten fake-provider calls, including the refused 302, and zero external attempts were recorded. The harness writes `evidence/results.json` (source hashes, versions, checks) and `evidence/migration.log`. These are local D1/workerd proofs, not production provisioning, billing, Sites ingress, browser playback, real provider testing or distributed-service guarantees.

Normal completion cleans the owned temporary state. A hard kill or watchdog termination can leave that synthetic temporary directory behind; the next run creates a fresh independent fixture and does not delete arbitrary older paths. Generated evidence/logs are ignored by Git; only an explicitly reviewed, path-free result summary should be copied into source documentation.


## Interrupted acknowledgments and restart verification

The separate recovery harness adds `fault-binding.mjs`, `recovery-worker.mjs` and `verify-recovery.mjs`. Run it with the same already-installed, version-checked official toolchain:

```sh
node dev/d1-readiness/verify-recovery.mjs \
  --source /absolute/path/to/learning-repository \
  --toolchain /absolute/path/to/official-installed-vinext-starter
```

This is a development fixture, not a production entrypoint or recovery endpoint. The fixed synthetic identity must never be deployed. Each of three cases creates its own local D1 database state, migrates the unchanged schema with `--local`, and provisions only a 1000 TEST-unit scope. A host-only binding selects a one-shot fault; URL, headers and request body cannot choose or activate it. The default binding injects nothing. The wrapper matches both exact SQL statements in order and forwards actual native statements/results without fabricating commits or rewriting production SQL.

| Injected boundary | First HTTP result | Before restart | Same request after actual workerd restart |
| --- | --- | --- | --- |
| Reservation batch succeeded; acknowledgment lost | 503 `LEDGER_UNAVAILABLE` | 0 provider calls, 100 reserved, 0 spent | 409 `IN_PROGRESS`, no provider call, reservation retained |
| Settlement batch fails before submission | 503 `LEDGER_UNAVAILABLE` | 1 fake-provider call, 100 reserved, 0 spent | 409 `IN_PROGRESS`, no second provider call, reservation retained |
| Settlement batch succeeded; acknowledgment lost | 503 `LEDGER_UNAVAILABLE` | 1 fake-provider call, 0 reserved, 100 spent | 200 cached authored answer, no second call or second charge |

All money values here are synthetic TEST bookkeeping units, not currency or a provider invoice. In every case, changing the same request ID's fingerprint returned 409; read-only status left stored rows unchanged. Exactly nine additional 100-unit attempts fit the remaining 900. For pending cases, holding those nine new fake-provider responses showed ten pending claims and no available budget; after they settled, the old 100-unit reservation remained held. Budget exhaustion prevented an eleventh claim, not an automatic refund or reset. The existing baseline separately verifies an in-flight-limit rejection before budget exhaustion.

The recovery run made 29 total fake-provider service-binding calls across three independent cases and recorded zero Worker outbound attempts. It was executed three times successfully, including an independent repeat; ordinary dependency-free tests additionally cover the injector's exact targeting, pass-through, before/after ordering, one-shot behavior, native failures and concurrent matching calls.

Evidence writes only `evidence/recovery-results.json` and three `recovery-*-migration.log` files, without replacing baseline evidence. Raw logs remain ignored. A reviewed path-free [recovery result](../../docs/d1-recovery-evidence.json) records source and harness hashes. Normal cleanup removes only the runner's uniquely owned temporary root; a hard kill/watchdog can leave that synthetic directory, never an arbitrary cleanup target.

### What this does not prove

These are explicit D1 batch-boundary faults followed by orderly workerd disposal/restart, not an OS/process hard crash, network partition or hosted distributed-failure certification. They do not verify production Sites ingress, cloud D1 provisioning, a real model, provider billing or recovery of an ambiguous pending operation. Pending reservations intentionally remain held indefinitely: do not delete them, auto-refund them, recreate the approval scope or generate a new request ID just to make a request succeed. A later operational investigation must reconcile the database and provider evidence under the approved scope. This harness contains no unfreeze, refund, claim release or public administrator route.
