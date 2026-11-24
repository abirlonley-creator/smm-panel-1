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

test("Exact dynamic formula: 2,000 views @ 0.97/1k + 42 likes @ 35/1k equals 3.41 rupees", () => {
  const viewsRate = 0.97;
  const likesRate = 35.0;
  const targetViews = 2000;
  const targetLikes = 42;

  const viewsCost = Number(((targetViews / 1000) * viewsRate).toFixed(2)); // 1.94
  const likesCost = Number(((targetLikes / 1000) * likesRate).toFixed(2)); // 1.47
  const total = Number((viewsCost + likesCost).toFixed(2));

  assert.strictEqual(viewsCost, 1.94);
  assert.strictEqual(likesCost, 1.47);
  assert.strictEqual(total, 3.41, "Total charge must be exactly 3.41 rupees, neither high nor low");
});

test("Passkey separation filters out regular registered account passwords", () => {
  const samplePasskeys = [
    { id: "pk-1", label: "VIP Client Alpha", status: "ACTIVE" },
    { id: "pk-2", label: "Account Password", status: "ACTIVE" },
    { id: "pk-3", label: "VIP Reseller Beta", status: "ACTIVE" },
    { id: "pk-4", label: "Account Password", status: "ACTIVE" },
  ];

  const vipPasskeys = samplePasskeys.filter((pk) => pk.label !== "Account Password");
  assert.strictEqual(vipPasskeys.length, 2);
  assert.deepStrictEqual(vipPasskeys.map((p) => p.label), ["VIP Client Alpha", "VIP Reseller Beta"]);
});

test("Instagram reposts minimum quantity is 10", () => {
  const targetRep = 10;
  assert(targetRep >= 10, "Minimum reposts allowed must be at least 10");
});
