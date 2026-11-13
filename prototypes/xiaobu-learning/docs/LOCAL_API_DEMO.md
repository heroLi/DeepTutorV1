# Local synthetic HTTP API demo

This is a **local development fixture**, not the private Site, a deployed service, real DeepSeek access, or production authentication. It binds only `127.0.0.1` on a random port. The printed URL is usable only on that computer, not remotely from a phone or another person's browser. No cloud deployment, API spending or microphone upload occurs.

## Run

Requires Node 22.13 or newer (built-in SQLite), no installation of extra dependencies:

```sh
npm run demo:api
```

The process prints an origin such as `http://127.0.0.1:42001`. Substitute its actual port below. No command-line options or environment credentials are read. Bind host, runtime mode, external URLs and database paths cannot be configured. Stop with Ctrl+C; the process removes only the unique temporary directory it created. A hard kill may leave that fixture directory behind; the next run creates a fresh one and never deletes arbitrary existing paths.

```sh
BASE=http://127.0.0.1:42001
curl "$BASE/api/tutor/status" \
  -H 'Sec-Fetch-Site: same-origin' -H 'X-Xiaobu-Request: 1'

curl "$BASE/api/tutor/dialogue" \
  -H "Origin: $BASE" -H 'X-Xiaobu-Request: 1' \
  -H 'Content-Type: application/json' \
  --data '{"requestId":"demo-1","profileId":"A","questionId":"loop:math:0","intent":"check"}'
```

Expected status: `configuredMode: "offline-test"`, currency `TEST`, 1000 initial TEST-microunits (simulation counters only), and `platformVerified: false`. Each unique provider attempt reserves and consumes 100 units conservatively. Ten successful unique requests exhaust the fixture cap; repeats of the same request ID and identical payload replay the existing response without another provider call. The cap expires after one hour and resets only by ending the demo and starting a new independent fixture. These are simulated units, not a currency or a provider bill.

The POST returns `mode: "protocol-test"` and a canonical authored answer. Valid question IDs are `loop:{math|chinese|english}:{0|1|2}`; intents are `understand`, `hint`, `next`, `check`. Only synthetic profiles A/B exist. No free text, recordings, history, child data, file uploads or administrative routes are accepted. There is no frontend in this demo.

## Identity and safety boundaries

The loopback entry ignores client-supplied identity, email and bypass headers, assigns one fixed synthetic owner and internally attests only the Request objects it creates. **This is a fixture, not user authentication.** It must never be exposed by a tunnel, reverse proxy, public listener or production Sites route. Any local process can use it under its one synthetic identity.

Host must exactly match the printed `127.0.0.1:port`. GET requires the custom header plus an exact Origin, or `Sec-Fetch-Site: same-origin` when Origin is absent. POST requires the exact Origin and custom header. Missing/foreign Host and cross-origin requests fail closed. These checks reduce DNS-rebinding and cross-site misuse; they are not a substitute for production authentication.

The HTTP bridge limits bodies to 1 KiB, bounds body reading, closes connections after replies, and translates stream errors into bounded failures. Cancelling a provider attempt does not refund the conservative fixture reservation. The provider is an injected function that creates a fake response in memory, not a network request. The only credential-looking string is an obviously synthetic test placeholder.

SQLite uses the development/test-only D1-shaped binding from `tests/helpers/sqlite-d1.js`, with the actual ledger schema and triggers. This demonstrates SQL persistence within this process's temporary database, not Cloudflare D1 deployment or platform ingress verification. No real key is needed or should be supplied.

## Verification

```sh
node --test tests/http-demo.test.js
npm test
```

Real loopback HTTP tests exercise client → HTTP bridge → runtime → SQLite → fake provider, no-Origin same-origin GET, idempotency and exhaustion, overlapping request-ID and in-flight guards, spoofed headers/Host/Origin, rejected personal-data-shaped payloads, slow/late bodies, cancellation accounting, malformed raw HTTP and stream errors. These tests do not claim browser, device, cloud or real-provider validation.

The imported test fixture can hold its internal fake provider behind an explicit release gate for deterministic overlap assertions. This does not inject an alternative provider, and the CLI does not expose test options. Shutdown releases the gate, aborts sockets and waits for admitted handlers before closing its own database.
