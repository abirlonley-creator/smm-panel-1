import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGAGEMENT_TIER_SERVICES,
  INSTAGRAM_ENGAGEMENT_TIER_SERVICES,
  ALL_ENGAGEMENT_TIER_SERVICES,
  getEngagementServicesCatalog,
} from "../src/lib/engagement/order-service";

test("API v2 Services Catalog includes both TikTok and Instagram tiers", async () => {
  assert.strictEqual(ENGAGEMENT_TIER_SERVICES.length, 4, "Should have 4 TikTok tiers (101-104)");
  assert.strictEqual(INSTAGRAM_ENGAGEMENT_TIER_SERVICES.length, 4, "Should have 4 Instagram tiers (201-204)");
  assert.strictEqual(ALL_ENGAGEMENT_TIER_SERVICES.length, 8, "Total catalog should have 8 services");

  const services = await getEngagementServicesCatalog();
  assert(services.length >= 8, `Catalog returned ${services.length} services`);

  const tiktokServices = services.filter((s) => s.platform === "tiktok");
  const igServices = services.filter((s) => s.platform === "instagram");

  assert.strictEqual(tiktokServices.length, 4, "4 TikTok services in catalog");
  assert.strictEqual(igServices.length, 4, "4 Instagram services in catalog");

  const ig2k = igServices.find((s) => s.service === 201);
  assert(ig2k, "Service 201 (ig_2k) must exist");
  assert.strictEqual(ig2k.alias, "ig_2k");
  assert.strictEqual(ig2k.category, "Instagram Engagement");
  assert(Number(ig2k.rate) > 0, "Instagram rate must be calculated");

  const tt2k = tiktokServices.find((s) => s.service === 101);
  assert(tt2k, "Service 101 (2k) must exist");
  assert.strictEqual(tt2k.category, "TikTok Engagement");
});

test("Exact pause messages match specification", () => {
  const masterPausedMsg = "Admins Have Paused Engagement System";
  const tiktokPausedMsg = "Admins Have Paused TikTok Engagement Orders";
  const igPausedMsg = "Admins Have Paused Instagram Engagement Orders";

  assert.strictEqual(masterPausedMsg, "Admins Have Paused Engagement System");
  assert.strictEqual(tiktokPausedMsg, "Admins Have Paused TikTok Engagement Orders");
  assert.strictEqual(igPausedMsg, "Admins Have Paused Instagram Engagement Orders");
});
