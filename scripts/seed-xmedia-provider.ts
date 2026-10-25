import { prisma } from "../src/lib/prisma";
import { encryptApiKey } from "../src/lib/security/crypto";

/**
 * Seeds the default primary provider "xmedia" from environment variables.
 * Never hard-codes API keys; reads from process.env.XMEDIA_API_KEY.
 */
export async function seedXmediaProvider() {
  const name = "xmedia";
  const apiUrl = "https://xmediasmm.in/api/v2";
  const rawKey = process.env.XMEDIA_API_KEY?.trim() || "";
  const isMock = !rawKey;

  console.log(`[SEED] Seeding provider "${name}" (API URL: ${apiUrl}, isMock: ${isMock})...`);

  let provider = await prisma.provider.findFirst({
    where: {
      OR: [
        { name: "xmedia" },
        { name: "XMedia SMM" },
        { apiUrl: "https://xmediasmm.in/api/v2" },
      ],
    },
  });

  const encryptedKey = rawKey ? encryptApiKey(rawKey) : provider?.apiKeyEncrypted || null;

  if (provider) {
    provider = await prisma.provider.update({
      where: { id: provider.id },
      data: {
        name,
        apiUrl,
        apiKeyEncrypted: encryptedKey,
        isMock,
        active: true,
        currency: "INR",
      },
    });
    console.log(`[SEED] Updated existing provider "${provider.name}" (${provider.id})`);
  } else {
    provider = await prisma.provider.create({
      data: {
        name,
        apiUrl,
        apiKeyEncrypted: encryptedKey,
        isMock,
        active: true,
        currency: "INR",
        balance: 1000.0,
      },
    });
    console.log(`[SEED] Created new provider "${provider.name}" (${provider.id})`);
  }

  return provider;
}

if (require.main === module) {
  seedXmediaProvider()
    .then((p) => {
      console.log(`✔ Provider ${p.name} ready with ID: ${p.id}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Failed to seed provider:", err);
      process.exit(1);
    });
}
