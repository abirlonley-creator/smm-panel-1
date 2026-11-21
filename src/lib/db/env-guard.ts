/**
 * Strict Environment Guard for Database Operations
 *
 * Default-deny database connection guard. Enforces that migrations, seeds,
 * integration tests, and Prisma commands can NEVER connect to production.
 */

// Production denylist patterns (checked first; case-insensitive)
const DENIED_PATTERNS = [
  /aws-0-ap-south-1\.pooler\.supabase\.com/i,
  /db\.[a-z0-9_-]+\.supabase\.co/i,
  /zyqiuspkmldetupuxpyu/i, // Production Supabase project reference
  /\bprod\b/i,
  /\bproduction\b/i,
];

// Default local/test allowlist (host/dbname pairs)
const DEFAULT_ALLOWLIST = [
  "localhost/aurasmm_test",
  "127.0.0.1/aurasmm_test",
];

export function assertSafeDatabaseUrl(databaseUrl?: string): void {
  const url = databaseUrl || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("[DB_GUARD] DATABASE_URL is not set");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error(`[DB_GUARD] Malformed database URL: ${url}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const rawPath = parsed.pathname.replace(/^\//, "");
  // Strip any query parameters or trailing slashes from database name
  const dbName = rawPath.split("?")[0].replace(/\/$/, "").toLowerCase();

  // 1. Production Denylist Check (Evaluated FIRST; takes absolute precedence)
  const fullTargetForDenylist = `${hostname}/${dbName}`;
  for (const pattern of DENIED_PATTERNS) {
    if (pattern.test(hostname) || pattern.test(fullTargetForDenylist) || pattern.test(url)) {
      throw new Error(
        `[DB_GUARD_BLOCKED] Production database pattern detected (${hostname}/${dbName}). Connection strictly forbidden.`
      );
    }
  }

  // 2. Default-Deny Exact Allowlist Check
  // Allowed pairs configured via TEST_DB_ALLOWLIST env var (format: "host/dbname,host2/dbname2")
  const customAllowlist = process.env.TEST_DB_ALLOWLIST
    ? process.env.TEST_DB_ALLOWLIST.split(",").map((s) => s.trim().toLowerCase())
    : [];

  const effectiveAllowlist = new Set([...DEFAULT_ALLOWLIST, ...customAllowlist]);
  const currentPair = `${hostname}/${dbName}`;

  if (!effectiveAllowlist.has(currentPair)) {
    throw new Error(
      `[DB_GUARD_BLOCKED] Target database (${currentPair}) is not on the explicit TEST_DB_ALLOWLIST. Allowed: ${Array.from(effectiveAllowlist).join(", ")}`
    );
  }
}
