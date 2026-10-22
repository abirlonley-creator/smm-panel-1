import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ApifyTikTokAnalyticsAdapter,
  isTikTokVideoUrl,
  resolveAnalyticsAdapter,
} from "../src/lib/analytics/adapter";

const videoUrl = "https://www.tiktok.com/@example/video/7234567890123456789";
const capturedAt = new Date("2026-10-20T04:00:00.000Z");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("Apify input reads exactly one supplied TikTok video and parses documented counters", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const adapter = new ApifyTikTokAnalyticsAdapter({
    token: "test-secret",
    maxTotalChargeUsd: 0.5,
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return jsonResponse([{ id: "7234567890123456789", diggCount: 321, playCount: 98765, shareCount: 54 }]);
    },
  });

  const result = await adapter.getSnapshot(videoUrl, capturedAt);
  const endpoint = new URL(requestUrl);
  const requestBody = JSON.parse(String(requestInit?.body));

  assert.equal(result.available, true);
  assert.equal(result.likes, 321);
  assert.equal(result.views, 98765);
  assert.equal(result.shares, 54);
  assert.equal(result.capturedAt, capturedAt.toISOString());
  assert.equal(result.source, "APIFY_TIKTOK_SCRAPER");
  assert.equal(endpoint.pathname, "/v2/actors/clockworks~tiktok-scraper/run-sync-get-dataset-items");
  assert.equal(endpoint.searchParams.get("maxItems"), "1");
  assert.equal(endpoint.searchParams.get("maxTotalChargeUsd"), "0.5");
  assert.deepEqual(requestBody.postURLs, [videoUrl]);
  assert.equal(requestBody.scrapeRelatedVideos, false);
  assert.equal(requestBody.commentsPerPost, 0);
  assert.equal(requestBody.shouldDownloadVideos, false);
  assert.equal("hashtags" in requestBody, false);
  assert.equal((requestInit?.headers as Record<string, string>).Authorization, "Bearer test-secret");
});

test("Apify HTTP errors do not fall back to synthetic counts", async () => {
  const adapter = new ApifyTikTokAnalyticsAdapter({
    token: "test-secret",
    fetchImpl: async () => jsonResponse({ error: { message: "unauthorized" } }, 401),
  });

  const result = await adapter.getSnapshot(videoUrl, capturedAt);
  assert.equal(result.available, false);
  assert.equal(result.likes, null);
  assert.equal(result.views, null);
  assert.match(result.note || "", /HTTP 401/);
});

test("missing or malformed documented counters are unavailable", async () => {
  const adapter = new ApifyTikTokAnalyticsAdapter({
    token: "test-secret",
    fetchImpl: async () => jsonResponse([{ id: "7234567890123456789", diggCount: "321", playCount: 98765 }]),
  });

  const result = await adapter.getSnapshot(videoUrl, capturedAt);
  assert.equal(result.available, false);
  assert.equal(result.likes, null);
  assert.equal(result.views, null);
  assert.match(result.note || "", /missing valid diggCount or playCount/);
});

test("a result for a different TikTok video is rejected", async () => {
  const adapter = new ApifyTikTokAnalyticsAdapter({
    token: "test-secret",
    fetchImpl: async () => jsonResponse([{ id: "9999999999999999999", diggCount: 321, playCount: 98765 }]),
  });

  const result = await adapter.getSnapshot(videoUrl, capturedAt);
  assert.equal(result.available, false);
  assert.equal(result.likes, null);
  assert.match(result.note || "", /did not match/);
});

test("missing token and non-TikTok URLs do not invoke Apify", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls++;
    return jsonResponse([]);
  };
  const noToken = new ApifyTikTokAnalyticsAdapter({ token: "", fetchImpl });
  const noTokenResult = await noToken.getSnapshot(videoUrl, capturedAt);
  assert.equal(noTokenResult.available, false);
  assert.equal(calls, 0);

  const adapter = new ApifyTikTokAnalyticsAdapter({ token: "test-secret", fetchImpl });
  const invalidUrlResult = await adapter.getSnapshot("https://example.com/video/1", capturedAt);
  assert.equal(invalidUrlResult.available, false);
  assert.equal(calls, 0);
  assert.equal(isTikTokVideoUrl(videoUrl), true);
  assert.equal(isTikTokVideoUrl("https://vm.tiktok.com/ZMexample/"), true);
  assert.equal(isTikTokVideoUrl("https://www.tiktok.com/@example"), false);
  assert.equal(isTikTokVideoUrl("https://example.com/video/1"), false);
});

test("Apify timeout is explicitly unavailable and keeps the prior verified reading", async () => {
  const adapter = new ApifyTikTokAnalyticsAdapter({
    token: "test-secret",
    timeoutMs: 5,
    fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }),
  });

  const result = await adapter.getSnapshot(videoUrl, capturedAt);
  assert.equal(result.available, false);
  assert.equal(result.likes, null);
  assert.match(result.note || "", /timed out/);
  assert.match(result.note || "", /previous verified reading is retained/);
});

test("explicit Apify mode resolves to the real adapter while unavailable mode stays closed", () => {
  assert.equal(resolveAnalyticsAdapter({ ANALYTICS_DATA_SOURCE: "apify", APIFY_API_TOKEN: "test-secret" }).name, "APIFY_TIKTOK_SCRAPER");
  assert.equal(resolveAnalyticsAdapter({ ANALYTICS_DATA_SOURCE: "apify" }).name, "NO_APPROVED_ANALYTICS_SOURCE");
  assert.equal(resolveAnalyticsAdapter({ ANALYTICS_DATA_SOURCE: "none", APIFY_API_TOKEN: "test-secret" }).name, "NO_APPROVED_ANALYTICS_SOURCE");
});
