// @vitest-environment node
import { describe, it, expect } from "vitest";
import { anonClient } from "./helpers/supabase";

const TABLES = [
  "accounts",
  "event_types",
  "availability_rules",
  "date_overrides",
  "bookings",
  "booking_events",
] as const;

describe("RLS anon lockout (FOUND-05)", () => {
  for (const table of TABLES) {
    it(`anon cannot SELECT from ${table}`, async () => {
      const { data, error } = await anonClient()
        .from(table)
        .select("*")
        .limit(1);
      // Either policy blocks (returns []) or error is a permissions error.
      // Our policies return [] because no policy matches; this is the expected behavior.
      if (!error) {
        expect(data).toEqual([]);
      } else {
        // Acceptable alternative outcome
        expect(error).toBeTruthy();
      }
    });

    it(`anon cannot INSERT into ${table}`, async () => {
      const { error } = await anonClient()
        .from(table)
        .insert({} as never);
      expect(error).toBeTruthy();
    });
  }
});
