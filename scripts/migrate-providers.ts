import { prisma } from "../src/lib/prisma";
import { encryptApiKey } from "../src/lib/security/crypto";

async function main() {
  console.log("Starting migration of legacy provider configurations into UserProviderConnection...");

  // 1. Check all UserProviderConfig records
  const legacyConfigs = await prisma.userProviderConfig.findMany();
  console.log(`Found ${legacyConfigs.length} legacy UserProviderConfig records.`);

  let migratedCount = 0;
  for (const cfg of legacyConfigs) {
    // Only migrate if user has a non-default setup or a live API key
    const isLive = !cfg.isMock || Boolean(cfg.apiKey) || (cfg.balance !== null && cfg.balance > 0);

    // Check if user already has a connection with this name or apiUrl
    const existing = await prisma.userProviderConnection.findFirst({
      where: {
        userId: cfg.userId,
        OR: [
          { name: cfg.name },
          { apiUrl: cfg.apiUrl },
        ],
      },
    });

    if (!existing) {
      const encryptedKey = cfg.apiKey ? encryptApiKey(cfg.apiKey) : null;
      await prisma.userProviderConnection.create({
        data: {
          userId: cfg.userId,
          name: cfg.name || "Default SMM Provider",
          apiUrl: cfg.apiUrl,
          apiKeyEncrypted: encryptedKey,
          isMock: cfg.isMock,
          active: cfg.active,
          balance: cfg.balance,
          currency: cfg.currency || "USD",
          lastSyncAt: cfg.lastSyncAt,
          lastError: cfg.lastError,
        },
      });
      migratedCount++;
      console.log(`Migrated provider "${cfg.name}" for user ${cfg.userId}`);
    } else {
      console.log(`User ${cfg.userId} already has connection "${existing.name}", skipping duplicate.`);
    }
  }

  console.log(`Successfully migrated ${migratedCount} provider connections.`);
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
