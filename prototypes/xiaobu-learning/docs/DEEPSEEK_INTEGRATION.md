# DeepSeek integration: implemented, not deployed

## Current truth

The private Site is static. Its dialogue remains a clearly labelled local, finite mock. It sends no question, answer, profile, microphone recording or transcript to this adapter or DeepSeek. This change adds a deployment-neutral server HTTP adapter and offline tests, not a running API, automatic video generation or arbitrary-question tutoring. No real credentials were read and no paid API request was made.

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

## Live gate and cost assumptions

Live construction requires a server-injected credential, explicit synthetic-only approval record (provider, currency, positive total cap and unique approval reference), matching fresh model pricing, injected transport and trusted authentication/profile/ledger dependencies. The service checks these exact dependency bindings again. Configuration is not accepted from a browser. Declaring a flag or `kind:'durable-atomic'` does not implement or prove security; deployment review must verify the dependencies.

Pricing uses integer millionths of the stated currency, with separately configured input and output rates per million tokens. There is no bundled price quote. Pricing expires in at most 24 hours and is checked before every live request. A conservative request reservation is derived from 4096 input payload bytes plus 256 framing tokens and 384 maximum output tokens, rounded upward with integer arithmetic. A smaller reservation fails closed. Input rates must cover cache misses, all mandatory charges and any applicable overhead; deployment must verify the byte/token/framing assumption against the provider's actual accounting and set provider-side spending limits. This is a conservative integration guard, not a guarantee against changed provider billing. Observed usage outside bounds freezes the approval scope for investigation.

Every attempted provider outcome, including timeout or error, consumes the full reservation. No automatic refund, retry or uncertain-claim release is performed. A settlement outage leaves the reservation held. Credentials, price records and approval controls must exist only in trusted server configuration; none belong in static Site files.

## Required persistent ledger semantics (not implemented here)

The production adapter must provide `reserveAndClaim({key,fingerprint,scope,limitMicros,reservationMicros})`, `settle({token,chargeMicros,result,errorCode})`, and `freezeScope(scope)` with durable transactional behavior:

- Atomically enforce total spent plus all in-flight reservations, per-principal rate/in-flight limits, and frozen scopes across processes and restarts.
- Key requests by approval scope, authenticated principal and request ID. Fingerprint includes profile, question and intent. Changed fingerprints conflict; pending duplicates return IN_PROGRESS; settled duplicates replay their validated result or stable sanitized error.
- Never execute two upstream requests for one claim, even after crashes. Store reservation and outcome atomically; ambiguous outcomes remain held for reconciliation. Settlement is idempotent and cannot exceed the reservation.
- Use unique approval-period references. Persist freezes atomically and require operator reconciliation before unfreezing. Protect records with access control, minimal retention and backups.

The test ledger is only an in-memory fake and is not a production implementation. HTTP header checks are CSRF defense in depth, not session authentication. Production authentication must validate a server session and bind profile ownership; raw user/profile headers cannot establish identity.

## Remaining steps before any real use

1. Select and authorize an HTTPS server deployment; static Sites does not run these modules. Bundle only public frontend files into the Site, never server configuration or keys.
2. Implement and verify platform authentication, secure session cookies, ownership authorization, persistent transactional ledger, rate limiting, body/read timeouts, restricted egress and redacted operational monitoring. Test multiple workers, restarts, settlement failures and reconciliation.
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
