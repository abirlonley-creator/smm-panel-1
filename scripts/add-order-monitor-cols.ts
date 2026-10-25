import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== Applying DB Schema for Changes H, I, J ===");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "runs" 
      ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "timeToStartMs" INTEGER,
      ADD COLUMN IF NOT EXISTS "timeToConfirmMs" INTEGER,
      ADD COLUMN IF NOT EXISTS "errorType" TEXT,
      ADD COLUMN IF NOT EXISTS "httpStatus" INTEGER,
      ADD COLUMN IF NOT EXISTS "rawResponse" TEXT;
  `);
  console.log("✓ runs (EngagementRun) timing & error columns ensured.");

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "alerts" 
      ADD COLUMN IF NOT EXISTS "serviceId" TEXT,
      ADD COLUMN IF NOT EXISTS "errorType" TEXT,
      ADD COLUMN IF NOT EXISTS "dedupKey" TEXT,
      ADD COLUMN IF NOT EXISTS "dedupCount" INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "suggestedAction" TEXT,
      ADD COLUMN IF NOT EXISTS "resolvedBy" TEXT;
  `);
  console.log("✓ alerts (AdminAlert) deduplication & details columns ensured.");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "order_event_logs" (
      "id" TEXT PRIMARY KEY,
      "engagementOrderId" TEXT NOT NULL,
      "runId" TEXT,
      "eventType" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "requestSummary" TEXT,
      "responseCode" INTEGER,
      "rawResponse" TEXT,
      "durationMs" INTEGER,
      "metadata" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "order_event_logs_engagementOrderId_fkey" FOREIGN KEY ("engagementOrderId") REFERENCES "EngagementOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  console.log("✓ order_event_logs table ensured.");

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "order_event_logs_engagementOrderId_createdAt_idx" ON "order_event_logs"("engagementOrderId", "createdAt");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "order_event_logs_eventType_idx" ON "order_event_logs"("eventType");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "alerts_dedupKey_idx" ON "alerts"("dedupKey");
  `);
  console.log("✓ all indexes ensured.");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
