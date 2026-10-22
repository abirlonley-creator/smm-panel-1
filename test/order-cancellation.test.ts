import assert from "node:assert/strict";
import { test } from "node:test";
import { cancelOrder, type CancellationDependencies, type CancellationTarget } from "../src/lib/orders/cancellation";
import { normalizeOrderDetail, normalizeOrderSteps, type OrderDetailStep } from "../src/lib/orders/order-detail";

interface TestOrder extends CancellationTarget {
  requestedQuantity: number;
  deliveredQuantity: number;
  remainingQuantity: number;
}

interface TestOrderDetail extends TestOrder {
  service: { id: string; name: string };
  steps: OrderDetailStep[];
  providerRecords: Array<{ id: string; action: string }>;
}

function makeStep(id: string, stepNumber: number, status: string, quantity: number): OrderDetailStep {
  return {
    id,
    stepNumber,
    scheduledTime: "2026-10-20T12:00:00.000Z",
    quantity,
    status,
    retryCount: 0,
  };
}

function createHarness(options?: {
  status?: string;
  steps?: unknown;
  providerResult?: { success: boolean; error?: string };
  providerError?: Error;
}) {
  const order: TestOrder = {
    id: "order-1",
    orderRef: "SMM-10001",
    status: options?.status || "PROCESSING",
    providerOrderId: "provider-10001",
    requestedQuantity: 100,
    deliveredQuantity: 25,
    remainingQuantity: 75,
  };
  let storedSteps: unknown = options?.steps ?? [
    makeStep("step-submitted", 1, "SUBMITTED", 25),
    makeStep("step-pending", 2, "PENDING", 50),
    makeStep("step-paused", 3, "PAUSED", 25),
  ];
  let providerCalls = 0;
  let persistCalls = 0;
  let auditCalls = 0;

  const dependencies: CancellationDependencies<TestOrderDetail> = {
    findOrder: async (identifier) =>
      identifier === order.id || identifier === order.orderRef
        ? { id: order.id, orderRef: order.orderRef, status: order.status, providerOrderId: order.providerOrderId }
        : null,
    getOrderDetail: async () => {
      const normalized = normalizeOrderDetail({
        ...order,
        service: { id: "service-1", name: "Test service" },
        steps: storedSteps,
        providerRecords: [{ id: "record-1", action: "add" }],
      });
      return normalized as TestOrderDetail | null;
    },
    cancelProviderOrder: async () => {
      providerCalls++;
      if (options?.providerError) throw options.providerError;
      return options?.providerResult ?? { success: true };
    },
    persistCancellation: async () => {
      persistCalls++;
      order.status = "CANCELLED";
      if (Array.isArray(storedSteps)) {
        storedSteps = storedSteps.map((step) => {
          if (!step || typeof step !== "object") return step;
          const row = step as Record<string, unknown>;
          return ["PENDING", "PROCESSING", "PAUSED"].includes(String(row.status))
            ? { ...row, status: "CANCELLED" }
            : row;
        });
      }
    },
    writeAudit: async () => {
      auditCalls++;
    },
  };

  return {
    order,
    dependencies,
    counts: () => ({ providerCalls, persistCalls, auditCalls }),
    reload: () => dependencies.getOrderDetail(order.id),
  };
}

test("successful cancellation returns the complete order and preserves step and quantity history", async () => {
  const harness = createHarness();
  const result = await cancelOrder("order-1", harness.dependencies);

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.order?.status, "CANCELLED");
  assert.equal(result.body.order?.deliveredQuantity, 25);
  assert.equal(result.body.order?.remainingQuantity, 75);
  assert.deepEqual(result.body.order?.steps.map((step) => step.id), [
    "step-submitted",
    "step-pending",
    "step-paused",
  ]);
  assert.deepEqual(result.body.order?.steps.map((step) => step.status), [
    "SUBMITTED",
    "CANCELLED",
    "CANCELLED",
  ]);
  assert.deepEqual(harness.counts(), { providerCalls: 1, persistCalls: 1, auditCalls: 1 });
});

