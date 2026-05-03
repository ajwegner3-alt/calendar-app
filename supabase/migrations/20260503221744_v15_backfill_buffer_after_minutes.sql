BEGIN;
  DO $$ BEGIN RAISE NOTICE 'v1.5 Phase 28 backfill: event_types.buffer_after_minutes from accounts.buffer_minutes'; END $$;

  UPDATE event_types et
  SET buffer_after_minutes = a.buffer_minutes
  FROM accounts a
  WHERE et.account_id = a.id
    AND et.buffer_after_minutes = 0;
COMMIT;
