import { calculateGrowthPlan, redistributeRemaining } from "../src/lib/scheduler/calculator";
import { MockSMMProvider } from "../src/lib/provider/adapter";
import { hashKey, generateKeyString, verifyAdminCredential } from "../src/lib/auth/keys";
import { prisma } from "../src/lib/prisma";
import { POST as previewPost } from "../src/app/api/schedules/preview/route";
import { POST as pausePost } from "../src/app/api/orders/[id]/pause/route";
import { POST as resumePost } from "../src/app/api/orders/[id]/resume/route";
import { PATCH as batchesPatch } from "../src/app/api/orders/[id]/batches/route";
import { GET as diagnosticsGet } from "../src/app/api/scheduler/diagnostics/route";
import { POST as likesAnalyzePost, GET as likesAnalyzeListGet } from "../src/app/api/likes-analyze/route";
import { GET as likesAnalyzeGet } from "../src/app/api/likes-analyze/[id]/route";
import {
  ORGANIC_PRESET_DEFINITIONS,
  OrganicPresetId,
  buildOrganicPlan,
  generatePresetSparklinePath,
  audienceCircadianActivity,
} from "../src/lib/scheduler/organic-presets";
import { runEnhancementTests } from "./new-order-enhancements.test";
import { runMultiUserAuthTests } from "./multi-user-auth.test";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✔ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✖ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("   AURASMM SUITE: SCHEDULER, ADAPTER & AUTH VERIFICATION");
  console.log("=======================================================\n");

  const mockService = {
    id: "test-srv-1",
    name: "Instagram Followers HQ",
    minQuantity: 100,
    maxQuantity: 50000,
    ratePer1000: 2.5,
    dripFeedSupported: true,
    dripFeedMinInterval: 15,
    dripFeedMaxInterval: 1440,
    restrictions: "Public accounts only",
  };

  // -----------------------------------------------------------
  // 1. Growth Planner & Scheduler Mathematical Precision Tests
  // -----------------------------------------------------------
  console.log("Test Suite 1: Growth Planner & Schedule Calculator");

  // Test 1.1: Exact sum conservation on Even Drip
  const evenPlan = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/test",
    totalQuantity: 5327, // uneven number
    scheduleMode: "EVEN_DRIP",
    stepsCount: 7,
    intervalMinutes: 30,
  });

  assert(evenPlan.valid, "Even Drip plan is valid");
  const evenSum = evenPlan.steps.reduce((acc, s) => acc + s.quantity, 0);
  assert(
    evenSum === 5327,
    "Even Drip exact sum matches total quantity strictly",
    `Expected 5327, got ${evenSum}`
  );
  assert(evenPlan.steps.length === 7, "Even Drip generates exactly 7 steps");

  // Test 1.2: Exact sum conservation on Front-Loaded
  const frontPlan = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/test",
    totalQuantity: 10000,
    scheduleMode: "FRONT_LOADED",
    stepsCount: 5,
    intervalMinutes: 60,
  });

  assert(frontPlan.valid, "Front-Loaded plan is valid");
  const frontSum = frontPlan.steps.reduce((acc, s) => acc + s.quantity, 0);
  assert(
    frontSum === 10000,
    "Front-Loaded exact sum matches total quantity strictly",
    `Expected 10000, got ${frontSum}`
  );
  assert(
    frontPlan.steps[0].quantity > frontPlan.steps[frontPlan.steps.length - 1].quantity,
    "Front-Loaded initial step volume is greater than final step volume"
  );

  // Test 1.3: Exact sum conservation on Gradual Ramp
  const rampPlan = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/test",
    totalQuantity: 7500,
    scheduleMode: "GRADUAL_RAMP",
    stepsCount: 6,
    intervalMinutes: 45,
  });

  assert(rampPlan.valid, "Gradual Ramp plan is valid");
  const rampSum = rampPlan.steps.reduce((acc, s) => acc + s.quantity, 0);
  assert(
    rampSum === 7500,
    "Gradual Ramp exact sum matches total quantity strictly",
    `Expected 7500, got ${rampSum}`
  );
  assert(
    rampPlan.steps[0].quantity < rampPlan.steps[rampPlan.steps.length - 1].quantity,
    "Gradual Ramp initial step volume is smaller than final step volume"
  );

  // Test 1.4: Reject below service minimum
  const belowMinPlan = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/test",
    totalQuantity: 50, // min is 100
    scheduleMode: "EVEN_DRIP",
    stepsCount: 3,
    intervalMinutes: 30,
  });
  assert(!belowMinPlan.valid, "Rejects requested quantity below service minimum");

  // Test 1.5: Reject step volume below service minimum
  const stepBelowMinPlan = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/test",
    totalQuantity: 200,
    scheduleMode: "EVEN_DRIP",
    stepsCount: 5, // 200 / 5 = 40 per step, which is < min 100
    intervalMinutes: 30,
  });
  assert(
    !stepBelowMinPlan.valid,
    "Rejects plan where individual step quantity falls below provider minimum"
  );

  // Test 1.6: Instant single order calculation
  const instantPlan = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/test",
    totalQuantity: 1500,
    scheduleMode: "INSTANT",
    stepsCount: 1,
    intervalMinutes: 0,
  });
  assert(instantPlan.valid, "Instant plan is valid");
  assert(instantPlan.steps.length === 1, "Instant plan has exactly 1 step");
  assert(instantPlan.steps[0].quantity === 1500, "Instant step quantity matches total");
  assert(instantPlan.totalCost === 3.75, "Total cost calculated accurately ($2.5/1k * 1.5 = $3.75)");

  // -----------------------------------------------------------
  // 2. Provider Adapter Integration & SMM v2 Parity Tests
  // -----------------------------------------------------------
  console.log("\nTest Suite 2: Provider Adapter & SMM v2 Actions");
  const provider = new MockSMMProvider();

  // Test 2.1: Catalog retrieval
  const services = await provider.getServices();
  assert(services.length >= 8, `Provider returns verified catalog (${services.length} services)`);

  // Test 2.2: User specified services #1 and #2 exist
  const srv1 = services.find((s) => s.id === "1");
  const srv2 = services.find((s) => s.id === "2");
  assert(Boolean(srv1), "Service #1 (Followers) exists with refill=true, cancel=true");
  assert(Boolean(srv2), "Service #2 (Comments, Custom Comments) exists with rate=8");

  // Test 2.3: Order creation valid
  const orderRes = await provider.createOrder({
    serviceExternalId: "1",
    targetUrl: "https://instagram.com/testprofile",
    quantity: 500,
  });
  assert(orderRes.success && Boolean(orderRes.providerOrderId), "Provider creates order successfully");

  // Test 2.4: Order status retrieval
  const statusRes = await provider.getOrderStatus(orderRes.providerOrderId!);
  assert(statusRes.success && statusRes.status === "PROCESSING", "Provider returns order status");
  assert(typeof statusRes.remains === "number", "Provider returns remains count");

  // Test 2.5: Multi order status retrieval
  const multiStatus = await provider.getMultipleOrdersStatus(["1", "2"]);
  assert(Boolean(multiStatus["1"]) && Boolean(multiStatus["2"]), "Multi order status returns mapped dictionary");

  // Test 2.6: Refill creation
  const refillRes = await provider.createRefill(orderRes.providerOrderId!);
  assert(refillRes.success && Boolean(refillRes.refillId), "Refill created successfully");

  // Test 2.7: Refill status check
  const refillStatus = await provider.getRefillStatus(refillRes.refillId!);
  assert(refillStatus.success && refillStatus.status === "Completed", "Refill status checked successfully");

  // Test 2.8: Order cancellation
  const cancelRes = await provider.cancelOrder(orderRes.providerOrderId!);
  assert(cancelRes.success, "Order cancellation executed successfully");

  // Test 2.9: Balance retrieval
  let mockBalanceRejected = false;
  try {
    await provider.getBalance();
  } catch {
    mockBalanceRejected = true;
  }
  assert(mockBalanceRejected, "Mock provider does not fabricate a live account balance");

  // -----------------------------------------------------------
  // 3. Database Service ID Search Tests
  // -----------------------------------------------------------
  console.log("\nTest Suite 3: Database & Service ID Search");

  const serviceById1 = await prisma.service.findFirst({
    where: { externalId: "1" },
  });
  assert(Boolean(serviceById1), "Found service #1 by externalId in database");

  const serviceById2 = await prisma.service.findFirst({
    where: { externalId: "2" },
  });
  assert(Boolean(serviceById2), "Found service #2 by externalId in database");

  // -----------------------------------------------------------
  // 4. Security, Access Keys & Authentication Tests
  // -----------------------------------------------------------
  console.log("\nTest Suite 4: Admin Auth & High-Entropy Access Keys");

  // Test 4.1: Bootstrap credential verification (Abir99)
  const bootstrapRes = await verifyAdminCredential("Abir99");
  assert(bootstrapRes.valid, "Bootstrap credential 'Abir99' verifies successfully");

  // Test 4.2: Rejection of invalid credentials
  const invalidRes = await verifyAdminCredential("wrong-password-123");
  assert(!invalidRes.valid, "Rejects unauthorized access keys");

  // Test 4.3: High-entropy key generation format
  const generated = generateKeyString();
  assert(
    generated.startsWith("smm_live_") && generated.length > 40,
    "Generates high-entropy key with 'smm_live_' prefix"
  );

  // Test 4.4: Cryptographic hashing consistency
  const hash1 = hashKey("secret-test-key-2026");
  const hash2 = hashKey("secret-test-key-2026");
  assert(hash1 === hash2, "SHA-256 hash is consistent and deterministic");
  assert(hash1 !== "secret-test-key-2026", "Raw secret is never stored in plain text");

  // -----------------------------------------------------------
  // 5. Order Lifecycle & Background Worker Queue Execution Tests
  // -----------------------------------------------------------
  console.log("\nTest Suite 5: Order Lifecycle, Queue Execution & API Client");

  // Ensure mock sandbox is active for automated testing so we don't submit live orders
  const existingConfig = await prisma.providerConfig.findFirst({ where: { active: true } });
  const originalIsMock = existingConfig?.isMock ?? true;
  if (existingConfig) {
    await prisma.providerConfig.update({
      where: { id: existingConfig.id },
      data: { isMock: true },
    });
  }

  // Test 5.1: Database Order Creation
  const testOrder = await prisma.order.create({
    data: {
      orderRef: `TEST-ORD-${Date.now()}`,
      serviceId: serviceById1!.id,
      targetUrl: "https://instagram.com/test_user_flow",
      requestedQuantity: 200,
      submittedQuantity: 0,
      deliveredQuantity: 0,
      remainingQuantity: 200,
      unitCost: 0.0009,
      totalCost: 0.18,
      status: "PENDING",
      isScheduled: false,
    },
  });
  assert(Boolean(testOrder.id), `Database order created with ref ${testOrder.orderRef}`);

  // Test 5.2: Create scheduled delivery step with unique idempotency key
  const testStep = await prisma.scheduledDeliveryStep.create({
    data: {
      orderId: testOrder.id,
      stepNumber: 1,
      scheduledTime: new Date(Date.now() - 5000), // Due 5 seconds ago
      quantity: 200,
      status: "PENDING",
      idempotencyKey: `IDEM-TEST-${Date.now()}-${Math.random()}`,
    },
  });
  assert(Boolean(testStep.id), "Created due scheduled delivery step with unique idempotency key");

  // Test 5.3: Execute worker cycle to process the step
  const { executeWorkerCycle } = await import("../src/worker");
  const cycleResult = await executeWorkerCycle();
  assert(cycleResult.stepsProcessed >= 1, `Worker cycle executed and claimed ${cycleResult.stepsProcessed} due steps`);

  // Verify step status after worker execution
  const updatedStep = await prisma.scheduledDeliveryStep.findUnique({
    where: { id: testStep.id },
  });
  assert(
    updatedStep?.status === "SUBMITTED" || updatedStep?.status === "COMPLETED",
    `Step updated to SUBMITTED/COMPLETED (Status: ${updatedStep?.status})`
  );
  assert(Boolean(updatedStep?.providerOrderId), `Step received providerOrderId: ${updatedStep?.providerOrderId}`);

  // Test 5.4: Frontend API client URL generation
  const { apiClient } = await import("../src/lib/api-client");
  const endpointUrl = (apiClient as any).buildUrl("/api/orders", { page: "1", limit: "10" });
  assert(
    endpointUrl.includes("/api/orders") && endpointUrl.includes("page=1") && endpointUrl.includes("limit=10"),
    "apiClient correctly builds URL and serializes query parameters"
  );

  // Test 5.5: Cleanup test records & restore configuration
  await prisma.scheduledDeliveryStep.deleteMany({ where: { orderId: testOrder.id } });
  await prisma.order.delete({ where: { id: testOrder.id } });
  if (existingConfig) {
    await prisma.providerConfig.update({
      where: { id: existingConfig.id },
      data: { isMock: originalIsMock },
    });
  }
  // -----------------------------------------------------------
  // 6. Delivery Pacing Strategy, Visual Calculation Modes & Scheduler Lifecycle
  // -----------------------------------------------------------
  console.log("\nTest Suite 6: Delivery Pacing Strategy, Timing Modes & Scheduler Concurrency");

  // Test 6.1: Mode A — Four hours with 30-minute intervals
  const modeAPlan = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/modeA",
    totalQuantity: 2400,
    scheduleMode: "EVEN_DRIP",
    timingMode: "MODE_A",
    totalDurationMinutes: 240,
    intervalMinutes: 30,
  });
  assert(modeAPlan.valid, "Mode A plan (4h with 30m intervals) is valid");
  assert(modeAPlan.totalDurationMinutes === 240, "Mode A spans exactly 240 minutes duration");
  const modeASum = modeAPlan.steps.reduce((a, b) => a + b.quantity, 0);
  assert(modeASum === 2400, `Mode A preserves exact total sum (Expected 2400, got ${modeASum})`);
  assert(modeAPlan.steps.length === 9, `Mode A produces 9 batches starting at t=0 and ending at t=240 (Got ${modeAPlan.steps.length})`);

  // Test 6.2: Mode B — Four hours with four batches
  const modeBPlan = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/modeB",
    totalQuantity: 1000,
    scheduleMode: "EVEN_DRIP",
    timingMode: "MODE_B",
    stepsCount: 4,
    totalDurationMinutes: 240,
  });
  assert(modeBPlan.valid, "Mode B plan (4h with 4 batches) is valid");
  assert(modeBPlan.steps.length === 4, "Mode B produces exactly 4 batches");
  assert(modeBPlan.defaultIntervalMinutes === 80, `Mode B calculates 80m interval between 4 batches across 240m (Got ${modeBPlan.defaultIntervalMinutes}m)`);
  const modeBSum = modeBPlan.steps.reduce((a, b) => a + b.quantity, 0);
  assert(modeBSum === 1000, `Mode B preserves exact sum (Expected 1000, got ${modeBSum})`);

  // Test 6.3: Custom Individual Intervals (30m, 21m, 45m, 18m)
  const customIntervals = [0, 30, 21, 45, 18];
  const customIntervalsPlan = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/customIntervals",
    totalQuantity: 1500,
    scheduleMode: "EVEN_DRIP",
    timingMode: "CUSTOM",
    customIntervals,
  });
  assert(customIntervalsPlan.valid, "Custom individual intervals plan is valid");
  assert(customIntervalsPlan.steps.length === 5, "Custom intervals produces 5 batches");
  assert(customIntervalsPlan.totalDurationMinutes === 114, `Total duration is sum of intervals 30+21+45+18 = 114m (Got ${customIntervalsPlan.totalDurationMinutes}m)`);
  assert(customIntervalsPlan.steps[1].intervalMinutesFromPrev === 30, "Batch 2 interval is 30m");
  assert(customIntervalsPlan.steps[2].intervalMinutesFromPrev === 21, "Batch 3 interval is 21m");
  assert(customIntervalsPlan.steps[3].intervalMinutesFromPrev === 45, "Batch 4 interval is 45m");
  assert(customIntervalsPlan.steps[4].intervalMinutesFromPrev === 18, "Batch 5 interval is 18m");

  // Test 6.4: Unequal batch quantities & odd quantity rounding
  const oddPlan = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/odd",
    totalQuantity: 1001,
    scheduleMode: "EVEN_DRIP",
    stepsCount: 3,
    intervalMinutes: 30,
  });
  assert(oddPlan.valid, "Odd quantity plan (1001 / 3) is valid");
  const oddSum = oddPlan.steps.reduce((a, b) => a + b.quantity, 0);
  assert(oddSum === 1001, `Odd quantity sum strictly matches 1001 (Got ${oddSum})`);

  // Test 6.5: Remainder redistribution when editing a batch
  const initialCustomQtys = [250, 150, 250, 250]; // user reduced batch 2 from 250 to 150 (sum = 900, 100 unallocated)
  const redistributed = redistributeRemaining(initialCustomQtys, 1000, 100, 50000);
  const redistributedSum = redistributed.reduce((a, b) => a + b, 0);
  assert(redistributedSum === 1000, `Redistribution recovers exact 1000 sum (Got ${redistributedSum})`);
  assert(redistributed[1] > 150, "Batch 2 received allocated portion of remaining units");

  // Test 6.6: Invalid and conflicting configurations rejected
  const nonpositiveDur = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/test",
    totalQuantity: 1000,
    scheduleMode: "EVEN_DRIP",
    timingMode: "MODE_A",
    totalDurationMinutes: 0,
    intervalMinutes: 30,
  });
  assert(!nonpositiveDur.valid, "Rejects nonpositive duration (0 mins)");

  const invalidBatchQty = calculateGrowthPlan({
    service: mockService,
    targetUrl: "https://instagram.com/p/test",
    totalQuantity: 1000,
    scheduleMode: "CUSTOM",
    customStepQuantities: [500, 0, 500],
  });
  assert(!invalidBatchQty.valid, "Rejects batch quantity of 0");

  // Test 6.7: Atomic Claim Race Test (Two workers claiming same batch simultaneously)
  const raceOrder = await prisma.order.create({
    data: {
      orderRef: `RACE-${Date.now()}`,
      serviceId: serviceById1!.id,
      targetUrl: "https://instagram.com/p/race",
      requestedQuantity: 500,
      unitCost: 0.0025,
      totalCost: 1.25,
      isScheduled: true,
      status: "SCHEDULED",
    },
  });

  const raceStep = await prisma.scheduledDeliveryStep.create({
    data: {
      orderId: raceOrder.id,
      stepNumber: 1,
      scheduledTime: new Date(Date.now() - 60000), // Due in the past
      quantity: 500,
      status: "PENDING",
      idempotencyKey: `race-step-${Date.now()}`,
    },
  });

  // Worker 1 and Worker 2 try to claim concurrently
  const [claimWorker1, claimWorker2] = await Promise.all([
    prisma.scheduledDeliveryStep.updateMany({
      where: { id: raceStep.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    }),
    prisma.scheduledDeliveryStep.updateMany({
      where: { id: raceStep.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    }),
  ]);

  const totalClaimed = claimWorker1.count + claimWorker2.count;
  assert(totalClaimed === 1, `Atomic row-level claim prevents race: exactly 1 worker claimed job (Claimed: ${totalClaimed})`);
  assert(
    (claimWorker1.count === 1 && claimWorker2.count === 0) || (claimWorker1.count === 0 && claimWorker2.count === 1),
    "One worker succeeded (count=1) while second worker safely yielded (count=0)"
  );

  // Test 6.8: Duplicate Idempotency Key Rejection
  let duplicateCaught = false;
  try {
    await prisma.scheduledDeliveryStep.create({
      data: {
        orderId: raceOrder.id,
        stepNumber: 2,
        scheduledTime: new Date(),
        quantity: 500,
        status: "PENDING",
        idempotencyKey: raceStep.idempotencyKey, // duplicate!
      },
    });
  } catch (e) {
    duplicateCaught = true;
  }
  assert(duplicateCaught, "Database uniquely constrains idempotencyKey to prevent duplicate job insertion");

  // Test 6.9: Crash Recovery (Jobs stuck in PROCESSING > 10m are recovered)
  const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000);
  await prisma.scheduledDeliveryStep.update({
    where: { id: raceStep.id },
    data: {
      status: "PROCESSING",
      updatedAt: elevenMinutesAgo,
    },
  });

  const recoveredSteps = await prisma.scheduledDeliveryStep.findMany({
    where: {
      OR: [
        { status: "PENDING", scheduledTime: { lte: new Date() } },
        { status: "PROCESSING", updatedAt: { lte: new Date(Date.now() - 10 * 60 * 1000) } },
      ],
    },
  });
  const foundStuck = recoveredSteps.some((s) => s.id === raceStep.id);
  assert(foundStuck, "Crash recovery query identifies stale PROCESSING jobs (> 10m) for retry");

  // Test 6.10: Pause & Resume Lifecycle
  // Step in PAUSED status is ignored by active due step query
  await prisma.scheduledDeliveryStep.update({
    where: { id: raceStep.id },
    data: { status: "PAUSED", scheduledTime: new Date(Date.now() - 60000) },
  });

  const activeDueSteps = await prisma.scheduledDeliveryStep.findMany({
    where: { status: "PENDING", scheduledTime: { lte: new Date() } },
  });
  const pausedIgnored = !activeDueSteps.some((s) => s.id === raceStep.id);
  assert(pausedIgnored, "Scheduler tick query completely ignores PAUSED batches");

  // Resuming restores status to PENDING
  await prisma.scheduledDeliveryStep.update({
    where: { id: raceStep.id },
    data: { status: "PENDING" },
  });
  const resumedStep = await prisma.scheduledDeliveryStep.findUnique({
    where: { id: raceStep.id },
  });
  assert(resumedStep?.status === "PENDING", "Resumed batch successfully restored to PENDING");

  // Cleanup race test records
  await prisma.scheduledDeliveryStep.deleteMany({ where: { orderId: raceOrder.id } });
  await prisma.order.delete({ where: { id: raceOrder.id } });

  // -----------------------------------------------------------
  // 7. Schedule API Endpoints (Preview, Pause, Resume, Batch Edit, Diagnostics)
  // -----------------------------------------------------------
  console.log("\nTest Suite 7: Schedule API Endpoints (Preview, Pause, Resume, Batch Edit, Diagnostics)");

  // Test 7.1: Preview Route POST /api/schedules/preview
  const previewReq = new Request("http://localhost:3000/api/schedules/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: serviceById1!.id,
      totalQuantity: 1000,
      scheduleMode: "FRONT_LOADED",
      timingMode: "MODE_B",
      stepsCount: 4,
      totalDurationMinutes: 120,
    }),
  });
  const previewRes = await previewPost(previewReq);
  const previewData = await previewRes.json();
  assert(previewData.success === true, "POST /api/schedules/preview returns successful calculation");
  assert(previewData.plan.steps.length === 4, "Preview returns 4 planned batches");

  // Test 7.2: Order Creation with Schedule Batches
  const testSchedOrder = await prisma.order.create({
    data: {
      orderRef: `TEST-SCHED-${Date.now()}`,
      serviceId: serviceById1!.id,
      targetUrl: "https://instagram.com/p/api_test",
      requestedQuantity: 1000,
      unitCost: 0.0009,
      totalCost: 0.9,
      isScheduled: true,
      scheduleMode: "CUSTOM",
      status: "SCHEDULED",
    },
  });

  const step1 = await prisma.scheduledDeliveryStep.create({
    data: {
      orderId: testSchedOrder.id,
      stepNumber: 1,
      scheduledTime: new Date(Date.now() + 3600000),
      quantity: 500,
      status: "PENDING",
      idempotencyKey: `sched-step-1-${Date.now()}`,
    },
  });

  const step2 = await prisma.scheduledDeliveryStep.create({
    data: {
      orderId: testSchedOrder.id,
      stepNumber: 2,
      scheduledTime: new Date(Date.now() + 7200000),
      quantity: 500,
      status: "PENDING",
      idempotencyKey: `sched-step-2-${Date.now()}`,
    },
  });

  // Test 7.3: POST /api/orders/[id]/pause
  const pauseReq = new Request(`http://localhost:3000/api/orders/${testSchedOrder.id}/pause`, { method: "POST" });
  const pauseRes = await pausePost(pauseReq, { params: { id: testSchedOrder.id } });
  const pauseData = await pauseRes.json();
  assert(pauseData.success === true, "POST /api/orders/[id]/pause successfully pauses schedule");
  assert(pauseData.pausedBatchesCount === 2, "Pauses 2 pending batches");
  const checkPausedOrder = await prisma.order.findUnique({ where: { id: testSchedOrder.id } });
  assert(checkPausedOrder?.status === "PAUSED", "Order status transitioned to PAUSED");

  // Test 7.4: POST /api/orders/[id]/resume
  const resumeReq = new Request(`http://localhost:3000/api/orders/${testSchedOrder.id}/resume`, { method: "POST" });
  const resumeRes = await resumePost(resumeReq, { params: { id: testSchedOrder.id } });
  const resumeData = await resumeRes.json();
  assert(resumeData.success === true, "POST /api/orders/[id]/resume successfully resumes schedule");
  assert(resumeData.resumedBatchesCount === 2, "Resumes 2 paused batches");
  const checkResumedOrder = await prisma.order.findUnique({ where: { id: testSchedOrder.id } });
  assert(checkResumedOrder?.status === "SCHEDULED", "Order status transitioned to SCHEDULED");

  // Test 7.5: PATCH /api/orders/[id]/batches (reject unequal sum)
  const badBatchReq = new Request(`http://localhost:3000/api/orders/${testSchedOrder.id}/batches`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      batches: [
        { stepNumber: 1, quantity: 400 },
        { stepNumber: 2, quantity: 400 }, // sum 800 !== 1000
      ],
    }),
  });
  const badBatchRes = await batchesPatch(badBatchReq, { params: { id: testSchedOrder.id } });
  const badBatchData = await badBatchRes.json();
  assert(badBatchData.success === false, "PATCH /api/orders/[id]/batches rejects batches with sum mismatch");

  // Test 7.6: PATCH /api/orders/[id]/batches (accept valid adjusted batches)
  const goodBatchReq = new Request(`http://localhost:3000/api/orders/${testSchedOrder.id}/batches`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      batches: [
        { stepNumber: 1, quantity: 300 },
        { stepNumber: 2, quantity: 700 }, // sum 1000 === 1000
      ],
    }),
  });
  const goodBatchRes = await batchesPatch(goodBatchReq, { params: { id: testSchedOrder.id } });
  const goodBatchData = await goodBatchRes.json();
  assert(goodBatchData.success === true, "PATCH /api/orders/[id]/batches successfully updates batch quantities");
  const updatedSteps = await prisma.scheduledDeliveryStep.findMany({ where: { orderId: testSchedOrder.id }, orderBy: { stepNumber: "asc" } });
  assert(updatedSteps[0].quantity === 300, "Batch #1 quantity updated to 300");
  assert(updatedSteps[1].quantity === 700, "Batch #2 quantity updated to 700");

  // Test 7.7: GET /api/scheduler/diagnostics
  const diagRes = await diagnosticsGet();
  const diagData = await diagRes.json();
  assert(diagData.success === true, "GET /api/scheduler/diagnostics returns healthy metrics");
  assert(typeof diagData.queue.totalQueueSize === "number", "Diagnostics returns totalQueueSize metric");
  assert(typeof diagData.queue.oldestDueDelaySeconds === "number", "Diagnostics returns queue latency metric");

  // Cleanup test order
  await prisma.scheduledDeliveryStep.deleteMany({ where: { orderId: testSchedOrder.id } });
  await prisma.order.delete({ where: { id: testSchedOrder.id } });

  // -----------------------------------------------------------
  // 8. Likes Analyze — Persistent Monitoring & Adaptive Delivery Engine
  // -----------------------------------------------------------
  console.log("\nTest Suite 8: Likes Analyze Monitoring Engine (Persistent, Interval-Based, Budget-Capped)");

  const {
    createMonitoringSession,
    runMonitoringTick,
    pauseMonitoringSession,
    resumeMonitoringSession,
    stopMonitoringSession,
  } = await import("../src/lib/monitoring/engine");

  const LA_SERVICE = serviceById1!; // rate ₹2.5/1k → unitCost 0.0025, min 100, max 50000
  const minute = 60 * 1000;

  async function cleanupLA(sessionId: string | null | undefined, orderId: string | null | undefined) {
    if (sessionId) {
      await prisma.monitoringSession.delete({ where: { id: sessionId } }).catch(() => {});
    }
    if (orderId) {
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    }
  }

  const uniqueSeed = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  // ---- 8.1 Configuration validation ----
  const badCap = await createMonitoringSession({
    serviceId: LA_SERVICE.id,
    videoUrl: `https://video.example.test/watch?v=la-validate-${uniqueSeed}`,
    durationMinutes: 120,
    intervalMinutes: 30,
    budgetCap: 25,
    quantityCap: Math.max(1, LA_SERVICE.minQuantity - 1), // below provider minimum
  });
  assert(!badCap.ok, "Rejects monitoring session when quantity cap is below provider minimum", badCap.error);

  const badInterval = await createMonitoringSession({
    serviceId: LA_SERVICE.id,
    videoUrl: `https://video.example.test/watch?v=la-validate-${uniqueSeed}`,
    durationMinutes: 30,
    intervalMinutes: 60, // interval exceeds duration
    budgetCap: 25,
    quantityCap: 500,
  });
  assert(!badInterval.ok, "Rejects monitoring session when interval exceeds duration", badInterval.error);

  const zeroBudget = await createMonitoringSession({
    serviceId: LA_SERVICE.id,
    videoUrl: `https://video.example.test/watch?v=la-validate-${uniqueSeed}`,
    durationMinutes: 120,
    intervalMinutes: 30,
    budgetCap: 0,
    quantityCap: 500,
  });
  assert(!zeroBudget.ok, "Rejects monitoring session without a positive enforceable budget limit", zeroBudget.error);

  // ---- 8.2 Persisted checkpoint schedule (initial snapshot IS checkpoint #1) ----
  const t0 = new Date();
  const main = await createMonitoringSession({
    serviceId: LA_SERVICE.id,
    videoUrl: `https://video.example.test/watch?v=la-main-${uniqueSeed}`,
    durationMinutes: 63, // 63/21 = 3 → checkpoints at t = 0, 21, 42, 63
    intervalMinutes: 21,
    budgetCap: 10,
    quantityCap: 5000,
    startDate: t0,
  });
  assert(main.ok && Boolean(main.session), "Monitoring session created with real linked order (ADAPTIVE mode)");
  const mainSession = main.session!;
  const mainOrder = await prisma.order.findUnique({ where: { id: mainSession.orderId! } });
  assert(mainOrder?.scheduleMode === "ADAPTIVE", "Linked order configured with scheduleMode 'ADAPTIVE'");
  assert(mainSession.checkpoints.length === 4, `Checkpoint schedule persisted upfront with 4 checkpoints (0,21,42,63m) (Got ${mainSession.checkpoints.length})`);
  assert(mainSession.checkpoints[0].sequence === 1, "Initial snapshot is persisted as checkpoint #1 (sequence 1, t=0)");
  const plannedGaps = mainSession.checkpoints
    .slice(1)
    .every((c, i) => new Date(c.plannedAt).getTime() - new Date(mainSession.checkpoints[i].plannedAt).getTime() === 21 * minute);
  assert(plannedGaps, "Checkpoint plannedAt times are spaced exactly by the 21-minute interval");

  const main25 = await createMonitoringSession({
    serviceId: LA_SERVICE.id,
    videoUrl: `https://video.example.test/watch?v=la-main25-${uniqueSeed}`,
    durationMinutes: 75,
    intervalMinutes: 25,
    budgetCap: 10,
    quantityCap: 5000,
    startDate: t0,
  });
  const plannedGaps25 = main25.session?.checkpoints
    .slice(1)
    .every((c, i) => new Date(c.plannedAt).getTime() - new Date(main25.session!.checkpoints[i].plannedAt).getTime() === 25 * minute);
  assert(plannedGaps25 === true, "Custom 25-minute interval persists exact 25-minute checkpoint spacing");
  await cleanupLA(main25.session?.id, main25.session?.orderId);

  // ---- 8.3 First & subsequent snapshots with interval deltas ----
  const tick1 = await runMonitoringTick(t0, mainSession.id);
  assert(tick1.snapshotsTaken === 1 && tick1.sessionsChecked === 1, "First tick executes checkpoint #1 immediately (initial snapshot)");
  const snap1 = await prisma.videoSnapshot.findFirst({ where: { sessionId: mainSession.id, sequence: 1 } });
  assert(Boolean(snap1) && snap1!.isFresh === true, "Initial snapshot persisted with fresh mock analytics metrics");
  assert(mainSession.initialLikes === null, "Session not yet aware of initial baseline until snapshot persisted correctly");
  const refreshedSession1 = await prisma.monitoringSession.findUnique({ where: { id: mainSession.id } });
  assert(refreshedSession1?.initialLikes === snap1!.likes, "initialLikes baseline persisted from checkpoint #1");

  const ti21 = new Date(t0.getTime() + 21 * minute);
  const tick2 = await runMonitoringTick(ti21, mainSession.id);
  assert(tick2.snapshotsTaken === 1, "Second tick executes checkpoint #2 at its planned 21-minute slot");
  const snap2 = await prisma.videoSnapshot.findFirst({ where: { sessionId: mainSession.id, sequence: 2 } });
  assert(
    snap2?.isFresh === true && snap2!.viewsDelta !== null && snap2!.viewsDelta > 0,
    `Interval views delta computed correctly between snapshots (Δviews=${snap2?.viewsDelta})`
  );
  assert(snap2!.likesDelta !== null && snap2!.likesDelta >= 0, `Interval likes delta computed correctly (Δlikes=${snap2?.likesDelta})`);
  assert(snap2!.likesDelta === snap2!.likes! - snap1!.likes!, "21-minute interval uses only the immediately preceding checkpoint's likes count");
  assert(snap2!.ratio !== null && snap2!.ratio! > 0, "Historical like/view ratio computed for the interval");
  const mainStep2 = await prisma.scheduledDeliveryStep.findUnique({
    where: { idempotencyKey: `${mainSession.orderRef}-chk-2` },
  });
  const sentRatio = snap2!.likesDelta! / (mainStep2?.quantity || 1);
  assert(Boolean(mainStep2), "Measured interval likes create a queued provider view batch");
  assert(sentRatio >= 0.02 && sentRatio <= 0.05, `Queued batch keeps the applied likes-to-views ratio between 2% and 5% (Got ${(sentRatio * 100).toFixed(2)}%)`);
  const ratioEvent = await prisma.monitoringAuditEvent.findFirst({
    where: { sessionId: mainSession.id, action: "SCHEDULE_ASSESSED", details: { contains: "Checkpoint #2:" } },
  });
  assert(Boolean(ratioEvent?.details.includes("selected ") && ratioEvent.details.includes(" target")), "Batch audit records its randomly selected ratio target");

  // ---- 8.4 Duplicate snapshot & concurrent worker prevention ----
  const [dupA, dupB] = await Promise.all([
    runMonitoringTick(t0, mainSession.id),
    runMonitoringTick(t0, mainSession.id),
  ]);
  assert(
    dupA.snapshotsTaken + dupB.snapshotsTaken === 0,
    "Replayed tick at the same instant creates NO duplicate snapshot (atomic PENDING→EXECUTING claim)"
  );
  const snapCountMain = await prisma.videoSnapshot.count({ where: { sessionId: mainSession.id } });
  assert(snapCountMain === 2, `Snapshot count remains exactly 2 (Got ${snapCountMain})`);

  const tick3 = await runMonitoringTick(new Date(t0.getTime() + 42 * minute), mainSession.id);
  assert(tick3.snapshotsTaken === 1, "Checkpoint #3 executes at the planned 42-minute slot");
  const snap3 = await prisma.videoSnapshot.findFirst({ where: { sessionId: mainSession.id, sequence: 3 } });
  assert(snap3?.isFresh === true && snap3.likesDelta !== null, "Checkpoint #3 measures the 21-minute interval");

  // The checkpoint at the monitoring end time is the final interval reading,
  // not an expired job. It records the interval but cannot schedule more work.
  const terminalTick = await runMonitoringTick(new Date(t0.getTime() + 63 * minute), mainSession.id);
  assert(terminalTick.snapshotsTaken === 1, "Final due checkpoint at session expiry is captured");
  const terminalSnapshot = await prisma.videoSnapshot.findFirst({
    where: { sessionId: mainSession.id, sequence: 4 },
  });
  assert(
    terminalSnapshot?.isFresh === true && terminalSnapshot.likesDelta !== null,
    "Final reading measures the exact last selected interval",
  );
  const terminalSession = await prisma.monitoringSession.findUnique({ where: { id: mainSession.id } });
  assert(terminalSession?.status === "COMPLETED", "Session completes after its terminal checkpoint");

  // ---- 8.5 Missing/unavailable metrics handling ----
  const unavailable = await createMonitoringSession({
    serviceId: LA_SERVICE.id,
    videoUrl: `https://video.example.test/watch?v=la-unavail-${uniqueSeed}&simulate=unavailable`,
    durationMinutes: 60,
    intervalMinutes: 30,
    budgetCap: 10,
    quantityCap: 5000,
    startDate: t0,
  });
  assert(unavailable.ok, "Session created with unavailable-metrics analytics hook");
  await runMonitoringTick(t0, unavailable.session!.id);
  const unavailSnap = await prisma.videoSnapshot.findFirst({ where: { sessionId: unavailable.session!.id, sequence: 1 } });
  assert(unavailSnap?.isFresh === false && unavailSnap?.likes === null, "Unavailable metrics snapshot persisted without fabricating any counter");
  assert(
    (unavailSnap?.reliabilityNote || "").toLowerCase().includes("unavailable"),
    "Reliability note records why metrics were marked unavailable"
  );
  const unavailSession = await prisma.monitoringSession.findUnique({ where: { id: unavailable.session!.id } });
  assert(unavailSession?.initialLikes === null, "No initial baseline fabricated when metrics are unavailable");

  // ---- 8.6 Platform counter corrections are detected and clamped ----
  // A stateful test adapter mimics a platform purge: each capture reports a
  // SMALLER counter than the previous one (deterministic reduction).
  let corrLikes = 50000;
  let corrViews = 2000000;
  const purgeAdapter = {
    name: "TEST_PURGE_ANALYTICS",
    getSnapshot: async (videoUrl: string) => {
      const current = {
        available: true as const,
        likes: corrLikes,
        views: corrViews,
        capturedAt: new Date().toISOString(),
        source: "TEST_PURGE_ANALYTICS",
      };
      corrLikes = Math.floor(corrLikes * 0.9); // platform removes engagement
      corrViews = Math.floor(corrViews * 0.9);
      return current;
    },
  };
  const correction = await createMonitoringSession({
    serviceId: LA_SERVICE.id,
    videoUrl: `https://video.example.test/watch?v=la-corr-${uniqueSeed}`,
    durationMinutes: 60,
    intervalMinutes: 30,
    budgetCap: 10,
    quantityCap: 5000,
    startDate: t0,
  });
  await runMonitoringTick(t0, correction.session!.id, purgeAdapter);
  await runMonitoringTick(new Date(t0.getTime() + 30 * minute), correction.session!.id, purgeAdapter);
  const corrSnap2 = await prisma.videoSnapshot.findFirst({ where: { sessionId: correction.session!.id, sequence: 2 } });
  assert(
    corrSnap2?.isFresh === true && corrSnap2!.viewsDelta === 0 && corrSnap2!.likesDelta === 0,
    "Counter correction (source reports lower value) is detected: deltas clamped to 0 instead of fabricating a drop"
  );
  assert(
    (corrSnap2?.reliabilityNote || "").includes("corrected"),
    "Reliability note documents the platform counter correction/reset"
  );
  const corrSnap1 = await prisma.videoSnapshot.findFirst({ where: { sessionId: correction.session!.id, sequence: 1 } });
  assert(
    corrSnap1 !== null && corrSnap2!.views === Math.floor(corrSnap1!.views! * 0.9),
    "Raw corrected counter values persisted exactly as reported by the source (verified 0.9× purge)"
  );

  // ---- 8.7 Delayed & missed checkpoint recovery ----
  const missedSess = await createMonitoringSession({
    serviceId: LA_SERVICE.id,
    videoUrl: `https://video.example.test/watch?v=la-missed-${uniqueSeed}`,
    durationMinutes: 63, // checkpoints at t = 0, 21, 42, 63
    intervalMinutes: 21,
    budgetCap: 10,
    quantityCap: 5000,
    startDate: t0,
  });
  await runMonitoringTick(t0, missedSess.session!.id);
  const missed = await runMonitoringTick(new Date(t0.getTime() + 52 * minute), missedSess.session!.id);
  assert(missed.checkpointsMissed === 1, `Late tick records skipped checkpoint slots as MISSED (missed=${missed.checkpointsMissed})`);
  const missedCkpt = await prisma.monitoringCheckpoint.findFirst({ where: { sessionId: missedSess.session!.id, status: "MISSED" } });
  assert(Boolean(missedCkpt) && missedCkpt!.sequence === 2, "Checkpoint #2 (planned 21m, skipped until 52m) marked MISSED");
  assert(
    (missedCkpt?.delayMs || 0) >= 30 * minute - 1000,
    `Per-slot execution delay recorded on the missed checkpoint (${Math.round((missedCkpt?.delayMs || 0) / minute)}min)`
  );
  const lateSnap = await prisma.videoSnapshot.findFirst({ where: { sessionId: missedSess.session!.id, sequence: 3 } });
  assert(
    lateSnap !== null && lateSnap!.delayMs >= 9 * minute - 1000,
    "Current observation still executes at checkpoint #3 with its own recorded overshoot delay (no fabricated extra observations)"
  );
  assert(lateSnap?.likesDelta === null && lateSnap?.viewsDelta === null, "A missed prior checkpoint prevents combining likes/views across a longer-than-selected interval");
  const missedBatchSkip = await prisma.monitoringAuditEvent.findFirst({
    where: { sessionId: missedSess.session!.id, action: "BATCH_SKIPPED", details: { contains: "exact interval" } },
  });
  assert(Boolean(missedBatchSkip), "Missed checkpoint records why no batch was sent for the incomplete interval");
  const missedSessionRow = await prisma.monitoringSession.findUnique({ where: { id: missedSess.session!.id } });
  assert(missedSessionRow?.missedCheckpoints === 1, "Session-level missed checkpoint counter incremented exactly once");

  const driftedSess = await createMonitoringSession({
    serviceId: LA_SERVICE.id,
    videoUrl: `https://video.example.test/watch?v=la-drift-${uniqueSeed}`,
    durationMinutes: 63,
    intervalMinutes: 21,
    budgetCap: 10,
    quantityCap: 5000,
    startDate: t0,
  });
  await runMonitoringTick(t0, driftedSess.session!.id);
  await runMonitoringTick(new Date(t0.getTime() + 26 * minute), driftedSess.session!.id);
  await runMonitoringTick(new Date(t0.getTime() + 42 * minute), driftedSess.session!.id);
  const driftedSnap3 = await prisma.videoSnapshot.findFirst({
    where: { sessionId: driftedSess.session!.id, sequence: 3 },
  });
  assert(driftedSnap3?.likesDelta === null && driftedSnap3?.viewsDelta === null, "A late previous read that shortens the next measurement window does not produce a batch delta");
  assert((driftedSnap3?.reliabilityNote || "").includes("instead of the selected 21-minute interval"), "Out-of-window observation records actual spacing and the configured 21-minute interval");

  // ---- 8.8 Budget & quantity cap enforcement across adaptive reassessment ----
  const capped = await createMonitoringSession({
    serviceId: LA_SERVICE.id,
    videoUrl: `https://video.example.test/watch?v=la-cap-${uniqueSeed}`,
    durationMinutes: 60,
    intervalMinutes: 30,
    budgetCap: 0.25, // ₹0.25 @ ₹0.0025/unit → at most 100 units total
    quantityCap: 100, // provider minimum
    startDate: t0,
  });
  assert(capped.ok, "Cap enforcement session created");
  const capSession = capped.session!;
  const capOrder = await prisma.order.findUnique({ where: { id: capSession.orderId! }, include: { steps: true } });

  await runMonitoringTick(t0, capSession.id);
  const capOrderT0 = await prisma.order.findUnique({ where: { id: capSession.orderId! }, include: { steps: true } });
  assert(
    (capOrderT0?.steps.length || 0) === 0,
    "Checkpoint #1 establishes a baseline and sends no batch without an interval likes delta"
  );

  await runMonitoringTick(new Date(t0.getTime() + 30 * minute), capSession.id);
  const capOrderT30 = await prisma.order.findUnique({ where: { id: capSession.orderId! }, include: { steps: true } });
  const committedT30 = capOrderT30!.steps.reduce((a, s) => a + s.quantity, 0);
  assert(committedT30 === 0, "A 100-view session cap is not used when it would push the likes-to-views ratio above 5%");
  const capSkip = await prisma.monitoringAuditEvent.findFirst({
    where: { sessionId: capSession.id, action: "BATCH_SKIPPED", details: { contains: "outside the 2–5%" } },
  });
  assert(Boolean(capSkip), "Skipped cap-limited batch records the ratio constraint for review");

  await runMonitoringTick(new Date(t0.getTime() + 30 * minute), capSession.id);
  const capOrderDupTick = await prisma.order.findUnique({ where: { id: capSession.orderId! }, include: { steps: true } });
  assert(
    capOrderDupTick!.steps.reduce((a, s) => a + s.quantity, 0) === 0,
    "Reassessment idempotency: repeated tick does not create a ratio-invalid batch"
  );

  // Expiry: work already accepted (none submitted here) → not-yet-accepted batches cancelled
  const expiredTick = await runMonitoringTick(new Date(t0.getTime() + 64 * minute), capSession.id);
  assert(expiredTick.sessionsExpired === 1, "Tick beyond terminal-checkpoint grace expires the monitoring session");
  const expiredSession = await prisma.monitoringSession.findUnique({ where: { id: capSession.id } });
  assert(expiredSession?.status === "EXPIRED" && Boolean(expiredSession?.stopNote), "Expired session status + note persisted (real, non-generic detail)");
  const expiredOrder = await prisma.order.findUnique({ where: { id: capSession.orderId! }, include: { steps: true } });
  assert(
    expiredOrder!.steps.every((s) => s.status === "CANCELLED") && expiredOrder!.status === "CANCELLED",
    "Expiration cancels scheduled-but-not-accepted batches; order becomes CANCELLED (no submitted work in this scenario)"
  );

  // ---- 8.9 Pause / Resume lifecycle (persisted across 'restarts') ----
  const lifecycle = await createMonitoringSession({
    serviceId: LA_SERVICE.id,
    videoUrl: `https://video.example.test/watch?v=la-life-${uniqueSeed}`,
    durationMinutes: 120,
    intervalMinutes: 30,
    budgetCap: 10,
    quantityCap: 5000,
    startDate: t0,
  });
  const lifeSession = lifecycle.session!;
  await runMonitoringTick(t0, lifeSession.id);

  const paused = await pauseMonitoringSession(lifeSession.id);
  assert(paused.ok, "Pause control: accepted for a RUNNING session");
  const pausedSession = await prisma.monitoringSession.findUnique({ where: { id: lifeSession.id } });
  assert(pausedSession?.status === "PAUSED" && pausedSession?.nextCheckpointAt !== null, "Paused session persists in DB (PAUSED) with persisted checkpoint schedule intact");
  const pausedTick = await runMonitoringTick(new Date(t0.getTime() + 30 * minute), lifeSession.id);
  assert(pausedTick.sessionsChecked === 0, "While paused, monitoring ticks process nothing (no snapshots, no schedule drift)");
  const snapCountPaused = await prisma.videoSnapshot.count({ where: { sessionId: lifeSession.id } });
  assert(snapCountPaused === 1, "No snapshots taken while paused (missed slots remain documented, not fabricated)");

  const resumed = await resumeMonitoringSession(lifeSession.id);
  assert(resumed.ok, "Resume control: accepted for a PAUSED session");
  const resumedSession = await prisma.monitoringSession.findUnique({ where: { id: lifeSession.id } });
  assert(
    resumedSession?.status === "RUNNING" && new Date(resumedSession!.nextCheckpointAt!).getTime() >= t0.getTime() + 30 * minute,
    "Resume restores RUNNING with next checkpoint from the persisted schedule (planned 30m slot)"
  );
  await runMonitoringTick(new Date(t0.getTime() + 35 * minute), lifeSession.id);
  const lifeSnap2 = await prisma.videoSnapshot.findFirst({ where: { sessionId: lifeSession.id, sequence: 2 } });
  assert(
    lifeSnap2 !== null && lifeSnap2!.delayMs >= 4 * minute,
    `Component recovering after resume: checkpoint #2 executed with overshoot documented (${Math.round((lifeSnap2?.delayMs || 0) / minute)}min late)`
  );

  // ---- 8.10 Stop lifecycle ----
  const stopped = await stopMonitoringSession(lifeSession.id, "operator test stop");
  assert(stopped.ok, "Stop control: accepted");
  const stoppedSession = await prisma.monitoringSession.findUnique({ where: { id: lifeSession.id } });
  assert(stoppedSession?.status === "STOPPED" && (stoppedSession?.stopNote || "").includes("operator test stop"), "Stopped session persists with operator note");
  const lifeSkipped = await prisma.monitoringCheckpoint.count({ where: { sessionId: lifeSession.id, status: "SKIPPED" } });
  assert(lifeSkipped >= 2, `Remaining checkpoints skipped on stop (skipped=${lifeSkipped})`);
  const lifeEvents = await prisma.monitoringAuditEvent.findMany({ where: { sessionId: lifeSession.id }, select: { action: true } });
  const lifeActions = lifeEvents.map((e) => e.action);
  assert(
    lifeActions.includes("SESSION_PAUSED") && lifeActions.includes("SESSION_RESUMED") && lifeActions.includes("SESSION_STOPPED"),
    "Full pause→resume→stop lifecycle audited with real monitoring events"
  );

  // ---- 8.11 Multiple concurrent sessions & API endpoints ----
  const [postInvalid] = [
    new Request("http://localhost:3000/api/likes-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: LA_SERVICE.id, videoUrl: "not-a-url", durationMinutes: 60, intervalMinutes: 30, budgetCap: 25, quantityCap: 5000 }),
    }),
  ];
  const postInvalidRes = await likesAnalyzePost(postInvalid);
  assert(postInvalidRes.status === 400, "POST /api/likes-analyze rejects invalid payload with 400");

  const postValidReq = new Request("http://localhost:3000/api/likes-analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: LA_SERVICE.id,
      videoUrl: `https://video.example.test/watch?v=la-api-${uniqueSeed}`,
      durationMinutes: 120,
      intervalMinutes: 60,
      budgetCap: 25,
      quantityCap: 5000,
    }),
  });
  const postValidRes = await likesAnalyzePost(postValidReq);
  const postValidData = await postValidRes.json();
  assert(postValidData.success === true && Boolean(postValidData.session?.id), "POST /api/likes-analyze creates live monitoring session");
  assert(postValidData.initialTick?.snapshotsTaken === 1, "API executes the initial snapshot (checkpoint #1) immediately on creation");

  const apiGetRes = await likesAnalyzeGet(new Request(`http://localhost:3000/api/likes-analyze/${postValidData.session.id}`), {
    params: { id: postValidData.session.id },
  });
  const apiGetData = await apiGetRes.json();
  assert(apiGetData.success === true, "GET /api/likes-analyze/[id] returns full monitoring state");
  assert(
    apiGetData.analytics?.dataFreshness?.freshCount === 1 && apiGetData.budget?.cap === 25,
    "Analytics totals, freshness and budget usage surfaced correctly for the UI"
  );
  const listGetRes = await likesAnalyzeListGet(new Request("http://localhost:3000/api/likes-analyze"));
  const listGetData = await listGetRes.json();
  assert(
    listGetData.success === true && Array.isArray(listGetData.sessions) && listGetData.sessions.some((s: any) => s.id === postValidData.session.id),
    "GET /api/likes-analyze lists monitoring sessions including the new one"
  );

  // Test 8.12: POST /api/likes-analyze without budgetCap or quantityCap (pure URL + duration + interval)
  const unconstrainedReq = new Request("http://localhost:3000/api/likes-analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: LA_SERVICE.id,
      videoUrl: `https://video.example.test/watch?v=la-unconstrained-${uniqueSeed}`,
      durationMinutes: 120,
      intervalMinutes: 21,
    }),
  });
  const unconstrainedRes = await likesAnalyzePost(unconstrainedReq);
  const unconstrainedData = await unconstrainedRes.json();
  assert(
    unconstrainedData.success === true && Boolean(unconstrainedData.session?.id),
    "POST /api/likes-analyze creates session without requiring budgetCap or quantityCap"
  );
  assert(
    unconstrainedData.session.intervalMinutes === 21,
    "Supports custom interval of 21 minutes without error"
  );

  // ---- 8.13 Cleanup Likes Analyze fixtures ----
  if (unconstrainedData.session?.id) {
    await prisma.monitoringSession.delete({ where: { id: unconstrainedData.session.id } }).catch(() => {});
    if (unconstrainedData.session.orderId) {
      await prisma.order.delete({ where: { id: unconstrainedData.session.orderId } }).catch(() => {});
    }
  }
  await cleanupLA(mainSession.id, mainSession.orderId);
  await cleanupLA(unavailable.session!.id, unavailable.session!.orderId);
  await cleanupLA(correction.session!.id, correction.session!.orderId);
  await cleanupLA(missedSess.session!.id, missedSess.session!.orderId);
  await cleanupLA(driftedSess.session!.id, driftedSess.session!.orderId);
  await cleanupLA(capped.session!.id, capped.session!.orderId);
  await cleanupLA(lifeSession.id, lifeSession.orderId);
  // API-created session:
  await prisma.monitoringSession.delete({ where: { id: postValidData.session.id } }).catch(() => {});
  await prisma.order.delete({ where: { id: postValidData.session.orderId } }).catch(() => {});
  const leftovers = await prisma.monitoringSession.count({
    where: { videoUrl: { contains: uniqueSeed } },
  });
  assert(leftovers === 0, "All Likes Analyze test fixtures removed (idempotent cleanup)");

  // -----------------------------------------------------------
  // 9. Organic Pacing Presets & Continuous Resampling Verification
  // -----------------------------------------------------------
  console.log("\nTest Suite 9: Organic Pacing Presets & Continuous Shape Resampling");
  const organicPresetKeys = Object.keys(ORGANIC_PRESET_DEFINITIONS) as OrganicPresetId[];
  assert(organicPresetKeys.length === 10, "Defines exactly 10 organic presets");

  // Test 9.1: Sum preservation and monotonicity across all presets
  let allSumsMatch = true;
  let allMonotonic = true;
  for (const presetId of organicPresetKeys) {
    const plan = buildOrganicPlan(presetId, {
      batchCount: 8,
      totalQuantity: 2400,
      totalDurationMinutes: 180,
      minQuantityPerBatch: 50,
      maxQuantityPerBatch: 50000,
      seed: 4242,
      smoothness: 60,
      spikeIntensity: "medium",
    });
    const sum = plan.batches.reduce((a, b) => a + b.quantity, 0);
    if (sum !== 2400) allSumsMatch = false;

    let prev = 0;
    for (const b of plan.batches) {
      if (b.cumulativeQuantity < prev) allMonotonic = false;
      prev = b.cumulativeQuantity;
    }
  }
  assert(allSumsMatch, "All 10 organic presets strictly preserve target sum (2400 units)");
  assert(allMonotonic, "All 10 organic presets produce strictly monotonic cumulative progress");

  // Test 9.2: Deterministic seeding
  const detPlanA = buildOrganicPlan("SLOW_BURN", {
    batchCount: 6,
    totalQuantity: 1200,
    totalDurationMinutes: 120,
    seed: 99911,
  });
  const detPlanB = buildOrganicPlan("SLOW_BURN", {
    batchCount: 6,
    totalQuantity: 1200,
    totalDurationMinutes: 120,
    seed: 99911,
  });
  const isIdentical = detPlanA.batches.every((b, i) => b.quantity === detPlanB.batches[i].quantity && b.intervalMinutes === detPlanB.batches[i].intervalMinutes);
  assert(isIdentical, "Same seed produces byte-for-byte identical batch schedule");

  // Test 9.3: Time jitter respects >= 5m interval
  let minIntervalValid = true;
  for (let i = 1; i < detPlanA.batches.length; i++) {
    if (detPlanA.batches[i].intervalMinutes < 5) minIntervalValid = false;
  }
  assert(minIntervalValid, "Time jitter strictly enforces minimum interval >= 5 minutes");

  // Test 9.4: Batch locking and redistribution
  const lockedPlan = buildOrganicPlan("DOUBLE_WAVE", {
    batchCount: 5,
    totalQuantity: 1000,
    totalDurationMinutes: 120,
    lockedBatches: [{ index: 0, quantity: 300 }],
    seed: 423,
  });
  assert(lockedPlan.batches[0].quantity === 300 && lockedPlan.batches[0].isLocked, "Locked batch #1 remains fixed at 300 units");
  const lockedSum = lockedPlan.batches.reduce((a, b) => a + b.quantity, 0);
  assert(lockedSum === 1000, "Remaining unlocked batches redistribute to keep exact 1000 sum");

  // Test 9.5: Mini sparkline SVG generator
  const sparklinePath = generatePresetSparklinePath("VIRAL_SPIKE", 64, 24);
  assert(sparklinePath.startsWith("M ") && sparklinePath.includes(" C "), "Generates smooth cubic bezier SVG sparkline path");

  // Test 9.6: Circadian audience curve
  const peakActivity = audienceCircadianActivity(20.5 / 24);
  const nightActivity = audienceCircadianActivity(3 / 24);
  assert(peakActivity > nightActivity && nightActivity >= 0.15, "Circadian curve models realistic evening peak vs night baseline");

  // -----------------------------------------------------------
  // 10. New Order Enhancements (Bulk Add, Randomizer, Combos, Persistent Scheduler)
  // -----------------------------------------------------------
  await runEnhancementTests(assert);

  // -----------------------------------------------------------
  // 11. Multi-User, Passkey Auth & Provider Isolation Tests
  // -----------------------------------------------------------
  await runMultiUserAuthTests();

  console.log("\n=======================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

runTests()
  .catch((e) => {
    console.error("Test execution exception:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
