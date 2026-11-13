-- Schema-only migration. D1/SQLite; no learner data, credentials or approval seeds.
CREATE TABLE tutor_profiles (
  owner_id TEXT NOT NULL CHECK(length(owner_id) BETWEEN 1 AND 64),
  profile_id TEXT NOT NULL CHECK(profile_id IN ('A','B')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  PRIMARY KEY(owner_id,profile_id)
);
CREATE TABLE tutor_scopes (
  scope TEXT PRIMARY KEY NOT NULL CHECK(length(scope) BETWEEN 1 AND 100),
  owner_id TEXT NOT NULL CHECK(length(owner_id) BETWEEN 1 AND 64),
  currency TEXT NOT NULL CHECK(currency IN ('TEST','CNY','USD')),
  limit_micros INTEGER NOT NULL CHECK(typeof(limit_micros)='integer' AND limit_micros BETWEEN 1 AND 1000000000000),
  created_ms INTEGER NOT NULL CHECK(typeof(created_ms)='integer' AND created_ms >= 0),
  expires_ms INTEGER NOT NULL CHECK(typeof(expires_ms)='integer' AND expires_ms > created_ms AND expires_ms-created_ms <= 2678400000),
  max_inflight INTEGER NOT NULL CHECK(typeof(max_inflight)='integer' AND max_inflight BETWEEN 1 AND 100),
  max_requests INTEGER NOT NULL CHECK(typeof(max_requests)='integer' AND max_requests BETWEEN 1 AND 1000),
  window_ms INTEGER NOT NULL CHECK(typeof(window_ms)='integer' AND window_ms BETWEEN 1000 AND 86400000),
  spent_micros INTEGER NOT NULL DEFAULT 0 CHECK(typeof(spent_micros)='integer' AND spent_micros >= 0),
  reserved_micros INTEGER NOT NULL DEFAULT 0 CHECK(typeof(reserved_micros)='integer' AND reserved_micros >= 0),
  frozen INTEGER NOT NULL DEFAULT 0 CHECK(frozen IN (0,1)),
  last_seen_ms INTEGER NOT NULL CHECK(typeof(last_seen_ms)='integer' AND last_seen_ms >= created_ms),
  CHECK(spent_micros + reserved_micros <= limit_micros),
  CHECK((scope='offline-fixture' AND currency='TEST') OR (scope<>'offline-fixture' AND currency IN ('CNY','USD')))
);
CREATE TABLE tutor_claims (
  claim_key TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL REFERENCES tutor_scopes(scope),
  principal_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  currency TEXT NOT NULL,
  requested_limit INTEGER NOT NULL,
  reservation_micros INTEGER NOT NULL CHECK(typeof(reservation_micros)='integer' AND reservation_micros BETWEEN 1 AND 1000000000000),
  created_ms INTEGER NOT NULL CHECK(typeof(created_ms)='integer' AND created_ms >= 0),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','settled')),
  charge_micros INTEGER,
  result_json TEXT,
  error_code TEXT,
  FOREIGN KEY(principal_id,profile_id) REFERENCES tutor_profiles(owner_id,profile_id),
  CHECK((state='pending' AND charge_micros IS NULL AND result_json IS NULL AND error_code IS NULL) OR
    (state='settled' AND charge_micros=reservation_micros AND ((result_json IS NULL AND error_code IS NOT NULL) OR (result_json IS NOT NULL AND error_code IS NULL))))
);
CREATE INDEX tutor_claim_scope_time ON tutor_claims(scope,principal_id,created_ms);
CREATE INDEX tutor_claim_inflight ON tutor_claims(scope,principal_id,state);
-- All authorization and reservation predicates execute under the same write transaction.
CREATE TRIGGER tutor_claim_guard BEFORE INSERT ON tutor_claims BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM tutor_scopes WHERE scope=NEW.scope AND owner_id=NEW.principal_id) THEN RAISE(ABORT,'TUTOR_FORBIDDEN') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM tutor_profiles WHERE owner_id=NEW.principal_id AND profile_id=NEW.profile_id AND active=1) THEN RAISE(ABORT,'TUTOR_FORBIDDEN') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM tutor_scopes WHERE scope=NEW.scope AND currency=NEW.currency AND limit_micros=NEW.requested_limit) THEN RAISE(ABORT,'TUTOR_SCOPE_MISMATCH') END;
  SELECT CASE WHEN (SELECT frozen FROM tutor_scopes WHERE scope=NEW.scope)=1 THEN RAISE(ABORT,'TUTOR_SCOPE_FROZEN') END;
  SELECT CASE WHEN NEW.created_ms >= (SELECT expires_ms FROM tutor_scopes WHERE scope=NEW.scope) THEN RAISE(ABORT,'TUTOR_SCOPE_EXPIRED') END;
  SELECT CASE WHEN NEW.created_ms < (SELECT last_seen_ms FROM tutor_scopes WHERE scope=NEW.scope) THEN RAISE(ABORT,'TUTOR_CLOCK_INVALID') END;
  SELECT CASE WHEN EXISTS(SELECT 1 FROM tutor_claims WHERE claim_key=NEW.claim_key AND fingerprint<>NEW.fingerprint) THEN RAISE(ABORT,'TUTOR_IDEMPOTENCY_CONFLICT') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM tutor_claims WHERE claim_key=NEW.claim_key) AND
    NEW.reservation_micros > (SELECT limit_micros-spent_micros-reserved_micros FROM tutor_scopes WHERE scope=NEW.scope) THEN RAISE(ABORT,'TUTOR_BUDGET_EXHAUSTED') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM tutor_claims WHERE claim_key=NEW.claim_key) AND
    (SELECT count(*) FROM tutor_claims WHERE scope=NEW.scope AND principal_id=NEW.principal_id AND state='pending') >=
    (SELECT max_inflight FROM tutor_scopes WHERE scope=NEW.scope) THEN RAISE(ABORT,'TUTOR_INFLIGHT_LIMIT') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM tutor_claims WHERE claim_key=NEW.claim_key) AND
    (SELECT count(*) FROM tutor_claims WHERE scope=NEW.scope AND principal_id=NEW.principal_id AND created_ms > NEW.created_ms-(SELECT window_ms FROM tutor_scopes WHERE scope=NEW.scope)) >=
    (SELECT max_requests FROM tutor_scopes WHERE scope=NEW.scope) THEN RAISE(ABORT,'TUTOR_RATE_LIMIT') END;
