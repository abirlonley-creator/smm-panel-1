import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { assertSafeDatabaseUrl } from "../src/lib/db/env-guard";

// Explicitly parse and load ONLY .env.test (never .env)
const envTestPath = path.resolve(process.cwd(), ".env.test");
const testEnv: Record<string, string> = {};

if (fs.existsSync(envTestPath)) {
  const content = fs.readFileSync(envTestPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      testEnv[key] = val;
    }
  }
}

// Guard both DATABASE_URL and DIRECT_URL
const dbUrl = testEnv.DATABASE_URL || process.env.DATABASE_URL;
const directUrl = testEnv.DIRECT_URL || process.env.DIRECT_URL;

console.log("[PRISMA_SAFE] Verifying database URLs against safety guard...");

try {
  assertSafeDatabaseUrl(dbUrl);
  if (directUrl) {
    assertSafeDatabaseUrl(directUrl);
  }
} catch (err: any) {
  console.error("\n❌ [PRISMA_SAFE_ABORT] Execution blocked by database environment guard:");
  console.error(`   ${err.message}\n`);
  process.exit(1);
}

console.log("[PRISMA_SAFE] Target URLs verified as safe test/staging targets.");

// Run prisma command passing arguments
const prismaArgs = process.argv.slice(2);
const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";

const result = spawnSync(npxCmd, ["prisma", ...prismaArgs], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...testEnv,
    DATABASE_URL: dbUrl,
    DIRECT_URL: directUrl,
  },
});

process.exit(result.status ?? 0);
