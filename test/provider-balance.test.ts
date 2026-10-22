import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_PROVIDER_BALANCE_REFRESH_INTERVAL_MS,
  getProviderBalanceRefreshIntervalMs,
  parseProviderBalanceResponse,
  resolveProviderBalanceSnapshot,
} from "../src/lib/provider/balance";
import { formatProviderBalance } from "../src/lib/currency";

test("parses Xmedia's documented balance schema without rounding", () => {
  const documented = parseProviderBalanceResponse({ balance: "100.84292", currency: "USD" });
  assert.equal(documented.balance, 100.84292);
  assert.equal(documented.rawBalance, "100.84292");
  assert.equal(documented.currency, "USD");

  const dashboardExample = parseProviderBalanceResponse({ balance: "672.0677800", currency: "INR" });
  assert.equal(dashboardExample.balance, 672.06778);
  assert.equal(dashboardExample.rawBalance, "672.0677800");
  assert.equal(dashboardExample.currency, "INR");
  assert.equal(formatProviderBalance(dashboardExample.balance, dashboardExample.currency), "₹672.06778");

  const higherPrecision = parseProviderBalanceResponse({ balance: "0.123456789", currency: "INR" });
  assert.equal(formatProviderBalance(higherPrecision.balance, higherPrecision.currency), "₹0.123456789");
});

test("rejects HTTP and JSON provider errors instead of mapping them to zero", () => {
  assert.throws(
    () => parseProviderBalanceResponse({ error: "Invalid API key" }, 401),
    /HTTP 401/
  );
  assert.throws(
    () => parseProviderBalanceResponse({ error: "Invalid API key" }),
    /Invalid API key/
  );
  assert.throws(
    () => parseProviderBalanceResponse({ currency: "INR" }),
    /invalid balance field/
  );
});

test("returns the last verified balance as stale when a live refresh fails", async () => {
  const verifiedAt = new Date("2026-10-20T06:20:00.000Z");
  const snapshot = await resolveProviderBalanceSnapshot({
    cachedBalance: {
      balance: 672.06778,
      rawBalance: "672.0677800",
      currency: "INR",
      lastSyncAt: verifiedAt,
    },
    forceRefresh: true,
    refreshIntervalMs: DEFAULT_PROVIDER_BALANCE_REFRESH_INTERVAL_MS,
    now: new Date("2026-10-20T06:22:00.000Z"),
    fetchBalance: async () => { throw new Error("Provider timeout"); },
  });

  assert.equal(snapshot.success, true);
  assert.equal(snapshot.balance, 672.06778);
  assert.equal(snapshot.currency, "INR");
  assert.equal(snapshot.lastSyncAt, verifiedAt);
  assert.equal(snapshot.stale, true);
  assert.match(snapshot.warning || "", /last verified balance/i);
});

test("refreshes an expired cache and records the verification time", async () => {
  let fetchCount = 0;
  const verifiedAt = new Date("2026-10-20T06:22:03.000Z");
  const snapshot = await resolveProviderBalanceSnapshot({
    cachedBalance: {
      balance: 723.27482,
      rawBalance: "723.2748200",
      currency: "INR",
      lastSyncAt: new Date("2026-10-20T06:20:00.000Z"),
    },
    forceRefresh: false,
    refreshIntervalMs: 60_000,
    now: new Date("2026-10-20T06:22:00.000Z"),
    verifiedAt: () => verifiedAt,
    fetchBalance: async () => {
      fetchCount++;
      return parseProviderBalanceResponse({ balance: "672.0677800", currency: "INR" });
    },
  });

  assert.equal(fetchCount, 1);
  assert.equal(snapshot.balance, 672.06778);
  assert.equal(snapshot.currency, "INR");
  assert.equal(snapshot.lastSyncAt, verifiedAt);
  assert.equal(snapshot.cached, false);
  assert.equal(snapshot.stale, false);
});

test("serves a fresh verified cache without a redundant provider request", async () => {
  let fetchCount = 0;
  const verifiedAt = new Date("2026-10-20T06:22:00.000Z");
  const snapshot = await resolveProviderBalanceSnapshot({
    cachedBalance: {
      balance: 672.06778,
      rawBalance: "672.0677800",
      currency: "INR",
      lastSyncAt: verifiedAt,
    },
    forceRefresh: false,
    refreshIntervalMs: 60_000,
    now: new Date("2026-10-20T06:22:30.000Z"),
    fetchBalance: async () => {
      fetchCount++;
      return parseProviderBalanceResponse({ balance: "0", currency: "INR" });
    },
  });

  assert.equal(fetchCount, 0);
  assert.equal(snapshot.balance, 672.06778);
  assert.equal(snapshot.cached, true);
  assert.equal(snapshot.stale, false);
});

test("does not invent a balance when refresh fails and no verified value exists", async () => {
  const snapshot = await resolveProviderBalanceSnapshot({
    cachedBalance: null,
    forceRefresh: true,
    refreshIntervalMs: DEFAULT_PROVIDER_BALANCE_REFRESH_INTERVAL_MS,
    now: new Date("2026-10-20T06:22:00.000Z"),
    fetchBalance: async () => { throw new Error("Invalid API key"); },
  });

  assert.equal(snapshot.success, false);
  assert.equal(snapshot.balance, null);
  assert.equal(snapshot.currency, null);
  assert.equal(snapshot.stale, true);
});

test("uses the response currency as source of truth without converting cached INR", async () => {
  const snapshot = await resolveProviderBalanceSnapshot({
    cachedBalance: {
      balance: 672.06778,
      rawBalance: "672.0677800",
      currency: "INR",
      lastSyncAt: new Date("2026-10-20T06:20:00.000Z"),
    },
    forceRefresh: true,
    refreshIntervalMs: DEFAULT_PROVIDER_BALANCE_REFRESH_INTERVAL_MS,
    now: new Date("2026-10-20T06:22:00.000Z"),
    fetchBalance: async () => parseProviderBalanceResponse({ balance: "100.84292", currency: "USD" }),
  });

  assert.equal(snapshot.balance, 100.84292);
  assert.equal(snapshot.currency, "USD");
  assert.equal(formatProviderBalance(snapshot.balance, snapshot.currency), "$100.84292");
  assert.equal(snapshot.stale, false);
});

test("uses a bounded configurable refresh interval", () => {
  assert.equal(getProviderBalanceRefreshIntervalMs(undefined), 60_000);
  assert.equal(getProviderBalanceRefreshIntervalMs("30000"), 30_000);
  assert.equal(getProviderBalanceRefreshIntervalMs("1"), 10_000);
  assert.equal(getProviderBalanceRefreshIntervalMs("7200000"), 3_600_000);
  assert.equal(getProviderBalanceRefreshIntervalMs("bad"), 60_000);
});
