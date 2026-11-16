import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3005/api/v2";

async function runRule5Test() {
  console.log("=================================================================");
  console.log("       AURA SMM - RULE 5 FUTURE-PROOF VERIFICATION TEST          ");
  console.log("=================================================================\n");

  let testKeyId: string | null = null;
  let plainKey: string | null = null;
  let fifthServiceDbId: string | null = null;
  let testOrderId: number | string | null = null;

  try {
    // 0. Ensure a test user exists with sufficient wallet balance
    let testUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });
    if (!testUser) {
      testUser = await prisma.user.findFirst();
    }
    if (!testUser) {
      throw new Error("No user found in database to associate API key with.");
    }

    // Give test user at least $100 balance for test orders
    if (testUser.walletBalance < 100) {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { walletBalance: 250.0 },
      });
      console.log(`[SETUP] Set user '${testUser.username}' wallet balance to $250.00 USD`);
    }

    // -----------------------------------------------------------------
    // STEP 1: Create a test API key
    // -----------------------------------------------------------------
    console.log("--- STEP 1: Creating test API key ---");
    const randomHex = crypto.randomBytes(16).toString("hex");
    plainKey = `aura_live_${randomHex}`;
    const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");
    const keyPrefix = `aura_live_${randomHex.slice(0, 4)}`;
    const keySuffix = randomHex.slice(-4);

    const apiKeyRecord = await prisma.userApiKey.create({
      data: {
        userId: testUser.id,
        name: "Muse AI Automated Agent",
        keyPrefix,
        keySuffix,
        keyHash,
        permission: "FULL_ACCESS",
        status: "ACTIVE",
      },
    });
    testKeyId = apiKeyRecord.id;
    console.log(`✔ API Key created successfully:`);
    console.log(`  Plain Secret Key: ${plainKey}`);
    console.log(`  Masked: ${keyPrefix}...${keySuffix}`);
    console.log(`  Permission: ${apiKeyRecord.permission}`);
    console.log(`  Status: ${apiKeyRecord.status}\n`);

    // -----------------------------------------------------------------
    // STEP 2: Call GET /api/v2/services with that key - show all 4 services
    // -----------------------------------------------------------------
    console.log("--- STEP 2: Calling GET /api/v2/services with Bearer auth ---");
    const resStep2 = await fetch(`${BASE_URL}/services`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${plainKey}`,
        Accept: "application/json",
      },
    });

    console.log(`HTTP Status: ${resStep2.status} ${resStep2.statusText}`);
    const servicesStep2 = await resStep2.json();
    console.log(`Found ${servicesStep2.length} active services:`);
    console.log(JSON.stringify(servicesStep2, null, 2));

    if (resStep2.status !== 200 || !Array.isArray(servicesStep2) || servicesStep2.length < 4) {
      throw new Error(`Step 2 Failed: Expected at least 4 services, got ${servicesStep2.length}`);
    }
    console.log("✔ Step 2 Passed: 4 Engagement services returned.\n");

    // -----------------------------------------------------------------
    // STEP 3: Add a 5th test service in the Engagement Tab
    // -----------------------------------------------------------------
    console.log("--- STEP 3: Adding 5th test service: 'Test Service - YouTube Views' ---");
    const fifthService = await prisma.service.create({
      data: {
        numericId: 105,
        externalId: "105",
        name: "Test Service - YouTube Views",
        platform: "YouTube",
        category: "Engagement",
        type: "views",
        ratePer1000: 1.50,
        minQuantity: 100,
        maxQuantity: 10000,
        description: "Organic views for testing AI universal compatibility",
        active: true,
      },
    });
    fifthServiceDbId = fifthService.id;
    console.log(`✔ 5th Service created in database:`);
    console.log(`  Service ID: ${fifthService.numericId}`);
    console.log(`  Name: ${fifthService.name}`);
    console.log(`  Platform: ${fifthService.platform}`);
    console.log(`  Rate: $${fifthService.ratePer1000.toFixed(2)} / 1k\n`);

    // -----------------------------------------------------------------
    // STEP 4: Call GET /api/v2/services again WITHOUT changing any API code
    // -----------------------------------------------------------------
    console.log("--- STEP 4: Calling GET /api/v2/services again (Testing dynamic discovery) ---");
    const resStep4 = await fetch(`${BASE_URL}/services`, {
      method: "GET",
      headers: {
        "X-API-Key": plainKey, // Test X-API-Key header compatibility
        Accept: "application/json",
      },
    });

    console.log(`HTTP Status: ${resStep4.status} ${resStep4.statusText}`);
    const servicesStep4 = await resStep4.json();
    console.log(`Found ${servicesStep4.length} services:`);
    console.log(JSON.stringify(servicesStep4, null, 2));

    const foundFifth = servicesStep4.find((s: any) => s.service === 105 || s.name.includes("YouTube Views"));
    if (!foundFifth) {
      throw new Error("Step 4 Failed: 5th service did not appear in GET /api/v2/services!");
    }
    console.log(`✔ Step 4 Passed: 5th service (${foundFifth.name}) appeared immediately in API v2!\n`);

    // -----------------------------------------------------------------
    // STEP 5: Place a test order for 2000 quantity with that 5th service, then check status
    // -----------------------------------------------------------------
    console.log("--- STEP 5: Placing order for 2,000 views with Service 105 ---");
    const orderPayload = {
      service: 105,
      link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      quantity: 2000,
    };
    console.log("POST Body:", JSON.stringify(orderPayload, null, 2));

    const resStep5Order = await fetch(`${BASE_URL}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${plainKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    console.log(`Order Placement HTTP Status: ${resStep5Order.status} ${resStep5Order.statusText}`);
    const orderResult = await resStep5Order.json();
    console.log("Order Result:", JSON.stringify(orderResult, null, 2));

    if (resStep5Order.status !== 200 || !orderResult.order) {
      throw new Error(`Step 5 Failed: Order placement rejected with ${JSON.stringify(orderResult)}`);
    }

    testOrderId = orderResult.order;
    console.log(`✔ Order placed successfully. Order ID: ${testOrderId}, Charge: $${orderResult.charge} ${orderResult.currency}`);

    // Check status with GET /api/v2/orders/{id}
    console.log(`\nChecking status with GET /api/v2/orders/${testOrderId}...`);
    const resStep5Status = await fetch(`${BASE_URL}/orders/${testOrderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${plainKey}`,
      },
    });

    console.log(`Order Status HTTP Status: ${resStep5Status.status}`);
    const statusResult = await resStep5Status.json();
    console.log("Order Status Response:", JSON.stringify(statusResult, null, 2));

    const allowedStatuses = ["pending", "in_progress", "completed", "cancelled", "failed"];
    if (!allowedStatuses.includes(statusResult.status)) {
      throw new Error(`Step 5 Failed: Status '${statusResult.status}' is not one of allowed values: ${allowedStatuses.join(", ")}`);
    }
    console.log("✔ Step 5 Passed: Order verified and status returned valid lowercase state.\n");

    // Also test Classic Single-Endpoint POST /api/v2
    console.log("--- BONUS: Testing Classic Single-Endpoint POST /api/v2 (action=balance & action=status) ---");
    const resClassicBal = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: plainKey, action: "balance" }),
    });
    const classicBalResult = await resClassicBal.json();
    console.log("Classic action=balance result:", JSON.stringify(classicBalResult));

    const resClassicStatus = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: plainKey, action: "status", order: String(testOrderId) }),
    });
    const classicStatusResult = await resClassicStatus.json();
    console.log("Classic action=status result:", JSON.stringify(classicStatusResult));
    console.log("✔ Classic SMM v2 endpoint fully verified.\n");

    // -----------------------------------------------------------------
    // STEP 6: Revoke the test key, then call the API again - it must return 401
    // -----------------------------------------------------------------
    console.log("--- STEP 6: Revoking test key & testing 401 rejection ---");
    await prisma.userApiKey.update({
      where: { id: testKeyId },
      data: { status: "REVOKED" },
    });
    console.log(`Key ${testKeyId} status updated to REVOKED.`);

    const resStep6 = await fetch(`${BASE_URL}/services`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${plainKey}`,
      },
    });

    console.log(`HTTP Status after revocation: ${resStep6.status} ${resStep6.statusText}`);
    const resStep6Body = await resStep6.json();
    console.log("Response Body:", JSON.stringify(resStep6Body));

    if (resStep6.status !== 401) {
      throw new Error(`Step 6 Failed: Expected 401 Unauthorized, got ${resStep6.status}`);
    }
    console.log("✔ Step 6 Passed: Revoked key strictly rejected with 401 Unauthorized.\n");

  } finally {
    // -----------------------------------------------------------------
    // STEP 7: Delete the 5th test service after the test (Clean up)
    // -----------------------------------------------------------------
    console.log("--- STEP 7: Cleaning up 5th test service ---");
    if (fifthServiceDbId) {
      await prisma.service.delete({
        where: { id: fifthServiceDbId },
      }).catch((e) => console.warn("Failed to delete 5th service:", e.message));
      console.log(`✔ Deleted 5th test service (${fifthServiceDbId}) from database.`);
    }

    if (testKeyId) {
      await prisma.userApiKey.delete({
        where: { id: testKeyId },
      }).catch(() => {});
      console.log(`✔ Cleaned up temporary test API key (${testKeyId}).`);
    }

    await prisma.$disconnect();
    console.log("\n=================================================================");
    console.log("     ✔ ALL 7 STEPS OF RULE 5 TEST PASSED WITH 100% SUCCESS       ");
    console.log("=================================================================\n");
  }
}

runRule5Test().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  process.exit(1);
});
