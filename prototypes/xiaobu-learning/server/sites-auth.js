// Server-only trust boundary. Headers are not signatures. A deployment must inject
// a verifier that recognizes its platform-controlled ingress, never browser input.
// Do NOT wire verifyRequest:()=>true on a public Node/Worker endpoint.
import {fault} from './catalogue.js';
const ID = /^[A-Za-z0-9_-]{1,64}$/;
export function createSitesAuthenticator({boundary} = {}) {
  if (!boundary || boundary.kind !== 'sites-dispatch' || typeof boundary.verifyRequest !== 'function') throw fault('TRUST_BOUNDARY_REQUIRED');
  const verifyRequest = boundary.verifyRequest;
  return async function authenticate(request) {
    // An identity-less Sites bypass token is never accepted as user identity.
    // Dispatch must validate/consume it; forwarding one here is not authentication.
    if (await verifyRequest(request) !== true) return null;
    if (request.headers.has('oai-sites-authorization')) return null;
    const id = request.headers.get('oai-authenticated-user-id');
    if (!id || !ID.test(id)) return null;
    // No email/name read or persisted; no fallback to an ordinary user header.
    return Object.freeze({id});
  };
}
