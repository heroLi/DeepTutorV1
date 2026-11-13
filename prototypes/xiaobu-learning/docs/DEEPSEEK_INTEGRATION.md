# DeepSeek integration: implemented, not deployed

## Current truth

The private Site is static. Its dialogue remains a clearly labelled local, finite mock. It sends no question, answer, profile, microphone recording or transcript to this adapter or DeepSeek. The source includes a deployment-neutral server runtime, Sites identity adapter, persistent SQL ledger and offline tests, not a deployed API, automatic video generation or arbitrary-question tutoring. No real credentials were read and no paid API request was made.

The first integration scope is intentionally only nine authored synthetic questions and four intents. Provider output must exactly match the reviewed canonical fixture, including a recomputed arithmetic answer. This tests protocol and safety boundaries, not model teaching quality. A real model may be rejected for wording differences. Expanding to free-form explanations needs separate content evaluation and consent design.

## Contracts

`server/deepseek.js` exports `createDeepSeekProvider`. Default mode is `disabled`. Tests explicitly inject a fake fetch and synthetic credential under `offline-test`. There is no environment-variable lookup, default global fetch, SDK, automatic retry or implicit startup.

The fixed endpoint is `https://api.deepseek.com/chat/completions`; redirects are errors. Current allowed model is only `deepseek-flash`. Payload explicitly disables thinking, sets `stream:false`, `max_tokens:384`, and JSON object output. No tool calls are supported. A model change requires reviewed code/configuration, fresh official documentation and fresh pricing.

`server/service.js` exports `createTutorService`, whose `.fetch(Request)` handles only same-origin POST `/api/tutor/dialogue`, with JSON content type, exact Origin and `x-xiaobu-request: 1`. Requests are at most 1024 bytes and exactly:

```json
{"requestId":"unique-request-id","profileId":"A","questionId":"loop:math:0","intent":"hint"}
```

Question IDs are `loop:{math|chinese|english}:{0|1|2}`. Intents are `understand`, `hint`, `next`, `check`. Free text, recordings, selected answers and profile histories are rejected as extra fields. The server authenticates a principal and authorizes ownership of `profileId` before reserving money or replaying a cached result. The browser's anonymous A/B selector is NOT authentication.

Success is `{ok:true,result:{mode,questionId,intent,text,followUp,answer}}`. Modes are `mock`, `protocol-test`, or `deepseek`. `answer` is null except for `check`. Render all text with `textContent`, never HTML/Markdown execution. Failures expose only an allowlisted code, never a provider response body, credential or raw prompt.

Responses have byte, UTF-8, JSON/schema and canonical-value validation. Empty content, non-stop finish reasons, unexpected model, tools, reasoning output, missing/out-of-bound usage and arithmetic mismatch fail closed. Timeouts cover both headers and response reading. Cancellation is propagated, but an upstream request can still incur cost; cancellation is not a refund.

## Read-only API status

`GET /api/tutor/status` is composed by the runtime and can also be built as a standalone `createTutorStatusHandler`. It uses the same trusted identity boundary and checks persisted scope ownership before exposing any quota. A supplied Origin must match exactly. Normal browser same-origin GET requests may omit Origin; in that case `Sec-Fetch-Site: same-origin` plus `x-xiaobu-request: 1` is required. Cross-site and missing-origin/missing-metadata requests are rejected. Browser code must not try to manufacture Origin or identity headers.

Status reads use one SELECT snapshot and never reserve money, settle a claim, refresh counters, call the provider or alter the database. They report configured mode, synthetic-only scope, explicit TEST/CNY/USD microunits, conservative booked/reserved/available amounts, pending and rolling-request counts, and allowlisted stopping reasons. They expose no owner ID, scope reference, request/claim details, tokens or credentials. These amounts are upper-bound bookkeeping, not a provider invoice.

`scopeAndConfigurationAllowAttempt` is only a local configuration/quota precheck. Profile authorization is still required for POST. `platformVerified:false` and `upstreamConnectivity:not-verified` are explicit: this endpoint does not prove deployed authentication or DeepSeek connectivity. Live pricing-readiness checks must return a positive safe cost bound within the reservation; false, undefined, expired or asynchronous rejected checks cannot authorize a request.

Known operational stops (frozen/expired scope, invalid clock, genuinely expired pricing) can create a diagnostic-only runtime after cold start, so an authorized owner can understand why requests stopped. POST stays 503 and the runtime does not auto-resume; `RUNTIME_RESTART_REQUIRED` prevents a later recovered snapshot from promising that this instance can send. Missing schema, wrong scope/currency/cap, absent trust boundary, credentials or approval remain construction failures. This exception never creates an otherwise unauthorised provider or resets any quota.

## Live gate and cost assumptions

Live construction requires a server-injected credential, explicit synthetic-only approval record (provider, currency, positive total cap and unique approval reference), matching fresh model pricing, injected transport and trusted authentication/profile/ledger dependencies. The service checks these exact dependency bindings again. Configuration is not accepted from a browser. Declaring a flag or `kind:'durable-atomic'` does not implement or prove security; deployment review must verify the dependencies.

Pricing uses integer millionths of the stated currency, with separately configured input and output rates per million tokens. There is no bundled price quote. Pricing expires in at most 24 hours and is checked before every live request. A conservative request reservation is derived from 4096 input payload bytes plus 256 framing tokens and 384 maximum output tokens, rounded upward with integer arithmetic. A smaller reservation fails closed. Input rates must cover cache misses, all mandatory charges and any applicable overhead; deployment must verify the byte/token/framing assumption against the provider's actual accounting and set provider-side spending limits. This is a conservative integration guard, not a guarantee against changed provider billing. Observed usage outside bounds freezes the approval scope for investigation.

