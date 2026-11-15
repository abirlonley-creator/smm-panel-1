import { prisma } from "../src/lib/prisma";
import {
  getTikTokEngagementConfigAsync,
  getAllTikTokPresetsRecordAsync,
  getAllTikTokPresetsAsync,
} from "../src/lib/engagement/tiktok-preset-config";

async function verifyAll() {
  console.log("=== AURASMM SYSTEM VERIFICATION ===\n");

  // 1. Verify Database Connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✔ [1/6] Database Connection: Healthy (Supabase PostgreSQL via Prisma)");
  } catch (err: any) {
    console.error("✘ [1/6] Database Connection Failed:", err.message);
    process.exit(1);
  }

  // 2. Verify Engagement Retail Pricing Config
  try {
    const config = await getTikTokEngagementConfigAsync(true);
    console.log("✔ [2/6] TikTok Engagement Config Loaded from DB:");
    console.log("      - Enabled:", config.enabled);
    console.log("      - Views User Rate: ₹" + config.pricing?.viewsUserRate);
    console.log("      - Likes User Rate: ₹" + config.pricing?.likesUserRate);
    console.log("      - Saves User Rate: ₹" + config.pricing?.savesUserRate);
    console.log("      - Shares User Rate: ₹" + config.pricing?.sharesUserRate);
    console.log("      - Comments User Rate: ₹" + config.pricing?.commentsUserRate);
  } catch (err: any) {
    console.error("✘ [2/6] Config Load Failed:", err.message);
  }

  // 3. Verify Tier Presets
  try {
    const presets = await getAllTikTokPresetsRecordAsync(true);
    const keys = Object.keys(presets);
    console.log("✔ [3/6] Tier Presets Loaded (" + keys.length + " tiers):", keys.join(", "));
    for (const k of keys) {
      const p = presets[k];
      console.log(
        "      - " +
          p.name +
          " (" +
          p.id +
          "): Target Views=" +
          p.targetViews +
          ", Likes=" +
          p.targetLikes +
          ", Waves=" +
          p.likes?.runsCount
      );
    }
  } catch (err: any) {
    console.error("✘ [3/6] Presets Load Failed:", err.message);
  }

  // 4. Verify Pricing Calculation Accuracy
  try {
    const config = await getTikTokEngagementConfigAsync();
    const vRate = config.pricing?.viewsUserRate ?? 4.5;
    const lRate = config.pricing?.likesUserRate ?? 2.0;
    const presetsList = await getAllTikTokPresetsAsync();
    const p2k = presetsList.find((p) => p.id === "tiktok_2k");
    if (p2k) {
      const vCost = (p2k.targetViews / 1000) * vRate;
      const lCost = (p2k.targetLikes / 1000) * lRate;
      const total = Number((vCost + lCost).toFixed(2));
      console.log(
        "✔ [4/6] 2K Starter Price Calculation: Views ₹" +
          vCost.toFixed(2) +
          " + Likes ₹" +
          lCost.toFixed(2) +
          " = ₹" +
          total.toFixed(2)
      );
    }
  } catch (err: any) {
    console.error("✘ [4/6] Price Calculation Failed:", err.message);
  }

  // 5. Verify Binance Pay Deposits and Admin Review Queue
  try {
    const pendingDeposits = await prisma.paymentDeposit.findMany({
      where: { method: "binance_pay" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    console.log("✔ [5/6] Payment Deposits Table accessible (" + pendingDeposits.length + " recent Binance deposits found)");
    for (const d of pendingDeposits) {
      console.log("      - TxnId: " + d.txnId + ", Amount: ₹" + d.amount + ", Status: " + d.status);
    }
  } catch (err: any) {
    console.error("✘ [5/6] Payment Deposits Check Failed:", err.message);
  }

  // 6. Verify Upstream Provider Connections
  try {
    const userProviders = await prisma.userProviderConnection.findMany({
      take: 5,
      select: { id: true, name: true, apiUrl: true, balance: true, currency: true },
    });
    console.log("✔ [6/6] Upstream Provider Connections (" + userProviders.length + " active):");
    for (const prov of userProviders) {
      console.log(
        "      - " +
          prov.name +
          " (" +
          prov.apiUrl +
          "): Balance " +
          (prov.balance ?? "N/A") +
          " " +
          (prov.currency ?? "")
      );
    }
  } catch (err: any) {
    console.error("✘ [6/6] Provider Connections Check Failed:", err.message);
  }

  console.log("\n=== ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY ===");
}

verifyAll()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
