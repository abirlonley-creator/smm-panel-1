import { PrismaClient } from "@prisma/client";
import { MockSMMProvider } from "../src/lib/provider/adapter";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding AuraSMM Minimalist Panel database with exact SMM v2 catalog...");

  // 1. Ensure Provider Config exists
  let providerConfig = await prisma.providerConfig.findFirst();
  if (!providerConfig) {
    providerConfig = await prisma.providerConfig.create({
      data: {
        name: "Standard SMM Adapter",
        apiUrl: "https://api.smmprovider.com/v2",
        apiKey: null,
        isMock: true,
        active: true,
        balance: null,
        lastSyncAt: null,
      },
    });
    console.log("Created initial ProviderConfig (Mock mode active)");
  }

  // 2. Populate Services from Mock Provider
  const mockAdapter = new MockSMMProvider();
  const services = await mockAdapter.getServices();

  for (const s of services) {
    const existing = await prisma.service.findFirst({
      where: { externalId: s.id },
    });

    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: {
          name: s.name,
          type: s.type || "Default",
          platform: s.platform,
          category: s.category,
          description: s.description,
          minQuantity: s.minQuantity,
          maxQuantity: s.maxQuantity,
          ratePer1000: s.ratePer1000,
          refillSupported: s.refillSupported,
          cancelSupported: s.cancelSupported,
          dripFeedSupported: s.dripFeedSupported,
          dripFeedMinInterval: s.dripFeedMinInterval,
          dripFeedMaxInterval: s.dripFeedMaxInterval,
          restrictions: s.restrictions,
          isMock: true,
        },
      });
      console.log(`Updated service #${s.id}: ${s.name}`);
    } else {
      await prisma.service.create({
        data: {
          externalId: s.id,
          name: s.name,
          type: s.type || "Default",
          platform: s.platform,
          category: s.category,
          description: s.description,
          minQuantity: s.minQuantity,
          maxQuantity: s.maxQuantity,
          ratePer1000: s.ratePer1000,
          refillSupported: s.refillSupported,
          cancelSupported: s.cancelSupported,
          dripFeedSupported: s.dripFeedSupported,
          dripFeedMinInterval: s.dripFeedMinInterval,
          dripFeedMaxInterval: s.dripFeedMaxInterval,
          restrictions: s.restrictions,
          isMock: true,
          active: true,
        },
      });
      console.log(`Created service #${s.id}: ${s.name}`);
    }
  }

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
