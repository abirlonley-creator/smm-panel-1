import { prisma } from "../src/lib/prisma";
import { normalizeTargetUrl, validateUrlForService } from "../src/lib/urls/normalizer";
import { resolveTargetUrl } from "../src/lib/urls/tiktok-resolver";
import {
  generateRandomizedQuantities,
  recalculateOrderQuantitiesTotal,
} from "../src/lib/randomizer/distributor";
import {
  validateBulkOrderLinks,
  submitBulkOrders,
} from "../src/lib/orders/bulk-service";
import {
  createCombo,
  getComboById,
  listCombos,
  updateCombo,
  duplicateCombo,
  deleteCombo,
  executeCombo,
  retryFailedComboChildOrders,
} from "../src/lib/combos/combo-service";
import {
  scheduleOrderJob,
  runScheduledJobsTick,
  cancelScheduledJob,
  pauseScheduledJob,
  resumeScheduledJob,
  editScheduledJobTime,
} from "../src/lib/scheduler/job-runner";

let passed = 0;
let failed = 0;

let activeAssert = function (condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✔ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
};

export async function runEnhancementTests(customAssert?: (cond: boolean, name: string, detail?: string) => void) {
  const assert = customAssert || activeAssert;
  console.log("\n=======================================================");
  console.log("   AURASMM NEW ORDER ENHANCEMENTS TEST SUITE");
  console.log("   Bulk Add • Randomizer • Combo Maker • Persistent Scheduler");
  console.log("=======================================================\n");

  // Ensure mock sandbox is active for automated testing so we don't submit live orders
  const existingConfig = await prisma.providerConfig.findFirst({ where: { active: true } });
  const originalIsMock = existingConfig?.isMock ?? true;
  if (existingConfig) {
    await prisma.providerConfig.update({
      where: { id: existingConfig.id },
      data: { isMock: true },
    });
  }

  try {
  let tiktokService = await prisma.service.findFirst({
    where: { platform: "TikTok", category: "Likes", minQuantity: { lte: 50 }, maxQuantity: { gte: 1000 }, active: true },
  });
  if (!tiktokService) {
    tiktokService = await prisma.service.create({
      data: {
        externalId: "mock_tiktok_302",
        name: "TikTok Video Likes — Fast & Safe",
        platform: "TikTok",
        category: "Likes",
        description: "Fast delivery TikTok video likes",
        minQuantity: 50,
        maxQuantity: 50000,
        ratePer1000: 0.95,
        active: true,
        isMock: true,
      },
    });
  }

  let igLikesService = await prisma.service.findFirst({
    where: { platform: "Instagram", category: "Likes", active: true },
  });
  if (!igLikesService) {
    igLikesService = await prisma.service.create({
      data: {
        externalId: "mock_ig_likes_101",
        name: "Instagram Likes — Instant & Natural Pace",
        platform: "Instagram",
        category: "Likes",
        description: "High quality Instagram likes",
        minQuantity: 20,
        maxQuantity: 25000,
        ratePer1000: 0.85,
        active: true,
        isMock: true,
      },
    });
  }

  let igFollowersService = await prisma.service.findFirst({
    where: { platform: "Instagram", category: "Followers", active: true },
  });
  if (!igFollowersService) {
    igFollowersService = await prisma.service.create({
      data: {
        externalId: "mock_ig_followers_1",
        name: "Instagram Followers — High Quality / Non-Drop",
        platform: "Instagram",
        category: "Followers",
        description: "Real Instagram followers",
        minQuantity: 50,
        maxQuantity: 10000,
        ratePer1000: 0.90,
        active: true,
        isMock: true,
      },
    });
  }

  // =========================================================================
  // SUITE 1: URL NORMALIZATION & BULK ADD
  // =========================================================================
  console.log("Test Suite 10: URL Normalization & Link Checker");

  // Test 10.1: Preserving distinct TikTok video IDs from same creator
  const ttVid1 = "https://www.tiktok.com/@creator/video/7123456789012345678?is_from_webapp=1&sender_device=pc";
  const ttVid2 = "https://www.tiktok.com/@creator/video/7987654321098765432?is_from_webapp=1";
  const norm1 = normalizeTargetUrl(ttVid1);
  const norm2 = normalizeTargetUrl(ttVid2);

  assert(norm1.isValid && norm2.isValid, "Both TikTok video URLs parse as valid");
  assert(norm1.contentId === "7123456789012345678", "Correctly extracts TikTok video ID 1");
  assert(norm2.contentId === "7987654321098765432", "Correctly extracts TikTok video ID 2");
  assert(
    norm1.canonicalKey !== norm2.canonicalKey,
    "Two different videos from the same creator have distinct canonical keys (never treated as duplicates)"
  );
  assert(
    !norm1.normalizedUrl.includes("is_from_webapp"),
    "Strips tracking query parameters from normalized URL"
  );

  // Test 10.2: Mobile embed & shortlinks
  const ttMobile = normalizeTargetUrl("https://m.tiktok.com/v/7123456789012345678.html");
  assert(ttMobile.contentId === "7123456789012345678", "Extracts video ID from mobile embed URL");
  assert(ttMobile.canonicalKey === norm1.canonicalKey, "Mobile embed resolves to identical canonical video key");

  const ttEmbed = normalizeTargetUrl("https://www.tiktok.com/embed/v2/7123456789012345678");
  assert(ttEmbed.canonicalKey === norm1.canonicalKey, "Embed v2 URL resolves to identical canonical video key");

  const ttPhoto = normalizeTargetUrl("https://www.tiktok.com/@creator/photo/7123456789012345679");
  assert(ttPhoto.isPost && ttPhoto.contentType === "post", "Recognizes TikTok photo posts as content posts");
  assert(ttPhoto.canonicalKey === "tiktok:photo:7123456789012345679", "Photo post uses its own canonical identity");

  const ttShort = normalizeTargetUrl("https://www.tiktok.com/t/ZTabc123/");
  assert(ttShort.requiresResolution, "Marks /t/ TikTok share links for resolution");
  assert(ttShort.contentType === "shortlink", "Classifies TikTok /t/ share links as shortlinks");

  const ttProfile = normalizeTargetUrl("https://www.tiktok.com/@creator");
  assert(!ttProfile.isPost && ttProfile.contentType === "profile", "Classifies TikTok profile links as profiles");

  const spoofedHost = normalizeTargetUrl("https://tiktok.com.evil.example/@creator/video/7123456789012345678");
  assert(spoofedHost.platform !== "TikTok", "Rejects lookalike domains that merely contain tiktok.com");

  const resolvedShort = await resolveTargetUrl("https://vt.tiktok.com/ZMtest123/", {
    fetchImpl: (async () =>
      new Response(null, {
        status: 302,
        headers: {
          location: "https://www.tiktok.com/@creator/video/7987654321098765432?is_from_webapp=1",
        },
      })) as unknown as typeof fetch,
  });
  assert(resolvedShort.isValid && resolvedShort.isPost, "Resolves vt.tiktok.com short link to a canonical post");
  assert(
    resolvedShort.canonicalKey === "tiktok:video:7987654321098765432",
    "Resolved short link keeps the real video identity"
  );
  assert(!resolvedShort.requiresResolution, "Resolved short link no longer requires resolution");

  const unsafeShort = await resolveTargetUrl("https://vm.tiktok.com/ZMunsafe/", {
    fetchImpl: (async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/redirected" },
      })) as unknown as typeof fetch,
  });
  assert(!unsafeShort.isValid, "Rejects short-link redirects to untrusted hosts (SSRF protection)");
  assert(
    Boolean(unsafeShort.error?.toLowerCase().includes("untrusted")),
    "Explains why the unsafe redirect was rejected"
  );

  // Test 10.3: Malformed & unsupported links
  const invalidUrl = normalizeTargetUrl("not-a-valid-url-at-all");
  assert(!invalidUrl.isValid, "Correctly identifies malformed URL string");

  const serviceCompat = validateUrlForService("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "TikTok");
  assert(!serviceCompat.valid, "Rejects YouTube URL when TikTok service is selected");

  console.log("\nTest Suite 11: Bulk Add Validation & Submission");

  // Test 11.1: Bulk Links Parsing with blank lines, duplicates, and active orders
  // First, create an active order in DB to test duplicate active order detection
  const activeExistingOrder = await prisma.order.create({
    data: {
      orderRef: `SMM-ACTIVE-${Date.now()}`,
      serviceId: tiktokService.id,
      targetUrl: "https://www.tiktok.com/@testuser/video/7000000000000000001",
      requestedQuantity: 500,
      submittedQuantity: 500,
      deliveredQuantity: 0,
      remainingQuantity: 500,
      failedQuantity: 0,
      unitCost: 0.0008,
      totalCost: 0.4,
      status: "PROCESSING",
    },
  });

  const rawPastedLinks = `
    https://www.tiktok.com/@creator/video/7111111111111111111

    https://www.tiktok.com/@creator/video/7111111111111111111?ref=share
    https://www.tiktok.com/@creator/video/7222222222222222222
    https://www.tiktok.com/@testuser/video/7000000000000000001
    invalid_garbage_link_here
  `;

  const bulkSummary = await validateBulkOrderLinks(rawPastedLinks, tiktokService.id, 500);

  assert(bulkSummary.totalRows === 5, "Counts exactly 5 non-empty lines (ignoring blank lines)");
  assert(bulkSummary.validRows === 2, "Identifies exactly 2 valid ready-to-submit rows");
  assert(bulkSummary.duplicateRows === 1, "Detects 1 duplicate within this batch");
  assert(bulkSummary.activeOrderRows === 1, "Detects 1 existing active order already in progress");
  assert(bulkSummary.invalidRows === 1, "Detects 1 invalid URL row");

  // Test 11.2: Quantity validation in bulk add (below min / above max)
  const qtyCheck = await validateBulkOrderLinks(
    "https://www.tiktok.com/@creator/video/7333333333333333333",
    tiktokService.id,
    10 // below minQuantity of 100
  );
  assert(qtyCheck.rows[0].status === "INVALID_QUANTITY", "Flags row with quantity below service minimum");

  const profileBulk = await validateBulkOrderLinks(
    "https://www.tiktok.com/@creator",
    tiktokService.id,
    500
  );
  assert(
    profileBulk.rows[0].status === "UNSUPPORTED_LINK",
    "Rejects TikTok profile links for video metrics services that require a post"
  );

  const photoBulk = await validateBulkOrderLinks(
    "https://www.tiktok.com/@creator/photo/7333333333333333344",
    tiktokService.id,
    500
  );
  assert(photoBulk.rows[0].status === "VALID", "Accepts TikTok photo post links for content services");

  // Test 11.3: Bulk Submission Execution with partial outcomes
  const bulkSubmitRes = await submitBulkOrders({
    serviceId: tiktokService.id,
    rows: [
      { rawUrl: "https://www.tiktok.com/@user1/video/7000000000000000010", quantity: 200 },
      { rawUrl: "https://www.tiktok.com/@user2/video/7000000000000000020", quantity: 300 },
      { rawUrl: "https://www.tiktok.com/@user3/video/7000000000000000030", quantity: 10 }, // will fail quantity
    ],
  });

  assert(bulkSubmitRes.batchId !== "", "Creates BulkBatch container in database");
  assert(bulkSubmitRes.totalOrders === 3, "BulkBatch tracks 3 total orders");
  assert(bulkSubmitRes.successOrders === 2, "2 orders submitted successfully to provider");
  assert(bulkSubmitRes.failedOrders === 1, "1 order recorded as failed without double charge");
  assert(bulkSubmitRes.outcomes.length === 3, "Returns individual outcome for every row in the batch");

  // Test 11.4: Double-click submission protection
  let doubleClickCaught = false;
  const token = `token-${Date.now()}`;
  const promise1 = submitBulkOrders({
    serviceId: tiktokService.id,
    rows: [{ rawUrl: "https://www.tiktok.com/@user/video/7000000000000000040", quantity: 200 }],
    idempotencyToken: token,
  });
  try {
    await submitBulkOrders({
      serviceId: tiktokService.id,
      rows: [{ rawUrl: "https://www.tiktok.com/@user/video/7000000000000000040", quantity: 200 }],
      idempotencyToken: token,
    });
  } catch (err: any) {
    if (err.message.includes("already currently processing")) {
      doubleClickCaught = true;
    }
  }
  await promise1;
  assert(doubleClickCaught, "Double-click submission token prevents concurrent duplicate batch processing");

  // Clean up test active order
  await prisma.order.delete({ where: { id: activeExistingOrder.id } }).catch(() => {});

  // =========================================================================
  // SUITE 2: ORDER QUANTITY RANDOMIZER
  // =========================================================================
  console.log("\nTest Suite 12: Order Quantity Randomizer Engine");

  // Test 12.1: Bounded variance around target average
  const randResult = generateRandomizedQuantities({
    averageQuantity: 1200,
    rowCount: 6,
    minQuantity: 100,
    maxQuantity: 5000,
    variationPercent: 15,
    seed: 42,
  });

  assert(randResult.quantities.length === 6, "Generates exactly 6 randomized quantities");
  assert(
    randResult.quantities.every((q) => q >= 100 && q <= 5000),
    "All generated quantities respect service min/max boundaries strictly"
  );
  const allIdentical = randResult.quantities.every((q) => q === randResult.quantities[0]);
  assert(!allIdentical, "Generated quantities vary naturally around average (not static)");

  // Test 12.2: Reproducible results with fixed test seed
  const randRepeat = generateRandomizedQuantities({
    averageQuantity: 1200,
    rowCount: 6,
    minQuantity: 100,
    maxQuantity: 5000,
    variationPercent: 15,
    seed: 42,
  });
  const exactSeedMatch = randResult.quantities.every((q, i) => q === randRepeat.quantities[i]);
  assert(exactSeedMatch, "Identical seed produces 100% reproducible byte-for-byte outputs");

  // Test 12.3: Exact Total Preservation Mode
  const exactResult = generateRandomizedQuantities({
    averageQuantity: 1000,
    rowCount: 5,
    minQuantity: 100,
    maxQuantity: 3000,
    variationPercent: 20,
    preserveExactTotal: true,
    targetTotal: 5000,
    seed: 1234,
  });
  const actualSum = exactResult.quantities.reduce((a, b) => a + b, 0);
  assert(actualSum === 5000, "Exact total mode strictly preserves total sum (5,000 units)", `Got ${actualSum}`);
  assert(
    exactResult.quantities.every((q) => q >= 100 && q <= 3000),
    "Exact total mode respects row minimums and maximums"
  );

  // Test 12.4: Manual edit recalculation
  const editedQuantities = [1200, 1150, 1300, 950];
  const recalc = recalculateOrderQuantitiesTotal(editedQuantities);
  assert(recalc.total === 4600, "Recalculates total immediately from manual edits (4,600 units)");
  assert(recalc.average === 1150, "Recalculates average immediately (1,150 units)");

  // =========================================================================
  // SUITE 3: COMBO MAKER
  // =========================================================================
  console.log("\nTest Suite 13: Combo Maker & Execution");

  // Test 13.1: Enforce 2 to 5 distinct services
  let rejectedSingleService = false;
  try {
    await createCombo({
      name: "Too Few Services",
      items: [{ serviceId: igLikesService.id, defaultQuantity: 100 }],
    });
  } catch (err: any) {
    if (err.message.includes("at least 2 distinct services")) rejectedSingleService = true;
  }
  assert(rejectedSingleService, "Rejects combo definition with fewer than 2 services");

  let rejectedDuplicateService = false;
  try {
    await createCombo({
      name: "Duplicate Services",
      items: [
        { serviceId: igLikesService.id, defaultQuantity: 100 },
        { serviceId: igLikesService.id, defaultQuantity: 200 },
      ],
    });
  } catch (err: any) {
    if (err.message.includes("Duplicate service selected")) rejectedDuplicateService = true;
  }
  assert(rejectedDuplicateService, "Rejects combo definition with duplicate service selections");

  // Test 13.2: Create valid 3-service combo
  const validCombo = await createCombo({
    name: "Instagram Growth Bundle (Likes + Followers)",
    description: "Coordinated likes and followers package",
    items: [
      { serviceId: igLikesService.id, defaultQuantity: 500, targetType: "SAME_URL" },
      { serviceId: igFollowersService.id, defaultQuantity: 200, targetType: "SAME_URL" },
    ],
  });

  assert(validCombo !== null, "Successfully creates and persists Combo in database");
  assert(Boolean(validCombo?.comboRef?.startsWith("CMB-")), "Assigns distinct comboRef (e.g. CMB-XXXXXX)");
  assert(validCombo?.items.length === 2, "Combo contains exactly 2 distinct services");

  // Test 13.3: Duplicate combo
  const duplicated = await duplicateCombo(validCombo!.id);
  assert(Boolean(duplicated?.name?.includes("(Copy)")), "Duplicated combo appends (Copy) name");
  assert(duplicated?.comboRef !== validCombo?.comboRef, "Duplicated combo gets unique new comboRef");
  await deleteCombo(duplicated!.id);

  // Test 13.4: Combo Execution: creates parent ComboExecution and child Orders
  const comboExecResult = await executeCombo({
    comboId: validCombo!.id,
    targetUrl: "https://www.instagram.com/p/C_testPost123/",
  });

  assert(comboExecResult.success, "Combo execution succeeds");
  assert(comboExecResult.executionRef.startsWith("CMBX-"), "Creates parent ComboExecution with executionRef");
  assert(comboExecResult.childOrders.length === 2, "Creates exactly one child order per configured service");
  assert(
    comboExecResult.childOrders.every((c) => c.status === "PROCESSING" && c.providerOrderId),
    "Each child order is independently submitted to provider with external reference"
  );

  // Test 13.5: Retry failed child orders without duplicating accepted orders
  // Simulate one child order failing
  const failedChild = await prisma.order.create({
    data: {
      orderRef: `SMM-FAIL-${Date.now()}`,
      serviceId: igLikesService.id,
      targetUrl: "https://www.instagram.com/p/C_testPost123/",
      requestedQuantity: 500,
      submittedQuantity: 0,
      deliveredQuantity: 0,
      remainingQuantity: 500,
      failedQuantity: 500,
      unitCost: 0.0012,
      totalCost: 0.6,
      status: "FAILED",
      providerOrderId: null,
      comboExecutionId: comboExecResult.executionId,
      errorMessage: "Simulated transient failure",
    },
  });

  const retryRes = await retryFailedComboChildOrders(comboExecResult.executionId);
  assert(retryRes.retriedCount === 1, "Retry targets only the failed unaccepted child order");
  assert(retryRes.newlySucceeded === 1, "Failed child order accepted upon retry");

  // Verify accepted orders were untouched
  const childOrdersInDb = await prisma.order.findMany({
    where: { comboExecutionId: comboExecResult.executionId },
  });
  const acceptedOrdersCount = childOrdersInDb.filter((o) => o.status === "PROCESSING").length;
  assert(acceptedOrdersCount >= 2, "All child orders now active without duplicates");

  // =========================================================================
  // SUITE 4: PERSISTENT ORDER SCHEDULER
  // =========================================================================
  console.log("\nTest Suite 14: Persistent Order Scheduler (Worker-Backed Execution)");

  // Test 14.1: Future execution scheduling persisted in database
  const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  const scheduledJob = await scheduleOrderJob({
    jobType: "SINGLE",
    scheduledFor: futureDate,
    timezone: "America/New_York",
    payload: {
      serviceId: tiktokService.id,
      targetUrl: "https://www.tiktok.com/@scheduled/video/7888888888888888888",
      requestedQuantity: 500,
    },
  });

  assert(scheduledJob.id !== "", "Scheduled job persisted in database");
  assert(scheduledJob.status === "SCHEDULED", "Initial state is SCHEDULED");
  assert(scheduledJob.timezone === "America/New_York", "Originating user timezone stored");
  assert(
    new Date(scheduledJob.scheduledFor).getTime() === futureDate.getTime(),
    "Intended execution timestamp stored in UTC"
  );

  // Test 14.2: Scheduler tick does NOT process jobs whose scheduledFor is in the future
  const tickFuture = await runScheduledJobsTick();
  const refreshedJob = await prisma.scheduledOrderJob.findUnique({ where: { id: scheduledJob.id } });
  assert(
    refreshedJob?.status === "SCHEDULED",
    "Future job remains SCHEDULED and untouched before due time"
  );

  // Test 14.3: Pause and Resume
  await pauseScheduledJob(scheduledJob.id);
  const pausedJob = await prisma.scheduledOrderJob.findUnique({ where: { id: scheduledJob.id } });
  assert(pausedJob?.status === "PAUSED", "Scheduled job transitioned to PAUSED");

  await resumeScheduledJob(scheduledJob.id);
  const resumedJob = await prisma.scheduledOrderJob.findUnique({ where: { id: scheduledJob.id } });
  assert(resumedJob?.status === "SCHEDULED", "Paused job restored to SCHEDULED");

  // Test 14.4: Edit scheduled execution time
  const newFutureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await editScheduledJobTime(scheduledJob.id, newFutureDate);
  const editedJob = await prisma.scheduledOrderJob.findUnique({ where: { id: scheduledJob.id } });
  assert(
    new Date(editedJob!.scheduledFor).getTime() === newFutureDate.getTime(),
    "Scheduled execution time updated successfully"
  );

  // Test 14.5: Execution when job becomes due (Independent of browser)
  // Set scheduledFor to past to simulate due time
  const duePastDate = new Date(Date.now() - 5000);
  await prisma.scheduledOrderJob.update({
    where: { id: scheduledJob.id },
    data: { scheduledFor: duePastDate },
  });

  const dueTick = await runScheduledJobsTick();
  assert(dueTick.processedJobs >= 1, "Background worker claims and processes due job");

  const completedJob = await prisma.scheduledOrderJob.findUnique({
    where: { id: scheduledJob.id },
    include: { orders: true },
  });
  assert(completedJob?.status === "COMPLETED", "Scheduled job status updated to COMPLETED");
  assert(completedJob?.orders.length === 1, "Creates real linked order upon scheduled execution");
  assert(completedJob?.orders[0].providerOrderId !== null, "Real provider order created for scheduled job");

  // Test 14.6: Concurrent worker race condition safety (atomic claim)
  const raceJob = await scheduleOrderJob({
    jobType: "SINGLE",
    scheduledFor: new Date(Date.now() - 1000), // immediately due
    payload: {
      serviceId: tiktokService.id,
      targetUrl: "https://www.tiktok.com/@race/video/7999999999999999999",
      requestedQuantity: 200,
    },
  });

  // Launch two concurrent ticks simultaneously
  const [raceTick1, raceTick2] = await Promise.all([
    runScheduledJobsTick(),
    runScheduledJobsTick(),
  ]);

  const raceOrders = await prisma.order.findMany({
    where: { scheduledJobId: raceJob.id },
  });
  assert(
    raceOrders.length === 1,
    "Atomic row lock claim ensures scheduled job is executed exactly once across concurrent workers (no duplicate orders)",
    `Got ${raceOrders.length}`
  );

  // Test 14.7: User Cancellation before execution
  const cancelJob = await scheduleOrderJob({
    jobType: "SINGLE",
    scheduledFor: new Date(Date.now() + 3600000),
    payload: {
      serviceId: tiktokService.id,
      targetUrl: "https://www.tiktok.com/@cancel/video/7000000000000000099",
      requestedQuantity: 100,
    },
  });

  await cancelScheduledJob(cancelJob.id);
  const cancelledJob = await prisma.scheduledOrderJob.findUnique({ where: { id: cancelJob.id } });
  assert(cancelledJob?.status === "CANCELLED", "User can cancel job before execution");

  // Ensure cancelled job is never picked up even if time passes
  await prisma.scheduledOrderJob.update({
    where: { id: cancelJob.id },
    data: { scheduledFor: new Date(Date.now() - 5000) },
  });
  await runScheduledJobsTick();
  const cancelledStill = await prisma.scheduledOrderJob.findUnique({ where: { id: cancelJob.id } });
  assert(cancelledStill?.status === "CANCELLED", "Worker strictly ignores CANCELLED jobs");

  // Test 14.8: Scheduled Combo Execution
  const scheduledCombo = await scheduleOrderJob({
    jobType: "COMBO",
    scheduledFor: new Date(Date.now() - 1000), // due
    payload: {
      comboId: validCombo!.id,
      targetUrl: "https://www.instagram.com/p/C_scheduledCombo123/",
    },
  });
  await runScheduledJobsTick();
  const finishedComboJob = await prisma.scheduledOrderJob.findUnique({
    where: { id: scheduledCombo.id },
  });
  assert(finishedComboJob?.status === "COMPLETED", "Scheduler executes scheduled COMBO bundle automatically");

  // =========================================================================
  // SUITE 15: COMBINED FEATURE WORKFLOW
  // (Combo Maker + Bulk Add + Randomizer + Scheduler)
  // =========================================================================
  console.log("\nTest Suite 15: Combined Feature Workflow");

  // Step 1: Create a TikTok Combo with 2 distinct TikTok services
  let ttViewsService = await prisma.service.findFirst({
    where: { platform: "TikTok", category: "Views", active: true, id: { not: tiktokService.id } },
  });
  if (!ttViewsService) {
    ttViewsService = await prisma.service.create({
      data: {
        externalId: "mock_tiktok_views_301",
        name: "TikTok Video Views — High Speed",
        platform: "TikTok",
        category: "Views",
        description: "Fast delivery TikTok video views",
        minQuantity: 500,
        maxQuantity: 100000,
        ratePer1000: 0.15,
        active: true,
        isMock: true,
      },
    });
  }

  const tiktokCombo = await createCombo({
    name: "TikTok Growth Bundle (Likes + Views)",
    description: "Combined TikTok engagement",
    items: [
      { serviceId: tiktokService.id, defaultQuantity: 1000, targetType: "SAME_URL" },
      { serviceId: ttViewsService.id, defaultQuantity: 2500, targetType: "SAME_URL" },
    ],
  });
  assert(tiktokCombo !== null, "Created TikTok Combo Bundle for combined testing");
  if (!tiktokCombo) throw new Error("Combo creation failed");

  // Clean up any test orders from prior runs to ensure idempotent test execution
  await prisma.order.deleteMany({
    where: {
      OR: [
        { targetUrl: { contains: "7698652584520813844" } },
        { targetUrl: { contains: "1234567890123456789" } },
      ],
    },
  });

  // Step 2: Bulk Add TikTok links (including long URLs, whitespace, empty lines, and duplicates)
  const rawBulkInput = `
https://www.tiktok.com/@studyora.co/video/7698652584520813844

https://www.tiktok.com/@creator/video/1234567890123456789?is_from_webapp=1&sender_device=pc
https://www.tiktok.com/@studyora.co/video/7698652584520813844
`;

  const validationSummary = await validateBulkOrderLinks(
    rawBulkInput,
    undefined,
    undefined,
    undefined,
    tiktokCombo.id
  );

  assert(validationSummary.totalRows === 3, "Bulk links parsing identifies exactly 3 non-empty lines");
  assert(validationSummary.duplicateRows === 1, "Detects duplicate TikTok video URL across lines");
  assert(validationSummary.validRows === 4, "4 combo service order rows ready to submit across the 2 valid links");

  const validComboRows = validationSummary.rows.filter((r) => r.canSubmit);
  assert(
    validComboRows.length === 4,
    `Each valid TikTok URL generates separate orders for each combo service (Expected 4 rows, got ${validComboRows.length})`
  );

  // Step 3: Randomizer applied across all generated combo orders
  const randomizedOrders = validComboRows.map((r) => {
    const avg = 1500;
    const variationFraction = 0.2; // 20%
    const minBound = Math.max(r.minQuantity || 50, Math.round(avg * (1 - variationFraction)));
    const maxBound = Math.min(r.maxQuantity || 50000, Math.round(avg * (1 + variationFraction)));
    const rand = Math.floor(minBound + Math.random() * (maxBound - minBound + 1));
    const clamped = Math.max(r.minQuantity || 50, Math.min(r.maxQuantity || 50000, rand));
    return {
      url: r.normalizedUrl,
      serviceId: r.serviceId!,
      quantity: clamped,
      minQuantity: r.minQuantity || 50,
      maxQuantity: r.maxQuantity || 50000,
    };
  });

  const allWithinBounds = randomizedOrders.every(
    (o) => o.quantity >= o.minQuantity && o.quantity <= o.maxQuantity
  );
  assert(allWithinBounds, "All randomized combo bulk orders strictly respect service provider min and max");

  // Step 4: User reviews and manually edits one generated order quantity
  randomizedOrders[0].quantity = 1450;
  assert(randomizedOrders[0].quantity === 1450, "User can review and manually edit generated quantities before submitting");

  // Step 5: Scheduler Enabled — Persist to backend database as ScheduledOrderJob
  const scheduledTime = new Date(Date.now() - 2000); // due for immediate execution in test
  const scheduledCombinedJob = await scheduleOrderJob({
    jobType: "COMBO",
    scheduledFor: scheduledTime,
    timezone: "Asia/Dhaka",
    payload: {
      comboId: tiktokCombo.id,
      targetUrls: [
        "https://www.tiktok.com/@studyora.co/video/7698652584520813844",
        "https://www.tiktok.com/@creator/video/1234567890123456789",
      ],
      orderItems: randomizedOrders.map((o) => ({
        url: o.url,
        serviceId: o.serviceId,
        quantity: o.quantity,
      })),
    },
  });

  assert(Boolean(scheduledCombinedJob.id), "Combined workflow job successfully scheduled and persisted in database");
  assert(scheduledCombinedJob.status === "SCHEDULED", "Job initially saved in SCHEDULED state");

  // Step 6: Worker Execution — Process the combined scheduled job
  const tickResult = await runScheduledJobsTick();
  assert(tickResult.successfulJobs >= 1, "Background worker automatically claims and executes scheduled combined job");

  const executedJob = await prisma.scheduledOrderJob.findUnique({
    where: { id: scheduledCombinedJob.id },
    include: { orders: { include: { service: true } } },
  });
  assert(executedJob?.status === "COMPLETED", "Scheduled combined job status updated to COMPLETED");
  assert(
    executedJob?.orders.length === 4,
    `Worker created all 4 child orders in database (Got ${executedJob?.orders.length})`
  );
  const allOrdersProcessing = executedJob?.orders.every((o) => o.status === "PROCESSING" || o.status === "COMPLETED");
  assert(allOrdersProcessing === true, "All child orders submitted to provider adapter successfully");

  // Step 7: Scheduler Disabled — Immediate submission workflow
  const immediateResult = await executeCombo({
    comboId: tiktokCombo.id,
    orderItems: randomizedOrders.map((o) => ({
      url: o.url,
      serviceId: o.serviceId,
      quantity: o.quantity,
    })),
    idempotencyToken: `test-immediate-${Date.now()}`,
  });
  assert(immediateResult.success, "Immediate order workflow succeeds when Scheduler is disabled");
  assert(immediateResult.successfulServices === 4, "Immediate execution submits all 4 child services");

  // Clean up test orders created during combined workflow test
  await prisma.order.deleteMany({
    where: {
      OR: [
        { targetUrl: { contains: "7698652584520813844" } },
        { targetUrl: { contains: "1234567890123456789" } },
      ],
    },
  });

  // Clean up test combo
  await deleteCombo(tiktokCombo.id);

  } finally {
    if (existingConfig) {
      await prisma.providerConfig.update({
        where: { id: existingConfig.id },
        data: { isMock: originalIsMock },
      });
    }
  }

  console.log("\n=======================================================");
  console.log(`NEW ORDER ENHANCEMENTS TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runEnhancementTests().catch((err) => {
  console.error("Test execution failed with unhandled exception:", err);
  process.exit(1);
});
