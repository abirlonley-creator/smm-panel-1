import { prisma } from "../src/lib/prisma";
import { StandardSMMv2Provider } from "../src/lib/provider/adapter";

async function main() {
  console.log("Starting service sync test...");
  const start = Date.now();

  const prov = new StandardSMMv2Provider(
    "https://xmediasmm.in/api/v2",
    "0fcb714fb4297125c51c7fe2cb65293f"
  );

  const services = await prov.getServices();
  console.log(`Fetched ${services.length} services from provider in ${Date.now() - start}ms`);

  // Also update system-level ProviderConfig with the real provider details
  await prisma.providerConfig.upsert({
    where: { id: (await prisma.providerConfig.findFirst())?.id || "default" },
    create: {
      name: "XMedia SMM",
      apiUrl: "https://xmediasmm.in/api/v2",
      apiKey: "0fcb714fb4297125c51c7fe2cb65293f",
      isMock: false,
      active: true,
      lastSyncAt: new Date(),
    },
    update: {
      name: "XMedia SMM",
      apiUrl: "https://xmediasmm.in/api/v2",
      apiKey: "0fcb714fb4297125c51c7fe2cb65293f",
      isMock: false,
      active: true,
      lastSyncAt: new Date(),
    },
  });

  // Check existing services in DB
  const existing = await prisma.service.findMany({
    select: { id: true, externalId: true },
  });
  const existingMap = new Map(existing.map((s) => [s.externalId, s.id]));

  const toCreate: any[] = [];
  const toUpdate: any[] = [];

  for (const s of services) {
    const existingId = existingMap.get(s.id);
    const data = {
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
      restrictions: s.restrictions,
      isMock: false,
      active: true,
    };

    if (existingId) {
      toUpdate.push({ id: existingId, ...data });
    } else {
      toCreate.push(data);
    }
  }

  console.log(`To create: ${toCreate.length}, To update: ${toUpdate.length}`);

  // Bulk insert new services in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
    const chunk = toCreate.slice(i, i + CHUNK_SIZE);
    await prisma.service.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    console.log(`Inserted chunk ${i / CHUNK_SIZE + 1} (${chunk.length} items)`);
  }

  // Update existing in small batches if any
  for (const item of toUpdate) {
    const { id, ...data } = item;
    await prisma.service.update({
      where: { id },
      data,
    });
  }

  // Clean up mock services if they have no orders
  const deletedMocks = await prisma.service.deleteMany({
    where: {
      isMock: true,
      orders: { none: {} },
    },
  });
  console.log(`Deleted mock services: ${deletedMocks.count}`);

  const total = await prisma.service.count();
  console.log(`Sync completed! Total services in database now: ${total}. Time taken: ${Date.now() - start}ms`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
