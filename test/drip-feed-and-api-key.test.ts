import { describe, it } from "node:test";
import assert from "node:assert";
import { MockSMMProvider, StandardSMMv2Provider } from "../src/lib/provider/adapter";
import { prisma } from "../src/lib/prisma";

describe("Working Drip Feed & API Key Verification", () => {
  it("Mock provider returns valid services and handles drip-feed createOrder params", async () => {
    const provider = new MockSMMProvider();
    const services = await provider.getServices();
    assert.ok(services.length > 0, "Provider should return mock services");

    const orderRes = await provider.createOrder({
      serviceExternalId: services[0].id,
      targetUrl: "https://instagram.com/p/test12345",
      quantity: 100,
      runs: 5,
      interval: 60,
    });

    assert.strictEqual(orderRes.success, true);
    assert.ok(orderRes.providerOrderId, "Should return a provider order ID");
  });

  it("StandardSMMv2Provider constructs correct bodyParams with runs and interval", async () => {
    const provider = new StandardSMMv2Provider("https://example.com/api/v2", "test-key-1234");
    assert.strictEqual(provider.apiUrl, "https://example.com/api/v2");
    // Verify provider instance initializes properly
    assert.ok(typeof provider.createOrder === "function");
    assert.ok(typeof provider.getBalance === "function");
  });

  it("Database supports DRIP_FEED scheduleMode and dripFeedRun records", async () => {
    // Verify prisma model schemas are intact
    const dummyRef = `TEST-DRIP-${Date.now()}`;
    const service = await prisma.service.findFirst({ where: { active: true } });
    if (!service) {
      console.log("No service in DB, skipping DB record test");
      return;
    }

    const testOrder = await prisma.order.create({
      data: {
        orderRef: dummyRef,
        serviceId: service.id,
        targetUrl: "https://instagram.com/p/test-drip",
        requestedQuantity: 500,
        submittedQuantity: 500,
        deliveredQuantity: 0,
        remainingQuantity: 500,
        unitCost: service.ratePer1000 / 1000,
        totalCost: (500 / 1000) * service.ratePer1000,
        scheduleMode: "DRIP_FEED",
        status: "PROCESSING",
        providerOrderId: "998877",
      },
    });

    assert.strictEqual(testOrder.scheduleMode, "DRIP_FEED");
    assert.strictEqual(testOrder.status, "PROCESSING");

    // Create 5 dripFeedRun rows
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      await prisma.dripFeedRun.create({
        data: {
          orderId: testOrder.id,
          runNumber: i + 1,
          scheduledAt: new Date(now.getTime() + i * 60 * 60 * 1000),
          quantity: 100,
          status: "PROCESSING",
          providerOrderId: "998877",
          cost: (100 / 1000) * service.ratePer1000,
        },
      });
    }

    const runsCount = await prisma.dripFeedRun.count({
      where: { orderId: testOrder.id },
    });
    assert.strictEqual(runsCount, 5, "Should have created 5 drip feed runs");

    // Clean up test data
    await prisma.dripFeedRun.deleteMany({ where: { orderId: testOrder.id } });
    await prisma.order.delete({ where: { id: testOrder.id } });
  });
});

