-- Belt-and-suspenders tamper protection for AuditEvent, on top of the
-- application-level hash chain (packages/shared/src/hash.ts).
--
-- The hash chain makes tampering DETECTABLE after the fact (verifyChain
-- reports exactly where the chain breaks). This trigger makes tampering
-- IMPOSSIBLE in the first place at the database layer: even a bug, a stray
-- migration, or someone with direct psql access cannot UPDATE or DELETE a
-- LIVE audit row. Pattern adapted from a standard append-only `audit_log`
-- trigger at the database layer.
--
-- Scoped to the LIVE workspace only (not a blanket block on the table):
-- the DEMO features need real mutation of DEMO audit rows --
-- `POST /audit/demo/tamper` edits a DEMO event's message without fixing its
-- hash (to demonstrate chain-verify catching it), and
-- `POST /workspace/demo/reset` deletes all DEMO rows to re-seed. A trigger
-- that blocked ALL mutation would make both impossible. So
-- the guarantee this trigger actually makes is: "LIVE audit history can
-- never be edited or deleted, through any code path, ever" -- which is the
-- one workspace where that promise has to be airtight.
CREATE OR REPLACE FUNCTION audit_event_block_live_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."workspace" = 'LIVE' THEN
    RAISE EXCEPTION 'AuditEvent rows in the LIVE workspace are append-only: % is not permitted', TG_OP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_event_no_update
  BEFORE UPDATE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION audit_event_block_live_mutation();

CREATE TRIGGER audit_event_no_delete
  BEFORE DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION audit_event_block_live_mutation();
