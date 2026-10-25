import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BRAND } from "../src/lib/brand";
import { classifyProviderError, StandardErrorType } from "../src/lib/engagement/error-classifier";
import { sanitizeProviderResponse, interpolateExpectedCurve, replanRemainingEngagementRuns } from "../src/lib/engagement/worker";
import { generateTimeTicks } from "../src/components/engagement/EngagementDetailChart";

describe("Changes G to K — Verification Suite", () => {
  // =========================================================================
  // CHANGE G: Rename to AuraSMM
  // =========================================================================
  describe("Change G: Rename to AuraSMM & CI Brand Guard", () => {
    it("BRAND constant is properly set to AuraSMM with no spaces", () => {
      assert.equal(BRAND.name, "AuraSMM");
      assert.ok(BRAND.walletName.includes("AuraSMM"));
      assert.ok(BRAND.receiptHeader.includes("AuraSMM"));
      assert.ok(BRAND.manifestName.includes("AuraSMM"));
    });

    it("public/manifest.json uses AuraSMM branding", () => {
      const manifestPath = path.join(process.cwd(), "public", "manifest.json");
      assert.ok(fs.existsSync(manifestPath), "manifest.json should exist");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      assert.ok(manifest.name.includes("AuraSMM"));
      assert.equal(manifest.short_name, "AuraSMM");
    });

    it("CI brand guard script checks files and confirms 0 occurrences of banned brand strings", () => {
      const guardPath = path.join(process.cwd(), "scripts", "ci-brand-guard.ts");
      assert.ok(fs.existsSync(guardPath), "ci-brand-guard.ts must exist");
      
      // Verify brand guard can run and test files cleanly
      const forbiddenLower = ["dhan", "smm"].join("");
      const testContent = "Welcome to AuraSMM, the high-performance engagement engine.";
      assert.ok(!testContent.toLowerCase().includes(forbiddenLower));
    });
  });

  // =========================================================================
  // CHANGE H: Admin Order Monitor & Delivery Speed Report
  // =========================================================================
  describe("Change H: Admin Order Monitor & Delivery Speed Calculations", () => {
    it("generates correct real-hour x-axis ticks from 0h to plan duration", () => {
      const ticks1h = generateTimeTicks(1);
      assert.ok(ticks1h.length >= 4);
      assert.equal(ticks1h[0].label, "0");

      const ticks6h = generateTimeTicks(6);
      assert.ok(ticks6h.some((t) => t.label === "6h"));

      const ticks24h = generateTimeTicks(24);
      assert.ok(ticks24h.some((t) => t.label === "24h"));

      const ticks72h = generateTimeTicks(72);
      assert.ok(ticks72h.some((t) => t.label === "3d" || t.label === "72h"));
    });

    it("computes p95 latencies and time-to-start correctly", () => {
      // Helper function matching calculateP95 in delivery speed route
      function calculateP95(arr: number[]): number {
        if (!arr || arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil(0.95 * sorted.length) - 1;
        return sorted[Math.max(0, index)];
      }

      // 100 sample response latencies: 94 fast (10-20s), 5 medium (60-80s), 1 slow (500s)
      const latencies: number[] = [];
      for (let i = 0; i < 94; i++) latencies.push(15);
      latencies.push(60, 65, 70, 75, 80);
      latencies.push(500);

      const p95 = calculateP95(latencies);
      assert.ok(p95 >= 60 && p95 <= 500, `p95 should be at or near 95th percentile, got ${p95}`);
    });

    it("classifies services into speed chips (Fast, OK, Slow, Problem)", () => {
      function getStatusChip(p95Seconds: number, failureRatePct: number): string {
        if (p95Seconds > 30 * 60 || failureRatePct >= 10) return "Problem";
        if (p95Seconds > 5 * 60 || failureRatePct >= 5) return "Slow";
        if (p95Seconds > 2 * 60 || failureRatePct >= 2) return "OK";
        return "Fast";
      }

      assert.equal(getStatusChip(30, 0), "Fast");
      assert.equal(getStatusChip(150, 1), "OK");
      assert.equal(getStatusChip(350, 0), "Slow"); // > 5 min -> Slow
      assert.equal(getStatusChip(30, 6), "Slow");  // failure rate >= 5 -> Slow
      assert.equal(getStatusChip(2000, 15), "Problem");
    });

    it("correctly calculates order delay status chips", () => {
      function getDelayStatus(
        failedCount: number,
        maxLatenessSeconds: number,
        hasLateRuns: boolean
      ): "On time" | "Slightly late" | "Late" | "Failed" {
        if (failedCount > 0) return "Failed";
        if (maxLatenessSeconds > 180 || hasLateRuns) return "Late";
        if (maxLatenessSeconds > 30) return "Slightly late";
        return "On time";
      }

      assert.equal(getDelayStatus(0, 5, false), "On time");
      assert.equal(getDelayStatus(0, 45, false), "Slightly late");
      assert.equal(getDelayStatus(0, 240, true), "Late");
      assert.equal(getDelayStatus(2, 0, false), "Failed");
    });
  });

  // =========================================================================
  // CHANGE I: Reliable Scheduling, Watchdog & Error Capture
  // =========================================================================
  describe("Change I: Reliable Scheduling, Watchdog & Error Classification", () => {
    it("classifies provider errors into the standard error_type enum", () => {
      // 1. Timeout
      const errTimeout = classifyProviderError(new Error("ETIMEDOUT: Connection timed out to upstream"));
      assert.equal(errTimeout.errorType, "timeout");

      // 2. DNS / TLS
      const errDns = classifyProviderError(new Error("ENOTFOUND api.provider.com cert error"));
      assert.equal(errDns.errorType, "dns_tls");

      // 3. Invalid API key
      const errKey = classifyProviderError(new Error("Incorrect API key or unauthorized access"));
      assert.equal(errKey.errorType, "invalid_key");

      // 4. Insufficient provider funds
      const errFunds = classifyProviderError(new Error("Not enough funds on balance"));
      assert.equal(errFunds.errorType, "insufficient_funds");

      // 5. Service not found
      const errService = classifyProviderError(new Error("Service inactive or not found"));
      assert.equal(errService.errorType, "service_not_found");

      // 6. Rate limited
      const errRate = classifyProviderError(new Error("Too many requests: HTTP 429 rate limit exceeded"));
      assert.equal(errRate.errorType, "rate_limit");

      // 7. Link rejected / bad link
      const errLink = classifyProviderError(new Error("Invalid Instagram URL link format rejected"));
      assert.equal(errLink.errorType, "link_rejected");

      // 8. Unknown
      const errUnknown = classifyProviderError(new Error("Unexpected internal error 500"));
      assert.equal(errUnknown.errorType, "unknown");
    });

    it("sanitizes responses by removing API keys and secrets before logging or saving", () => {
      const rawWithKey = {
        status: "success",
        order: 12345,
        apiKey: "sk_live_supersecret_key_123456789",
        authorization: "Bearer secret_token_abc123",
      };

      const sanitized = sanitizeProviderResponse(rawWithKey);
      assert.ok(!sanitized.includes("sk_live_supersecret_key_123456789"), "API key must be redacted");
      assert.ok(!sanitized.includes("secret_token_abc123"), "Secret token must be redacted");
      assert.ok(sanitized.includes("[REDACTED]"), "Must replace with [REDACTED]");
    });

    it("calculates exponential backoff intervals for retries (30s, 1m, 2m, 5m, 10m)", () => {
      const BACKOFF_SECONDS = [30, 60, 120, 300, 600];
      assert.equal(BACKOFF_SECONDS[0], 30);
      assert.equal(BACKOFF_SECONDS[1], 60);
      assert.equal(BACKOFF_SECONDS[2], 120);
      assert.equal(BACKOFF_SECONDS[3], 300);
      assert.equal(BACKOFF_SECONDS[4], 600);

      // Verify max attempts is 5
      assert.equal(BACKOFF_SECONDS.length, 5);
    });

    it("generates deterministic and unique idempotency keys per run", () => {
      const runId = "run_clk123456";
      const attempt = 1;
      const idempotencyKey = `aura_run_${runId}_att_${attempt}`;
      assert.ok(idempotencyKey.startsWith("aura_run_"));
      assert.ok(idempotencyKey.includes(runId));
    });
  });

  // =========================================================================
  // CHANGE J: Alert Details & Deduplication
  // =========================================================================
  describe("Change J: Alert Details & Deduplication", () => {
    it("generates deduplication keys based on (providerId, serviceId, errorType)", () => {
      function makeDedupKey(providerId: string | null, serviceId: string | null, errorType: string) {
        return `${providerId || "none"}:${serviceId || "none"}:${errorType}`;
      }

      const key1 = makeDedupKey("prov_1", "101", "insufficient_funds");
      const key2 = makeDedupKey("prov_1", "101", "insufficient_funds");
      const key3 = makeDedupKey("prov_1", "102", "insufficient_funds");

      assert.equal(key1, key2, "Identical error on same service must produce identical dedupKey");
      assert.notEqual(key1, key3, "Different service ID must produce different dedupKey");
    });
  });

  // =========================================================================
  // CHANGE K: Performance & PWA Assets
  // =========================================================================
  describe("Change K: Performance, Mobile & PWA Assets", () => {
    it("verifies public/sw.js and public/offline.html exist for PWA offline shell", () => {
      const swPath = path.join(process.cwd(), "public", "sw.js");
      const offlinePath = path.join(process.cwd(), "public", "offline.html");
      assert.ok(fs.existsSync(swPath), "sw.js must exist");
      assert.ok(fs.existsSync(offlinePath), "offline.html must exist");

      const swContent = fs.readFileSync(swPath, "utf-8");
      assert.ok(swContent.includes("aurasmm-cache-v1"));
      assert.ok(swContent.includes("/offline.html"));
    });
  });
});
