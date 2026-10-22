import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateLikeDrivenViewBatch,
  MAX_LIKE_VIEW_RATIO,
  MIN_LIKE_VIEW_RATIO,
} from "../src/lib/monitoring/batch-calculator";

test("1 to 2 likes gives 100 to 200 views even when ratio calculation is below provider minimum", () => {
  const limits = { providerMinQuantity: 100, providerMaxQuantity: 50000, availableQuantity: 50000 };

  const oneLikeMin = calculateLikeDrivenViewBatch(1, limits, () => 0);
  const oneLikeMax = calculateLikeDrivenViewBatch(1, limits, () => 1);
  assert.equal(oneLikeMin.batchQuantity, 100);
  assert.equal(oneLikeMin.minimumApplied, true);
  assert.equal(oneLikeMax.batchQuantity, 150);
  assert.equal(oneLikeMax.minimumApplied, true);

  const twoLikesMin = calculateLikeDrivenViewBatch(2, limits, () => 0);
  const twoLikesMax = calculateLikeDrivenViewBatch(2, limits, () => 1);
  assert.equal(twoLikesMin.batchQuantity, 140);
  assert.equal(twoLikesMin.minimumApplied, true);
  assert.equal(twoLikesMax.batchQuantity, 200);
  assert.equal(twoLikesMax.minimumApplied, true);

  // Both are within 100 to 200 views
  for (const b of [oneLikeMin, oneLikeMax, twoLikesMin, twoLikesMax]) {
    assert.ok(b.batchQuantity >= 100);
    assert.ok(b.batchQuantity <= 200);
    assert.ok(b.batchQuantity >= limits.providerMinQuantity);
  }
});

test("6 to 7 likes calculates 250 to 300 views", () => {
  const limits = { providerMinQuantity: 100, providerMaxQuantity: 50000, availableQuantity: 50000 };

  const sixLikes = calculateLikeDrivenViewBatch(6, limits, () => 0.5);
  // 6 likes at ~2.35% = 255 views (within 240-275 range)
  assert.ok(sixLikes.batchQuantity >= 240 && sixLikes.batchQuantity <= 275);
  assert.equal(sixLikes.minimumApplied, false);

  const sevenLikes = calculateLikeDrivenViewBatch(7, limits, () => 0.5);
  // 7 likes at ~2.35% = 298 views (within 280-320 range)
  assert.ok(sevenLikes.batchQuantity >= 280 && sevenLikes.batchQuantity <= 320);
  assert.equal(sevenLikes.minimumApplied, false);
});

test("provider and session caps are strictly enforced", () => {
  const limits = { providerMinQuantity: 100, providerMaxQuantity: 3000, availableQuantity: 3000 };
  const largeBatch = calculateLikeDrivenViewBatch(100, limits, () => 0.5);
  assert.equal(largeBatch.batchQuantity, 3000);
  assert.ok(largeBatch.actualLikeViewRatio! >= MIN_LIKE_VIEW_RATIO);
  assert.ok(largeBatch.actualLikeViewRatio! <= MAX_LIKE_VIEW_RATIO);

  // When available budget is less than provider minimum, batch is rejected with explanation
  const lowAvailable = calculateLikeDrivenViewBatch(1, { ...limits, availableQuantity: 50 }, () => 0.5);
  assert.equal(lowAvailable.batchQuantity, 0);
  assert.match(lowAvailable.skipReason || "", /provider minimum/);
});

test("skip rule skips when raw calculation is below provider minimum", () => {
  const belowMinSkip = calculateLikeDrivenViewBatch(
    10,
    { providerMinQuantity: 1000, providerMaxQuantity: 50000, availableQuantity: 50000 },
    () => 0.5,
    "skip",
  );
  assert.equal(belowMinSkip.batchQuantity, 0);
  assert.match(belowMinSkip.skipReason || "", /provider minimum/);
});
