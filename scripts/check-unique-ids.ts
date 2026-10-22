import { StandardSMMv2Provider } from "../src/lib/provider/adapter";

async function main() {
  const prov = new StandardSMMv2Provider(
    "https://xmediasmm.in/api/v2",
    "0fcb714fb4297125c51c7fe2cb65293f"
  );
  const services = await prov.getServices();
  const idSet = new Set<string>();
  const duplicates: string[] = [];

  for (const s of services) {
    if (idSet.has(s.id)) {
      duplicates.push(s.id);
    }
    idSet.add(s.id);
  }

  console.log(`Total services: ${services.length}, Unique IDs: ${idSet.size}`);
  console.log(`Duplicate IDs count: ${duplicates.length}`);
}

main().catch(console.error);