test("repeated cancellation is idempotent and returns full details without repeating side effects", async () => {
  const harness = createHarness();
  await cancelOrder("order-1", harness.dependencies);
  const repeated = await cancelOrder("order-1", harness.dependencies);

  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.success, true);
  assert.equal(repeated.body.alreadyCancelled, true);
  assert.equal(repeated.body.order?.steps.length, 3);
  assert.deepEqual(harness.counts(), { providerCalls: 1, persistCalls: 1, auditCalls: 1 });
});

test("missing, null, non-array, and malformed step values normalize safely", () => {
  assert.deepEqual(normalizeOrderDetail({ id: "missing" })?.steps, []);
  assert.deepEqual(normalizeOrderDetail({ id: "null", steps: null })?.steps, []);
  assert.deepEqual(normalizeOrderDetail({ id: "wrong-type", steps: { stepNumber: 1 } })?.steps, []);

  const valid = makeStep("step-valid", 1, "PENDING", 50);
  assert.deepEqual(normalizeOrderSteps([null, "bad", {}, valid]), [valid]);
});

test("an empty step list stays empty and does not create placeholder batches", () => {
  assert.deepEqual(normalizeOrderDetail({ id: "instant", steps: [] })?.steps, []);
  assert.deepEqual(normalizeOrderDetail({ id: "instant" })?.steps, []);
});

test("cancelling an order with no scheduled steps does not fabricate batch history", async () => {
  const harness = createHarness({ steps: [] });
  const result = await cancelOrder("order-1", harness.dependencies);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.order?.steps, []);
});

test("failed provider cancellation leaves order and step records unchanged", async () => {
  const harness = createHarness({ providerResult: { success: false, error: "Provider rejected cancellation" } });
  const result = await cancelOrder("order-1", harness.dependencies);

  assert.equal(result.status, 502);
  assert.equal(result.body.success, false);
  assert.match(result.body.error || "", /rejected cancellation/i);
  assert.equal(harness.order.status, "PROCESSING");
  assert.deepEqual(harness.counts(), { providerCalls: 1, persistCalls: 0, auditCalls: 0 });
});

test("provider cancellation exceptions leave local state unchanged", async () => {
  const harness = createHarness({ providerError: new Error("Provider unavailable") });
  const result = await cancelOrder("order-1", harness.dependencies);

  assert.equal(result.status, 502);
  assert.match(result.body.error || "", /provider unavailable/i);
  assert.equal(harness.order.status, "PROCESSING");
  assert.deepEqual(harness.counts(), { providerCalls: 1, persistCalls: 0, auditCalls: 0 });
});

test("page reload after cancellation receives the same step history and statuses", async () => {
  const harness = createHarness();
  await cancelOrder("order-1", harness.dependencies);

  const reloaded = normalizeOrderDetail(await harness.reload());
  assert.equal(reloaded?.status, "CANCELLED");
  assert.deepEqual(reloaded?.steps.map((step) => step.status), [
    "SUBMITTED",
    "CANCELLED",
    "CANCELLED",
  ]);
  assert.equal(reloaded?.steps.length, 3);
});

test("existing active orders keep their real step statuses and quantities", () => {
  const active = normalizeOrderDetail({
    id: "active",
    status: "PROCESSING",
    requestedQuantity: 100,
    deliveredQuantity: 25,
    steps: [makeStep("submitted", 1, "SUBMITTED", 25), makeStep("queued", 2, "PENDING", 75)],
  });

  assert.deepEqual(active?.steps.map(({ status, quantity }) => ({ status, quantity })), [
    { status: "SUBMITTED", quantity: 25 },
    { status: "PENDING", quantity: 75 },
  ]);
  assert.equal(active?.deliveredQuantity, 25);
});