END;
CREATE TRIGGER tutor_claim_reserve AFTER INSERT ON tutor_claims BEGIN
  UPDATE tutor_scopes SET reserved_micros=reserved_micros+NEW.reservation_micros,last_seen_ms=NEW.created_ms WHERE scope=NEW.scope;
END;
CREATE TRIGGER tutor_claim_immutable BEFORE UPDATE ON tutor_claims BEGIN
  SELECT CASE WHEN OLD.claim_key IS NOT NEW.claim_key OR OLD.token IS NOT NEW.token OR OLD.scope IS NOT NEW.scope OR
    OLD.principal_id IS NOT NEW.principal_id OR OLD.profile_id IS NOT NEW.profile_id OR OLD.request_id IS NOT NEW.request_id OR
    OLD.fingerprint IS NOT NEW.fingerprint OR OLD.currency IS NOT NEW.currency OR OLD.requested_limit IS NOT NEW.requested_limit OR
    OLD.reservation_micros IS NOT NEW.reservation_micros OR OLD.created_ms IS NOT NEW.created_ms OR OLD.state='settled' OR NEW.state<>'settled'
    THEN RAISE(ABORT,'TUTOR_SETTLEMENT_CONFLICT') END;
END;
CREATE TRIGGER tutor_claim_charge AFTER UPDATE OF state ON tutor_claims WHEN OLD.state='pending' AND NEW.state='settled' BEGIN
  UPDATE tutor_scopes SET reserved_micros=reserved_micros-OLD.reservation_micros,spent_micros=spent_micros+NEW.charge_micros WHERE scope=OLD.scope;
END;
CREATE TRIGGER tutor_scope_immutable BEFORE UPDATE ON tutor_scopes BEGIN
  SELECT CASE WHEN OLD.scope IS NOT NEW.scope OR OLD.owner_id IS NOT NEW.owner_id OR OLD.currency IS NOT NEW.currency OR
    OLD.limit_micros IS NOT NEW.limit_micros OR OLD.created_ms IS NOT NEW.created_ms OR OLD.expires_ms IS NOT NEW.expires_ms OR
    OLD.max_inflight IS NOT NEW.max_inflight OR OLD.max_requests IS NOT NEW.max_requests OR OLD.window_ms IS NOT NEW.window_ms OR
    NEW.spent_micros < OLD.spent_micros OR NEW.last_seen_ms < OLD.last_seen_ms OR NEW.frozen < OLD.frozen
    THEN RAISE(ABORT,'TUTOR_SCOPE_MISMATCH') END;
END;
-- No automatic claim pruning, refund or scope reset; ambiguous requests stay held.
CREATE TRIGGER tutor_claim_no_delete BEFORE DELETE ON tutor_claims BEGIN SELECT RAISE(ABORT,'TUTOR_SETTLEMENT_CONFLICT'); END;
CREATE TRIGGER tutor_scope_no_delete BEFORE DELETE ON tutor_scopes BEGIN SELECT RAISE(ABORT,'TUTOR_SCOPE_MISMATCH'); END;
