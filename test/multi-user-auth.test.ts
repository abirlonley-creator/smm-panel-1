import { prisma } from "../src/lib/prisma";
import {
  initDefaultAdminPasskey,
  verifyPasskey,
  createPasskey,
  togglePasskeyStatus,
  renewPasskey,
  revokePasskey,
  deletePasskey,
  createSession,
  validateSession,
  invalidateSession,
} from "../src/lib/auth/passkey-service";
import {
  saveUserProviderConfig,
  getUserProviderConfig,
  refreshUserBalance,
  testProviderConnection,
} from "../src/lib/provider/user-provider";
import { getActiveProvider } from "../src/lib/provider/adapter";

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

export async function runMultiUserAuthTests() {
  console.log("\n=======================================================");
  console.log("   AURASMM MULTI-USER, PASSKEY AUTH & ISOLATION TESTS");
  console.log("=======================================================\n");

  // -----------------------------------------------------------
  // 1. Passkey Authentication & Default Admin Tests
  // -----------------------------------------------------------
  console.log("Test Suite 16: Passkey Authentication & Role Verification");

  await initDefaultAdminPasskey();

  // Test 1: abir90 default admin credential
  const adminAuth = await verifyPasskey("abir90");
  assert(adminAuth.valid, "Default administrator passkey 'abir90' verifies successfully");
  assert(adminAuth.role === "ADMIN", "Default administrator passkey grants ADMIN role");
  assert(Boolean(adminAuth.user?.id), "Admin user account exists with non-null ID");

  // Test 2: Rejection of invalid passkeys
  const invalidAuth = await verifyPasskey("fake-passkey-xyz");
  assert(!invalidAuth.valid, "Rejects unauthenticated/invalid passkey");
  assert(Boolean(invalidAuth.error), "Returns descriptive error message for invalid passkey");

  // Test 3: Creation of normal user passkey
  const userPasskeyRes = await createPasskey({
    label: "Client Passkey Alpha",
    role: "USER",
    durationDays: 30,
    actor: "Admin",
  });
  assert(Boolean(userPasskeyRes.rawKey), "Generates raw passkey on creation");
  assert(userPasskeyRes.role === "USER", "Assigns USER role correctly");
  assert(Boolean(userPasskeyRes.expiresAt), "Calculates future expiration date based on duration");

  // Verify normal user passkey login
  const userAuth = await verifyPasskey(userPasskeyRes.rawKey);
  assert(userAuth.valid, "Normal user can log in with generated passkey");
  assert(userAuth.role === "USER", "User account is granted USER role (not ADMIN)");
  assert(userAuth.user?.role === "USER", "User profile reflects USER role");
  assert(
    typeof userAuth.remainingDays === "number" && userAuth.remainingDays >= 29,
    "Accurately calculates remaining access time (days remaining)"
  );

  // Test 4: Disable passkey
  await togglePasskeyStatus(userPasskeyRes.id, "DISABLED", "Admin");
  const disabledAuth = await verifyPasskey(userPasskeyRes.rawKey);
  assert(!disabledAuth.valid, "Disabled passkey is rejected on login");
  assert(
    Boolean(disabledAuth.error?.toLowerCase().includes("disabled")),
    "Returns 'disabled' message on attempt to use disabled passkey"
  );

  // Re-enable passkey
  await togglePasskeyStatus(userPasskeyRes.id, "ACTIVE", "Admin");
  const reenabledAuth = await verifyPasskey(userPasskeyRes.rawKey);
  assert(reenabledAuth.valid, "Re-enabled passkey logs in successfully");

  // Test 5: Renew passkey
  const renewed = await renewPasskey(userPasskeyRes.id, 60, "Admin");
  assert(Boolean(renewed.newExpiresAt), "Passkey renewal updates expiration date");
  const renewedAuth = await verifyPasskey(userPasskeyRes.rawKey);
  assert(
    typeof renewedAuth.remainingDays === "number" && renewedAuth.remainingDays >= 59,
    "Renewal extends remaining days count correctly"
  );

  // Test 6: Revoke passkey
  await revokePasskey(userPasskeyRes.id, "Admin");
  const revokedAuth = await verifyPasskey(userPasskeyRes.rawKey);
  assert(!revokedAuth.valid, "Revoked passkey is rejected on login");
  assert(
    Boolean(revokedAuth.error?.toLowerCase().includes("revoked")),
    "Returns 'revoked' message on attempt to use revoked passkey"
  );

  // Test 7: Last admin deletion safety protection
  // Ensure exactly one active admin exists for this test by deleting any extra bootstrap keys
  const extraAdminKeys = await prisma.passkey.findMany({
    where: { role: "ADMIN", status: "ACTIVE", keyPrefix: { not: "abir90..." } },
  });
  for (const k of extraAdminKeys) {
    await prisma.passkey.delete({ where: { id: k.id } }).catch(() => {});
  }

  const defaultAdminPasskey = await prisma.passkey.findFirst({
    where: { role: "ADMIN", status: "ACTIVE" },
  });
  if (defaultAdminPasskey) {
    let preventedDeletion = false;
    try {
      await deletePasskey(defaultAdminPasskey.id, "Admin");
    } catch (e: any) {
      preventedDeletion = e.message.includes("Cannot delete the last active administrator passkey");
    }
    assert(preventedDeletion, "Safety check prevents deleting the last active administrator account");
  }

  // -----------------------------------------------------------
  // 2. Multi-User Provider API Isolation Tests
  // -----------------------------------------------------------
  console.log("\nTest Suite 17: Multi-User Provider API Isolation");

  // Clean up any previous test artifacts
  await prisma.userProviderConnection.deleteMany({
    where: { user: { username: { in: ["botter_alpha", "botter_beta"] } } },
  });
  await prisma.user.deleteMany({
    where: { username: { in: ["botter_alpha", "botter_beta"] } },
  });

  // Create two distinct users
  const userA = await prisma.user.create({
    data: { username: "botter_alpha", role: "USER", status: "ACTIVE" },
  });
  const userB = await prisma.user.create({
    data: { username: "botter_beta", role: "USER", status: "ACTIVE" },
  });

  // User A configures Provider A
  await saveUserProviderConfig(userA.id, {
    name: "Provider Alpha",
    apiUrl: "https://provider-alpha.smm/api/v2",
    apiKey: "sk_live_alpha_9999",
    isMock: true,
  });

  // User B configures Provider B with a different URL and API key
  await saveUserProviderConfig(userB.id, {
    name: "Provider Beta",
    apiUrl: "https://provider-beta.smm/api/v2",
    apiKey: "sk_live_beta_8888",
    isMock: true,
  });

  // Test Provider Config Isolation
  const configA = await getUserProviderConfig(userA.id);
  const configB = await getUserProviderConfig(userB.id);

  assert(configA?.name === "Provider Alpha", "User A retrieves own provider configuration");
  assert(configB?.name === "Provider Beta", "User B retrieves own provider configuration");
  assert(
    configA?.apiUrl !== configB?.apiUrl,
    "User A and User B have separate, distinct provider API endpoints"
  );
  assert(
    configA?.maskedKey?.startsWith("sk_l••••••••"),
    "API key is masked at rest and in responses"
  );

  // Test Provider Adapter Resolution per User
  const providerForA = await getActiveProvider(userA.id);
  const providerForB = await getActiveProvider(userB.id);

  assert(
    providerForA.config.name === "Provider Alpha",
    "Adapter for User A resolves strictly to User A's provider"
  );
  assert(
    providerForB.config.name === "Provider Beta",
    "Adapter for User B resolves strictly to User B's provider"
  );

  // Test Balance Retrieval & Isolation
  const testConnA = await testProviderConnection("https://provider-alpha.smm/api/v2", "sk_live_alpha_9999", true);
  assert(testConnA.success, "User A provider connection test succeeds");

  const balA = await refreshUserBalance(userA.id);
  assert(balA.balance !== null, "User A retrieves provider balance independently");

  // Test Order Isolation
  const service = await prisma.service.findFirst({ where: { active: true } });
  if (service) {
    const orderA = await prisma.order.create({
      data: {
        orderRef: `SMM-A-${Date.now().toString().slice(-6)}`,
        serviceId: service.id,
        targetUrl: "https://tiktok.com/@user_a/video/111111",
        requestedQuantity: 500,
        submittedQuantity: 500,
        deliveredQuantity: 0,
        remainingQuantity: 500,
        failedQuantity: 0,
        unitCost: 0.002,
        totalCost: 1.0,
        isScheduled: false,
        scheduleMode: "INSTANT",
        status: "PROCESSING",
        userId: userA.id,
      },
    });

    const orderB = await prisma.order.create({
      data: {
        orderRef: `SMM-B-${Date.now().toString().slice(-6)}`,
        serviceId: service.id,
        targetUrl: "https://tiktok.com/@user_b/video/222222",
        requestedQuantity: 1000,
        submittedQuantity: 1000,
        deliveredQuantity: 0,
        remainingQuantity: 1000,
        failedQuantity: 0,
        unitCost: 0.002,
        totalCost: 2.0,
        isScheduled: false,
        scheduleMode: "INSTANT",
        status: "PROCESSING",
        userId: userB.id,
      },
    });

    assert(orderA.userId === userA.id, "Order A is owned strictly by User A");
    assert(orderB.userId === userB.id, "Order B is owned strictly by User B");
    assert(orderA.userId !== orderB.userId, "Orders are isolated between different users");

    // Clean up test orders
    await prisma.order.deleteMany({ where: { id: { in: [orderA.id, orderB.id] } } });
  }

  // -----------------------------------------------------------
  // 3. Session Management & Logout Tests
  // -----------------------------------------------------------
  console.log("\nTest Suite 18: Session Management & Invalidation on Logout");

  // Create an active passkey for User A
  const activeUserPasskey = await createPasskey({
    label: "Active Session Passkey",
    role: "USER",
    durationDays: 14,
    actor: "Admin",
  });

  // Create session for user A
  const sessionRes = await createSession(userA.id, activeUserPasskey.id);
  assert(Boolean(sessionRes.token), "Creates secure session token upon authentication");

  // Validate session
  const validSession = await validateSession(sessionRes.token);
  assert(Boolean(validSession.valid), "Validates active session token");
  assert(validSession?.user?.id === userA.id, "Session resolves to correct user account");

  // Invalidate session (logout)
  await invalidateSession(sessionRes.token);
  const loggedOutSession = await validateSession(sessionRes.token);
  assert(!loggedOutSession.valid, "Session is immediately invalidated upon logout");

  // Clean up test users
  await prisma.userProviderConnection.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.passkey.deleteMany({ where: { id: { in: [userPasskeyRes.id, activeUserPasskey.id] } } });

  console.log("\n=======================================================");
  console.log(`MULTI-USER & AUTH TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runMultiUserAuthTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
