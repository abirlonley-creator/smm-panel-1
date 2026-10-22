import { StandardSMMv2Provider } from "../src/lib/provider/adapter";

async function main() {
  const prov = new StandardSMMv2Provider(
    "https://xmediasmm.in/api/v2",
    "0fcb714fb4297125c51c7fe2cb65293f"
  );
  const services = await prov.getServices();
  console.log("Total services returned:", services.length);

  // Check platforms distribution
  const platformCounts: Record<string, number> = {};
  const categories = new Set<string>();
  let nullOrEmptyNames = 0;
  let invalidRates = 0;

  for (const s of services) {
    platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
    categories.add(s.category);
    if (!s.name) nullOrEmptyNames++;
    if (isNaN(s.ratePer1000) || s.ratePer1000 <= 0) invalidRates++;
  }

  console.log("Platform counts:", platformCounts);
  console.log("Unique categories:", categories.size);
  console.log("Empty names:", nullOrEmptyNames, "Invalid rates:", invalidRates);
}

main().catch(console.error);
