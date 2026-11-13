# Synthetic API client: source only, not connected to the Site

`client/tutor-client.js` is an opt-in transport for the fixed synthetic API contract. The current hosted page does not import it. Its dialogue and voice behavior remain local; this addition is not evidence that DeepSeek is connected.

## Deliberate activation

Construction defaults to disabled. Enabling requires both an injected fetch implementation and an explicit expected mode: `mock`, `offline-test`, or `live`. These map to the exact response modes `mock`, `protocol-test`, and `deepseek`. A status response never enables the client, changes its mode, or causes an automatic fallback.

Development-only example with an injected same-origin test bridge:

```js
const client = createTutorClient({
  enabled: true,
  expectedMode: 'offline-test',
  fetchImpl: syntheticSameOriginTestBridge,
});
client.setScope({profileId: 'A', questionId: 'loop:math:0'});
const snapshot = await client.getStatus();
const reply = await client.dialogue({requestId: 'synthetic-001', intent: 'hint'});
client.dispose();
```

An enabled flag is configuration, not permission to transmit real child information or incur API charges. The server's identity, ownership, budget and provider gates remain authoritative. Real deployment and data/spending authorization are still outstanding.

## Narrow request boundary

- Only fixed relative `/api/tutor/status` and `/api/tutor/dialogue` URLs are used, with same-origin mode/credentials, no-store and redirect rejection.
- Browser Origin, Fetch Metadata and identity headers are not manufactured by client code. The browser and trusted platform must supply them.
- A scope contains only anonymous A/B profile and one of nine authored question IDs. Dialogue accepts only request ID and one of four intents. Free text, recordings, history, URL overrides and API keys are rejected.
- The `check` intent displays the reviewed example explanation. It does not grade a child's arbitrary reasoning or inspect an actual recorded answer.

## Validation and interruption

Responses must have the exact JSON envelope and finite contract. Dialogue text and answers must match the same canonical original fixtures as the existing local preview. Status types, amount identities, server numeric bounds, units and stopping reasons are checked; platform readiness and connectivity remain explicitly unverified.

Responses are capped at 16 KiB. The total timeout covers headers and body, with fatal UTF-8/JSON validation. There are no retries. A second request while one is pending returns BUSY without cancelling the first. Explicit cancellation, scope change or disposal aborts transport and discards late results. Validated action IDs/intents are immutable snapshots, so later caller mutation cannot relabel a response.

Each request owns and closes its response body, including responses arriving after cancellation, timeout, disposal or a scope change. Early header/size/redirect rejection closes an unread body without acquiring a reader. Locked readers are cancelled without awaiting an uncooperative cancellation promise and their locks are released. Cleanup errors cannot replace the original outcome or clear another request's busy state.

Cancellation and timeout do not prove the server did nothing and do not imply refunds. The server may already have reserved or conservatively charged the request. Retrying is a separate caller decision; the server's stable request-ID idempotency still applies. Returned request/profile correlation fields are client-side context, not a new server authentication claim.

## Verification and release boundary

Tests exercise all 36 authored question/intent pairs and the full client → synthetic same-origin bridge → runtime → real temporary SQLite → fake DeepSeek protocol. The bridge simulates browser metadata and trusted ingress; this is not a real browser-to-hosted-API test. No real credentials, provider request or cloud database is used.

The client is outside `dist`. Release-boundary tests reject obvious backend/provider/private-key patterns or runtime databases in shipped static files, and schema migrations cannot seed identities or approvals. `.gitignore` excludes common local secrets and database files. These are regression safeguards, not a comprehensive secret scan or proof of production security.
