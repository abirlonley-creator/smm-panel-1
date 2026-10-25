import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== Applying DB Columns for Changes A-F ===");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "EngagementOrder" 
      ADD COLUMN IF NOT EXISTS "planParams" TEXT,
      ADD COLUMN IF NOT EXISTS "expectedCurve" TEXT,
      ADD COLUMN IF NOT EXISTS "statusSamples" TEXT,
      ADD COLUMN IF NOT EXISTS "deviationStatus" TEXT DEFAULT 'on_track',
      ADD COLUMN IF NOT EXISTS "typeStatuses" TEXT,
      ADD COLUMN IF NOT EXISTS "replanCount" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "lastReplanReason" TEXT,
      ADD COLUMN IF NOT EXISTS "behindSince" TIMESTAMP(3);
  `);
  console.log("✓ EngagementOrder columns ensured.");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "runs" 
      ADD COLUMN IF NOT EXISTS "plannedCumulative" INTEGER,
      ADD COLUMN IF NOT EXISTS "deliveredQuantity" INTEGER,
      ADD COLUMN IF NOT EXISTS "deliveredCumulative" INTEGER,
      ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "isReplan" BOOLEAN DEFAULT false;
  `);
  console.log("✓ runs (EngagementRun) columns ensured.");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "alerts" 
      ADD COLUMN IF NOT EXISTS "planned" INTEGER,
      ADD COLUMN IF NOT EXISTS "delivered" INTEGER,
      ADD COLUMN IF NOT EXISTS "deviationPercent" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "actionTaken" TEXT;
  `);
  console.log("✓ alerts (AdminAlert) columns ensured.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
