import test from "node:test";
import assert from "node:assert/strict";
import { assertSafeDatabaseUrl } from "../src/lib/db/env-guard";

test("Database Environment Guard - Strict Default-Deny", async (t) => {
  await t.test("Blocks production Supabase pooler host (case-insensitive)", () => {
    const fakeProdUrl = "postgresql://postgres:secret@AWS-0-AP-SOUTH-1.POOLER.SUPABASE.COM:6543/postgres";
    assert.throws(
      () => assertSafeDatabaseUrl(fakeProdUrl),
      /\[DB_GUARD_BLOCKED\] Production database pattern detected/
    );
  });

  await t.test("Blocks production direct connection URL (db.*.supabase.co)", () => {
    const directUrl = "postgresql://postgres:secret@db.zyqiuspkmldetupuxpyu.supabase.co:5432/postgres";
    assert.throws(
      () => assertSafeDatabaseUrl(directUrl),
      /\[DB_GUARD_BLOCKED\] Production database pattern detected/
    );
  });

  await t.test("Blocks production direct connection URL for any project ref", () => {
    const anyDirectUrl = "postgresql://postgres:secret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres";
    assert.throws(
      () => assertSafeDatabaseUrl(anyDirectUrl),
      /\[DB_GUARD_BLOCKED\] Production database pattern detected/
    );
  });

  await t.test("Blocks production host EVEN IF database name is x_test", () => {
    const prodWithTestDb = "postgresql://postgres:secret@aws-0-ap-south-1.pooler.supabase.com:6543/x_test";
    assert.throws(
      () => assertSafeDatabaseUrl(prodWithTestDb),
      /\[DB_GUARD_BLOCKED\] Production database pattern detected/
    );
  });

  await t.test("Blocks production direct URL with query parameters (?pgbouncer=true)", () => {
    const prodWithQueryParams = "postgresql://postgres:secret@db.zyqiuspkmldetupuxpyu.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1";
    assert.throws(
      () => assertSafeDatabaseUrl(prodWithQueryParams),
      /\[DB_GUARD_BLOCKED\] Production database pattern detected/
    );
  });

  await t.test("Default-deny: blocks unlisted external host even if not matching production denylist", () => {
    const unknownHost = "postgresql://user:pass@some-random-host.com:5432/aurasmm_test";
    assert.throws(
      () => assertSafeDatabaseUrl(unknownHost),
      /\[DB_GUARD_BLOCKED\] Target database \(some-random-host.com\/aurasmm_test\) is not on the explicit TEST_DB_ALLOWLIST/
    );
  });

  await t.test("Allows exact localhost allowlist pair", () => {
    const localUrl = "postgresql://postgres:postgres@localhost:5432/aurasmm_test";
    assert.doesNotThrow(() => assertSafeDatabaseUrl(localUrl));
  });

  await t.test("Allows localhost with query parameters (?schema=public&sslmode=disable)", () => {
    const localUrlWithParams = "postgresql://postgres:postgres@localhost:5432/aurasmm_test?schema=public&sslmode=disable";
    assert.doesNotThrow(() => assertSafeDatabaseUrl(localUrlWithParams));
  });

  await t.test("Allows hosted test project when explicitly added to TEST_DB_ALLOWLIST", () => {
    const oldEnv = process.env.TEST_DB_ALLOWLIST;
    try {
      process.env.TEST_DB_ALLOWLIST = "aurasmm-test.supabase.co/postgres,db.aurasmm-test.supabase.co/postgres";
      const testProjectUrl = "postgresql://postgres:secret@aurasmm-test.supabase.co:5432/postgres?sslmode=require";
      assert.doesNotThrow(() => assertSafeDatabaseUrl(testProjectUrl));
    } finally {
      process.env.TEST_DB_ALLOWLIST = oldEnv;
    }
  });
});
