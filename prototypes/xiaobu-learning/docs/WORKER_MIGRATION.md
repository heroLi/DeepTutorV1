# Worker migration readiness: local evidence, not a deployment

The private Site remains statically hosted. The API runtime, client and this media adapter are source-only. Nothing here enables cloud storage, a real model, microphone upload or new sharing.

## What was actually verified

An independent project was prepared using the official Sites Vinext starter and its locked installer/build workflow. It had no Site ID, D1/R2 bindings, credentials or production identity. The built Worker and its static assets ran under local workerd/Miniflare, not a deployed Site or browser.

- All 13 original assets matched the byte lengths and SHA-256 hashes in `worker-assets.json`. The MP4 remains 1,663,403 bytes with SHA-256 `f7ad7412302d604309b0e00adb35d5689eda0a8f548f292263f76c56e2232acf`.
- The final built-Worker protocol run recorded 27 passing checks, covering the original assets, video GET/HEAD, prefix/middle/suffix/open-ended ranges, 416, If-Range, 304 and missing routes. Disabled diagnostic/status and denied dialogue routes were separately asserted. The protocol run attempted zero outbound requests.
- The default local asset route ignored Range and returned the entire video as 200. Its HEAD omitted Content-Length. This is an observed local compatibility issue, not a claim about production Cloudflare.
- An explicitly declared asset binding and selective Worker-first route allowed the bounded adapter below to return correct partial bytes. No vendor or generated build plugin was patched.
- The portable adapter tests now run in this repository with `npm test`: 5 focused groups, 183 total tests. The complete framework build/protocol probe was a separate local check, not part of the normal dependency-free CI job.

Verified tool versions: Node 24.22.1, Vinext 1.0.0-beta.5, Vite 8.0.13, Wrangler 4.92.0, Miniflare 4.20260515.0 and Cloudflare Vite plugin 1.37.1. The official starter lockfile used by that isolated build had SHA-256 `eedaeab6870c0f70f9db869fcaa24abae9b0f945cbc9acb8a43b6e7ed6bcbfca`. These are evidence of that run, not automatic compatibility guarantees for future dependency versions.

## Minimal integration candidate

`server/learning-media.js` is pure Web-standard JavaScript, deliberately not imported by the static frontend. It only handles `/media/average-sharing.mp4`; it is not an upload endpoint, URL proxy or general media server. The source asset must match the fixed length and hash before any success response. Cookies, authorization and range headers are not forwarded to the asset binding.

The isolated starter's Cloudflare plugin configuration explicitly included:

```js
assets: {
  binding: "LEARNING_ASSETS",
  run_worker_first: ["/media/average-sharing.mp4"]
}
```

Its emitted `dist/server/wrangler.json` was checked for that binding, path and `assets.directory: "../client"`. The Worker entry added only this dispatch before the retained official handler:

```js
if (new URL(request.url).pathname === MEDIA_PATH) {
  return learningMedia(request, env.LEARNING_ASSETS);
}
```

Use the official full-stack starter/build workflow when integrating this into a real migration. Preserve its connector-context handling and existing Site identity/audience. Do not invent an `ASSETS` binding or combine the current `static.directory` manifest with an unverified Worker mode. This repository intentionally does not include a duplicate framework starter, generated output, repeated media, runtime database or new dependencies.

## Media contract and limits

- Exact GET bytes and HEAD length/MIME; HEAD ignores Range and has no body.
- Single byte ranges, including one byte, end clamping and suffixes, return 206 with matching Content-Range/Length. Unsatisfiable or malformed single-byte ranges return empty 416 with the full length.
- Unsupported multipart ranges and unknown units are ignored with complete 200. Byte units are case-insensitive.
- Strong matching If-Range allows partial content; mismatch, weak validator or date validator falls back to complete 200. Matching If-None-Match uses weak comparison and returns 304 before range handling. If-Modified-Since is not implemented because there is no Last-Modified metadata.
- Range/validator headers are limited to 512 characters each. Asset reads have a 2-second deadline and the exact fixed byte bound; corrupt, truncated, oversized or unavailable bytes fail closed with a no-store 503. Cancelled/late responses are not read or returned as success, and streams are cancelled/released.
- Successful media responses are private/no-store. The current implementation reads and hashes at most the full 1.6 MB file per request, including HEAD. It is not designed for large media or unbounded concurrent traffic.

Run the portable regressions with `node --test tests/media-range.test.js`. The full local framework probe and its build evidence were retained separately; copying this module alone does not reproduce or verify a framework/platform integration.

## Gates still open

Before changing the existing private Site: verify the hosting/storage cost rules or obtain a spending limit; use the official migration format; validate actual private ingress and owner/profile authorization; initialize D1 through the controlled operator path, not public admin routes or identity seeds in migrations; test hosted assets/routing/Range and browser video controls; and keep the real provider disabled until its specific budget, data and safe credential configuration are approved.

No physical-device playback, browser-hosted API, cloud D1, production private-ingress authentication or real DeepSeek call was verified by this probe. A disabled diagnostic response is not a working tutoring API.
