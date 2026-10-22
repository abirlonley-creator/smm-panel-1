import { prisma } from "../src/lib/prisma";
import { StandardSMMv2Provider } from "../src/lib/provider/adapter";

async function main() {
  const count = await prisma.service.count();
  console.log("TOTAL SERVICES IN DB:", count);
  const users = await prisma.user.findMany({
    include: { providerConfig: true },
  });
  console.log("Users in DB:", users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    provider: u.providerConfig ? {
      name: u.providerConfig.name,
      apiUrl: u.providerConfig.apiUrl,
      hasKey: Boolean(u.providerConfig.apiKey),
      isMock: u.providerConfig.isMock,
      balance: u.providerConfig.balance,
      currency: u.providerConfig.currency,
    } : null
  })));

  // Test provider directly with xmediasmm.in
  const activeUser = users.find(u => u.providerConfig?.apiKey);
  if (activeUser && activeUser.providerConfig?.apiKey) {
    console.log(`Found user with provider key: ${activeUser.username}`);
    const prov = new StandardSMMv2Provider(
      activeUser.providerConfig.apiUrl,
      activeUser.providerConfig.apiKey
    );
    try {
      console.log("Fetching services from provider directly...");
      const services = await prov.getServices();
      console.log(`Successfully fetched ${services.length} services from provider!`);
      if (services.length > 0) {
        console.log("First 3 services:", services.slice(0, 3));
      }
    } catch (e: any) {
      console.error("Provider fetch error:", e.message);
    }
  } else {
    console.log("No user has an active apiKey");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