Every attempted provider outcome, including timeout or error, consumes the full reservation. No automatic refund, retry or uncertain-claim release is performed. A settlement outage leaves the reservation held. Credentials, price records and approval controls must exist only in trusted server configuration; none belong in static Site files.

## Persistent ledger implementation and deployment boundary

`server/d1-ledger.js` now provides `reserveAndClaim({key,fingerprint,scope,limitMicros,reservationMicros})`, `settle({token,chargeMicros,result,errorCode})`, and `freezeScope(scope)` with durable transactional behavior:

- Atomically enforce total spent plus all in-flight reservations, per-principal rate/in-flight limits, and frozen scopes across processes and restarts.
- Key requests by approval scope, authenticated principal and request ID. Fingerprint includes profile, question and intent. Changed fingerprints conflict; pending duplicates return IN_PROGRESS; settled duplicates replay their validated result or stable sanitized error.
- Never execute two upstream requests for one claim, even after crashes. Store reservation and outcome atomically; ambiguous outcomes remain held for reconciliation. Settlement is idempotent and cannot exceed the reservation.
- Use unique approval-period references. Persist freezes atomically and require operator reconciliation before unfreezing. Protect records with access control, minimal retention and backups.

The original protocol tests retain an in-memory fake. New ledger/runtime tests instead run the actual SQL migration and adapter against temporary SQLite files, including two worker threads with independent connections and a start barrier. They verify restart persistence, full-charge idempotent settlement, duplicate claims, competing final reservations, rolling rate limits, expiration/freeze and lost responses after committed writes. This is not a hosted-D1 certification.

`server/migrations/0001_tutor.sql` is schema-only and has never been applied to a cloud database. Write-time SQL triggers recheck ownership, active profile, matching scope/currency/cap, expiry, frozen state, remaining money, in-flight count and rolling request window in the same transaction as each reservation. Existing scope caps/owner/expiry and claim identity cannot be rewritten or deleted through the adapter. Pending claims do not expire into free budget. `createD1LedgerAdmin` is an operator-only provisioning API, never an HTTP route: it registers anonymous A/B profiles and creates a new immutable approval period. Reusing its reference fails; re-registering a disabled profile does not reactivate it.

`server/runtime.js` defaults to disabled, accepts only the branded SQL adapter, checks its persisted scope, and composes authentication, profile authorization, provider and service. Mock/offline-test uses only the distinct TEST scope and cannot consume CNY/USD approvals. TEST units are not actual money. The adapter brand prevents accidental plain-object substitution; the trusted binding and actual schema must still be verified at deployment.

`server/sites-auth.js` is Sites-specific: it reads only the stable authenticated-user ID after an injected platform-boundary check. It does not read/store email or name, implement a second OAuth stack, or accept a bypass token as visitor identity. The boundary callback is NOT a new proof of authentication by itself. A deployment must route requests exclusively through Sites trusted dispatch, ensure identity headers cannot be supplied directly by the client, and test that boundary. Do not expose a raw Worker/Node endpoint and set the callback to always true. HTTP origin/custom-header checks are CSRF defense in depth, not session authentication.

Authentication precedes request-body parsing. `server/request-body.js` enforces 1024 bytes, fatal UTF-8/JSON parsing, a configurable 1–10000ms read deadline (default 2000ms), and cancellation. Timeout/late data cannot reach the ledger or provider; cancellation cleanup is not allowed to hang the handler.

## Remaining steps before any real use

1. Select and authorize an HTTPS server deployment; static Sites does not run these modules. Bundle only public frontend files into the Site, never server configuration or keys.
2. Wire and verify the Sites trusted ingress adapter and D1 binding; apply the reviewed migration through the platform migration workflow, then provision only an authorized owner/approval scope. Confirm genuine D1 transactional behavior, ownership isolation, rate limits, restarts, settlement failures and reconciliation. Add restricted egress and redacted operational monitoring. Do not treat local SQLite tests as proof of deployed access control.
3. Obtain a specific currency/total budget and synthetic-only test authorization; verify current provider terms, model and pricing. Add the credential via the deployment platform's secret manager, not chat or browser code.
4. Run controlled synthetic staging checks with no child information, measure actual token accounting and response schema, and verify provider-side caps. Production connectivity has NOT been tested here.
5. Only later, obtain explicit consent for precisely which child text/audio/data would go to which service, retention and cost. That is outside this scope. DeepSeek text completions do not themselves provide microphone recognition or audio output.

## Documentation checked

Official DeepSeek documentation checked 2026-11-13:
- https://api-docs.deepseek.com/api/create-chat-completion/
- https://api-docs.deepseek.com/api/list-models/
- https://api-docs.deepseek.com/guides/json_mode
- https://api-docs.deepseek.com/guides/thinking_mode

The current docs list `deepseek-flash` and `deepseek-v4-pro`, with thinking enabled by default; this adapter explicitly disables it. Documentation is not approval to call the API.

## Offline validation

Run `node --test tests/deepseek.test.js` or `npm test`. Tests inject only deterministic fake network responses, use synthetic keys and never call DeepSeek. Coverage includes 36 frontend/server fixture pairs; fixed protocol; error, truncation and wrong-answer rejection; timeout and abort; strict payload/identity/CSRF boundaries; cached success/error validation; duplicate/concurrent reservations; conservative charging; settlement ambiguity; pricing expiry/minimum reservation and scope freezing. These are automated Node tests, not deployment or real-device evidence.

## Persistent-store documentation

The D1 adapter uses prepared bindings and `batch()` for ordered transactional statements; it does not issue manual BEGIN/COMMIT to D1. The test-only SQLite binding uses explicit local transactions to exercise the same SQL. Reference: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch .
