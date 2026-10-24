import { prisma } from "../src/lib/prisma";
import { encryptApiKey } from "../src/lib/security/crypto";

export async function backfillProviders() {
  console.log("=== Fast Atomic Backfill of Providers and Composite Keys ===");

  // 1. Fetch or create the Primary System Provider
  const existingConfig = await prisma.providerConfig.findFirst();

  let primaryProvider = await prisma.provider.findFirst({
    where: { active: true },
  });

  if (!primaryProvider) {
    primaryProvider = await prisma.provider.create({
      data: {
        name: existingConfig?.name || "Primary SMM Provider",
        apiUrl: existingConfig?.apiUrl || "https://api.smmprovider.com/v2",
        apiKeyEncrypted: existingConfig?.apiKey ? encryptApiKey(existingConfig.apiKey) : null,
        isMock: existingConfig?.isMock ?? false,
        active: true,
        currency: existingConfig?.currency || "USD",
        balance: existingConfig?.balance || 100.0,
      },
    });
    console.log(`[BACKFILL] Created primary provider: ${primaryProvider.name} (${primaryProvider.id})`);
  } else {
    console.log(`[BACKFILL] Found existing primary provider: ${primaryProvider.name} (${primaryProvider.id})`);
  }

  // 2. Instant SQL updates for Service
  const updatedServices = await prisma.$executeRawUnsafe(`
    UPDATE "Service"
    SET "providerId" = COALESCE("providerId", '${primaryProvider.id}'),
        "providerServiceId" = COALESCE("providerServiceId", "externalId")
    WHERE "providerId" IS NULL OR "providerServiceId" IS NULL;
  `);
  console.log(`[BACKFILL] Atomically updated ${updatedServices} services with providerId and providerServiceId`);

  // 3. Instant SQL update for Order
  const updatedOrders = await prisma.$executeRawUnsafe(`
    UPDATE "Order"
    SET "providerId" = '${primaryProvider.id}'
    WHERE "providerId" IS NULL;
  `);
  console.log(`[BACKFILL] Atomically updated ${updatedOrders} orders with providerId`);

  // 4. Ensure all users have positive walletBalance
  const updatedUsers = await prisma.$executeRawUnsafe(`
    UPDATE "User"
    SET "walletBalance" = 1000.0
    WHERE "walletBalance" IS NULL OR "walletBalance" <= 0;
  `);
  console.log(`[BACKFILL] Initialized walletBalance (1000 INR) for ${updatedUsers} users`);

  console.log("=== Fast Backfill Complete ===");
  return {
    providerId: primaryProvider.id,
    updatedServices,
    updatedOrders,
  };
}

if (require.main === module) {
  backfillProviders()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error("[BACKFILL ERROR]:", err);
      prisma.$disconnect();
      process.exit(1);
    });
}
