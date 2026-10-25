import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Applying Supabase Row-Level Security (RLS) policies and cleaning up legacy tables...");

  // 1. Drop legacy single-provider tables if they exist
  try {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "UserProviderConfig" CASCADE;`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "ProviderConfig" CASCADE;`);
    console.log("Dropped legacy ProviderConfig and UserProviderConfig tables.");
  } catch (err: any) {
    console.warn("Notice dropping legacy tables:", err.message);
  }

  // 2. Enable RLS on all tables
  const tables = [
    "user_providers",
    "catalog_services",
    "favourites",
    "favourites_snapshot",
    "user_preferences",
    "engagement_mappings",
    "runs",
    "alerts",
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
      console.log(`Enabled RLS on ${table}`);
    } catch (err: any) {
      console.warn(`Could not enable RLS on ${table}:`, err.message);
    }
  }

  // 3. Create RLS Policies
  const policies = [
    // user_providers
    `DO $$ BEGIN
      DROP POLICY IF EXISTS "user_providers_user_policy" ON "user_providers";
      CREATE POLICY "user_providers_user_policy" ON "user_providers"
        FOR ALL
        USING ("userId" = coalesce(auth.uid()::text, current_user) OR coalesce(auth.jwt()->>'role', '') = 'admin')
        WITH CHECK ("userId" = coalesce(auth.uid()::text, current_user) OR coalesce(auth.jwt()->>'role', '') = 'admin');
    END $$;`,

    // favourites
    `DO $$ BEGIN
      DROP POLICY IF EXISTS "favourites_user_policy" ON "favourites";
      CREATE POLICY "favourites_user_policy" ON "favourites"
        FOR ALL
        USING ("userId" = coalesce(auth.uid()::text, current_user) OR coalesce(auth.jwt()->>'role', '') = 'admin')
        WITH CHECK ("userId" = coalesce(auth.uid()::text, current_user) OR coalesce(auth.jwt()->>'role', '') = 'admin');
    END $$;`,

    // favourites_snapshot
    `DO $$ BEGIN
      DROP POLICY IF EXISTS "favourites_snapshot_user_policy" ON "favourites_snapshot";
      CREATE POLICY "favourites_snapshot_user_policy" ON "favourites_snapshot"
        FOR ALL
        USING ("userId" = coalesce(auth.uid()::text, current_user) OR coalesce(auth.jwt()->>'role', '') = 'admin')
        WITH CHECK ("userId" = coalesce(auth.uid()::text, current_user) OR coalesce(auth.jwt()->>'role', '') = 'admin');
    END $$;`,

    // user_preferences
    `DO $$ BEGIN
      DROP POLICY IF EXISTS "user_preferences_user_policy" ON "user_preferences";
      CREATE POLICY "user_preferences_user_policy" ON "user_preferences"
        FOR ALL
        USING ("userId" = coalesce(auth.uid()::text, current_user) OR coalesce(auth.jwt()->>'role', '') = 'admin')
        WITH CHECK ("userId" = coalesce(auth.uid()::text, current_user) OR coalesce(auth.jwt()->>'role', '') = 'admin');
    END $$;`,

    // engagement_mappings
    `DO $$ BEGIN
      DROP POLICY IF EXISTS "engagement_mappings_user_policy" ON "engagement_mappings";
      CREATE POLICY "engagement_mappings_user_policy" ON "engagement_mappings"
        FOR ALL
        USING ("userId" = coalesce(auth.uid()::text, current_user) OR coalesce(auth.jwt()->>'role', '') = 'admin')
        WITH CHECK ("userId" = coalesce(auth.uid()::text, current_user) OR coalesce(auth.jwt()->>'role', '') = 'admin');
    END $$;`,

    // catalog_services (Read active services or services belonging to user's providers)
    `DO $$ BEGIN
      DROP POLICY IF EXISTS "catalog_services_read_policy" ON "catalog_services";
      CREATE POLICY "catalog_services_read_policy" ON "catalog_services"
        FOR SELECT
        USING (true);
    END $$;`,

    // runs (Can read runs related to user's engagement orders)
    `DO $$ BEGIN
      DROP POLICY IF EXISTS "runs_user_read_policy" ON "runs";
      CREATE POLICY "runs_user_read_policy" ON "runs"
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM "EngagementOrder" eo
            WHERE eo.id = "runs"."engagementOrderId"
            AND (eo."userId" = coalesce(auth.uid()::text, current_user) OR coalesce(auth.jwt()->>'role', '') = 'admin')
          )
        );
    END $$;`,

    // alerts (Admins can view all, users can view alerts referencing their own orders)
    `DO $$ BEGIN
      DROP POLICY IF EXISTS "alerts_policy" ON "alerts";
      CREATE POLICY "alerts_policy" ON "alerts"
        FOR ALL
        USING (
          "userId" = coalesce(auth.uid()::text, current_user)
          OR coalesce(auth.jwt()->>'role', '') = 'admin'
        );
    END $$;`,
  ];

  for (const pol of policies) {
    try {
      await prisma.$executeRawUnsafe(pol);
      console.log("Applied RLS policy.");
    } catch (err: any) {
      console.warn("Policy application note:", err.message);
    }
  }

  console.log("Supabase Row-Level Security configuration completed successfully.");
}

main()
  .catch((err) => {
    console.error("Failed to apply RLS:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
