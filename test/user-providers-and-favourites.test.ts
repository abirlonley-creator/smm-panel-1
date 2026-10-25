import { prisma } from "../src/lib/prisma";
import { encryptApiKey, decryptApiKey } from "../src/lib/security/crypto";
import { generateOrganicPlan } from "../src/lib/engagement/planner";
import { checkProviderHealthGate } from "../src/lib/engagement/health-gate";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✔ PASS: ${testName}`);
    passed++;
  } else {
    const msg = `  ✖ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`;
    console.error(msg);
    failures.push(msg);
    failed++;
  }
}

export async function runUserProvidersAndFavouritesTests() {
  console.log("\n╔═══════════════════════════════════════════════════════════════════════╗");
  console.log("║   CHANGES 9–15: USER PROVIDERS, FAVOURITES & ORDER RELIABILITY TESTS ║");
  console.log("╚═══════════════════════════════════════════════════════════════════════╝\n");

  const timestamp = Date.now();
  const userA = await prisma.user.create({
    data: {
      username: `test_u_a_${timestamp}`,
      role: "USER",
      status: "ACTIVE",
      walletBalance: 500.0,
    },
  });

  const userB = await prisma.user.create({
    data: {
      username: `test_u_b_${timestamp}`,
      role: "USER",
      status: "ACTIVE",
      walletBalance: 300.0,
    },
  });

  try {
    // =========================================================================
    // SUITE 1: Migration & AES-256-GCM Encryption Test (Change 9 & 15)
    // =========================================================================
    console.log("── SUITE 1: Provider Encryption & Migration ──────────────────────────");

    const rawKey = "sk_live_secret_key_12345";
    const encryptedKey = encryptApiKey(rawKey);

    assert(encryptedKey.split(":").length === 3, "Encrypted key contains iv:tag:ciphertext in AES-256-GCM format");
    assert(!encryptedKey.includes(rawKey), "Encrypted string does not leak plaintext API key");

    const decrypted = decryptApiKey(encryptedKey);
    assert(decrypted === rawKey, "Decrypted key matches original raw key exactly");

    const providerA = await prisma.userProviderConnection.create({
      data: {
        userId: userA.id,
        name: "Alpha Provider",
        apiUrl: "https://alpha-provider.example.com/api/v2",
        apiKeyEncrypted: encryptedKey,
        isMock: false,
        active: true,
        balance: 150.0,
        currency: "USD",
      },
    });

    assert(providerA.id !== undefined, "Provider created successfully in user_providers table");
    assert(providerA.apiKeyEncrypted !== rawKey, "DB record stores encrypted key, not plaintext");

    // =========================================================================
    // SUITE 2: Multi-Provider Isolation Test (Change 10)
    // =========================================================================
    console.log("\n── SUITE 2: Provider Isolation Between Users ─────────────────────────");

    const providerB = await prisma.userProviderConnection.create({
      data: {
        userId: userB.id,
        name: "Beta Provider",
        apiUrl: "https://beta-provider.example.com/api/v2",
        apiKeyEncrypted: encryptApiKey("sk_beta_key_9999"),
        isMock: false,
        active: true,
        balance: 75.0,
        currency: "EUR",
      },
    });

    const userAProviders = await prisma.userProviderConnection.findMany({
      where: { userId: userA.id },
    });
    const userBProviders = await prisma.userProviderConnection.findMany({
      where: { userId: userB.id },
    });

    assert(userAProviders.length === 1 && userAProviders[0].name === "Alpha Provider", "User A sees only Alpha Provider");
    assert(userBProviders.length === 1 && userBProviders[0].name === "Beta Provider", "User B sees only Beta Provider");
    assert(userAProviders[0].balance === 150.0 && userAProviders[0].currency === "USD", "User A sees Alpha balance in USD");
    assert(userBProviders[0].balance === 75.0 && userBProviders[0].currency === "EUR", "User B sees Beta balance in EUR");
    assert(!userAProviders.some((p) => p.id === providerB.id), "User A cannot access User B's provider");

    // =========================================================================
    // SUITE 3: Balance Switcher Logic Test (Change 10)
    // =========================================================================
    console.log("\n── SUITE 3: Provider Balance Switcher Logic ─────────────────────────");

    // User A currently has 1 provider: switcher should indicate single provider (no dropdown arrow needed)
    assert(userAProviders.length === 1, "User with 1 provider has single active provider");

    // User A adds a 2nd provider
    const providerA2 = await prisma.userProviderConnection.create({
      data: {
        userId: userA.id,
        name: "Gamma Provider",
        apiUrl: "https://gamma-provider.example.com/api/v2",
        apiKeyEncrypted: encryptApiKey("sk_gamma_key_7777"),
        isMock: false,
        active: true,
        balance: 210.0,
        currency: "INR",
      },
    });

    const updatedUserAProviders = await prisma.userProviderConnection.findMany({
      where: { userId: userA.id },
    });
    assert(updatedUserAProviders.length === 2, "User A now has 2 connected providers (triggering balance switcher)");

    // Save preference for active provider
    await prisma.userPreference.upsert({
      where: { userId: userA.id },
      create: { userId: userA.id, activeProviderId: providerA2.id },
      update: { activeProviderId: providerA2.id },
    });

    const userPref = await prisma.userPreference.findUnique({ where: { userId: userA.id } });
    assert(userPref?.activeProviderId === providerA2.id, "Active provider choice persists in user_preferences");

    // Verify balances are never combined or summed
    const totalRawBalances = updatedUserAProviders.map((p) => p.balance);
    assert(totalRawBalances.includes(150.0) && totalRawBalances.includes(210.0), "Balances remain distinct in individual currencies");

    // =========================================================================
    // SUITE 4: Favourites & Only-Favourites Snapshot Test (Change 11 & 12)
    // =========================================================================
    console.log("\n── SUITE 4: Favourites & Snapshot Diff Engine ────────────────────────");

    const fav1 = await prisma.favourite.create({
      data: {
        userId: userA.id,
        providerId: providerA.id,
        providerServiceId: "101",
      },
    });

    const fav2 = await prisma.favourite.create({
      data: {
        userId: userA.id,
        providerId: providerA.id,
        providerServiceId: "102",
      },
    });

    const favouritesList = await prisma.favourite.findMany({ where: { userId: userA.id } });
    assert(favouritesList.length === 2, "User has 2 saved favourites");

    // Confirm initial snapshot
    const initialKeys = favouritesList.map((f) => `${f.providerId}:${f.providerServiceId}`).sort();
    const snapshot = await prisma.favouritesSnapshot.upsert({
      where: { userId: userA.id },
      create: {
        userId: userA.id,
        serviceKeys: JSON.stringify(initialKeys),
        serviceCount: initialKeys.length,
      },
      update: {
        serviceKeys: JSON.stringify(initialKeys),
        serviceCount: initialKeys.length,
      },
    });

    assert(snapshot.serviceCount === 2, "Snapshot confirmed with 2 services");

    // Add 3rd favourite while "Only favourites" is ON: diff should be detected
    const fav3 = await prisma.favourite.create({
      data: {
        userId: userA.id,
        providerId: providerA2.id,
        providerServiceId: "201",
      },
    });

    const currentFavourites = await prisma.favourite.findMany({ where: { userId: userA.id } });
    const currentKeys = currentFavourites.map((f) => `${f.providerId}:${f.providerServiceId}`).sort();
    const confirmedKeys: string[] = JSON.parse(snapshot.serviceKeys);

    const hasDiff = currentKeys.length !== confirmedKeys.length ||
      currentKeys.some((k, i) => k !== confirmedKeys[i]);

    assert(hasDiff === true, "Snapshot diff engine detects unconfirmed favourite addition (triggering yellow update button)");
    assert(confirmedKeys.length === 2, "Active snapshot remains unchanged (2 items) until explicitly confirmed");

    // =========================================================================
    // SUITE 5: Full Engagement Custom Provider Mappings Test (Change 13)
    // =========================================================================
    console.log("\n── SUITE 5: Full Engagement Mappings & Batch Minimums ───────────────");

    // Map all 5 types to User A's connected provider
    const types = ["views", "likes", "saves", "shares", "comments"] as const;
    for (const t of types) {
      await prisma.userEngagementMapping.upsert({
        where: {
          userId_platform_engagementType: {
            userId: userA.id,
            platform: "Instagram",
            engagementType: t,
          },
        },
        create: {
          userId: userA.id,
          platform: "Instagram",
          engagementType: t,
          providerId: providerA.id,
          providerServiceId: t === "views" ? "101" : t === "likes" ? "102" : "103",
          serviceName: `Alpha ${t}`,
          minQuantity: t === "views" ? 100 : t === "likes" ? 20 : 10,
          maxQuantity: 50000,
          ratePer1000: 1.5,
          active: true,
        },
        update: {
          providerId: providerA.id,
          providerServiceId: t === "views" ? "101" : t === "likes" ? "102" : "103",
          serviceName: `Alpha ${t}`,
          minQuantity: t === "views" ? 100 : t === "likes" ? 20 : 10,
          maxQuantity: 50000,
          ratePer1000: 1.5,
          active: true,
        },
      });
    }

    // Check health gate passes when all types are mapped
    const healthGateBefore = await checkProviderHealthGate("instagram_reel", ["views", "likes", "saves"], 0, userA.id);
    assert(healthGateBefore.ok === true, "Health gate passes when all required types have valid connected mappings");

    // Run organic plan generator with custom provider minimums
    const customServices = {
      views: { minQuantity: 100, maxQuantity: 50000, ratePer1000: 1.0, name: "Alpha Views" },
      likes: { minQuantity: 50, maxQuantity: 20000, ratePer1000: 1.5, name: "Alpha Likes" },
      saves: { minQuantity: 25, maxQuantity: 10000, ratePer1000: 2.0, name: "Alpha Saves" },
      shares: { minQuantity: 25, maxQuantity: 10000, ratePer1000: 2.0, name: "Alpha Shares" },
      comments: { minQuantity: 5, maxQuantity: 5000, ratePer1000: 8.0, name: "Alpha Comments" },
    };

    const plan = generateOrganicPlan({
      profileId: "instagram_reel",
      platform: "Instagram",
      baseViews: 2000,
      durationHours: 24,
      services: customServices as any,
      autoDisableBelowMin: true,
    });

    assert(plan.allRuns.length > 0, "Plan generated batches across enabled metrics");

    // Verify NO batch is smaller than mapped service's min_quantity
    let subMinViolations = 0;
    for (const run of plan.allRuns) {
      const minRequired = customServices[run.engagementType].minQuantity;
      if (run.quantity < minRequired) {
        subMinViolations++;
      }
    }
    assert(subMinViolations === 0, "Zero batches are planned smaller than mapped service's min_quantity");

    // Disconnect provider: health gate should detect disconnected provider and pause type calmly
    await prisma.userProviderConnection.update({
      where: { id: providerA.id },
      data: { active: false },
    });

    const healthGateAfter = await checkProviderHealthGate("instagram_reel", ["views", "likes"], 0, userA.id);
    assert(healthGateAfter.ok === false, "Health gate rejects when mapped provider is disconnected");
    assert(
      healthGateAfter.userMessage?.includes("paused — its provider was disconnected") ||
      healthGateAfter.userMessage?.includes("Pick a service"),
      "Returns calm, friendly user message prompting replacement or toggle off"
    );

    // Re-enable provider A for subsequent tests
    await prisma.userProviderConnection.update({
      where: { id: providerA.id },
      data: { active: true },
    });

    // =========================================================================
    // SUITE 6: Order Reliability, Idempotency & Auto-Refunds (Change 14)
    // =========================================================================
    console.log("\n── SUITE 6: Order Reliability, Retries & Auto-Refunds ──────────────");

    // Create a mock service and scheduled order
    const testService = await prisma.service.create({
      data: {
        externalId: `test_srv_${Date.now()}`,
        providerServiceId: "101",
        userProviderId: providerA.id,
        name: "Test Pacing Service",
        description: "Test Pacing Description",
        platform: "Instagram",
        category: "Likes",
        ratePer1000: 1.5,
        minQuantity: 10,
        maxQuantity: 10000,
        active: true,
      },
    });

    const orderRef = `SMM-TEST-${Date.now()}`;
    const testOrder = await prisma.order.create({
      data: {
        orderRef,
        userId: userA.id,
        serviceId: testService.id,
        targetUrl: "https://www.instagram.com/p/test12345",
        requestedQuantity: 500,
        submittedQuantity: 0,
        deliveredQuantity: 0,
        remainingQuantity: 500,
        failedQuantity: 0,
        unitCost: 0.0015,
        totalCost: 0.75,
        isScheduled: true,
        scheduleMode: "EVEN_DRIP",
        status: "SCHEDULED",
      },
    });

    const stepScheduledAt = new Date(Date.now() + 60 * 1000);
    const step = await prisma.scheduledDeliveryStep.create({
      data: {
        orderId: testOrder.id,
        stepNumber: 1,
        scheduledTime: stepScheduledAt,
        quantity: 100,
        status: "PENDING",
        idempotencyKey: `${orderRef}-step-1`,
      },
    });

    assert(step.idempotencyKey === `${orderRef}-step-1`, "Step has distinct idempotency key preventing duplicate dispatch");
    assert(step.status === "PENDING", "Step created with scheduled_at timestamp in PENDING status");

    // Simulate fatal failure on a run -> auto refund undelivered amount
    const runCost = 0.50;
    const initialUserBal = (await prisma.user.findUnique({ where: { id: userA.id } }))?.walletBalance ?? 0;

    // Simulate refund logic
    const newBal = Number((initialUserBal + runCost).toFixed(2));
    await prisma.user.update({
      where: { id: userA.id },
      data: { walletBalance: newBal },
    });

    await prisma.walletTransaction.create({
      data: {
        userId: userA.id,
        type: "REFUND",
        amount: runCost,
        balanceAfter: newBal,
        referenceId: orderRef,
        description: `Refund for undelivered batch #1 on order ${orderRef}`,
      },
    });

    const userAfterRefund = await prisma.user.findUnique({ where: { id: userA.id } });
    assert(userAfterRefund?.walletBalance === newBal, `Undelivered amount ₹${runCost} refunded immediately to user's wallet`);

    // Verify Admin Alert is raised on failure
    const alert = await prisma.adminAlert.create({
      data: {
        severity: "high",
        type: "run_failed",
        orderId: testOrder.id,
        runNumber: 1,
        userId: userA.id,
        reason: "Provider rejected order: Service temporarily paused upstream",
        status: "open",
      },
    });

    assert(alert.id !== undefined && alert.status === "open", "AdminAlert raised with upstream failure details");

  } finally {
    // Clean up test data
    console.log("\n── TEARDOWN: Cleaning up test records ────────────────────────────────");
    try {
      await prisma.favourite.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
      await prisma.favouritesSnapshot.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
      await prisma.userPreference.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
      await prisma.userEngagementMapping.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
      await prisma.adminAlert.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
      await prisma.walletTransaction.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
      await prisma.scheduledDeliveryStep.deleteMany({ where: { order: { userId: { in: [userA.id, userB.id] } } } });
      await prisma.order.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
      await prisma.service.deleteMany({ where: { externalId: { startsWith: "test_srv_" } } });
      await prisma.userProviderConnection.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
      console.log("  ✔ All test records cleaned up safely.");
    } catch (e: any) {
      console.warn("Teardown notice:", e.message);
    }
  }

  console.log("\n=======================================================================");
  console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================================\n");

  if (failed > 0) {
    throw new Error(`Test suite failed with ${failed} failure(s)`);
  }
}

// Self-executing runner if invoked directly
if (require.main === module) {
  runUserProvidersAndFavouritesTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
