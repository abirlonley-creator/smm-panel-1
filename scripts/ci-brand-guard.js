const fs = require("fs");
const path = require("path");

/**
 * CI Brand Guard for AuraSMM
 * Scans the codebase to ensure zero instances of forbidden legacy branding exist.
 * Fails the process (exit code 1) if forbidden patterns are detected.
 */

// Target keyword split to avoid matching this guard script itself
const FORBIDDEN_PATTERN = new RegExp(["dhan", "smm"].join(""), "i");
const FORBIDDEN_SPACED = new RegExp(["dhan", "\\s+smm"].join(""), "i");

const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "artifacts",
  ".system_generated",
  ".gemini",
]);

const IGNORED_FILES = new Set([
  "ci-brand-guard.ts",
  "ci-brand-guard.js",
  "package-lock.json",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".prisma",
  ".md",
  ".html",
  ".css",
  ".svg",
  ".yml",
  ".yaml",
]);

function scanDirectory(dir, violations) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(process.cwd(), fullPath);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        scanDirectory(fullPath, violations);
      }
    } else if (entry.isFile()) {
      if (IGNORED_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      try {
        const fileContent = fs.readFileSync(fullPath, "utf-8");
        const lines = fileContent.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (FORBIDDEN_PATTERN.test(line) || FORBIDDEN_SPACED.test(line)) {
            violations.push({
              file: relPath,
              line: i + 1,
              content: line.trim(),
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  }
}

function runBrandCheck() {
  console.log("=================================================================");
  console.log("   AURASMM BRAND INTEGRITY CI CHECK");
  console.log("=================================================================\n");
  console.log("Scanning repository for legacy branding traces...");

  const violations = [];
  scanDirectory(process.cwd(), violations);

  if (violations.length > 0) {
    console.error(`\n❌ CI FAILURE: Found ${violations.length} forbidden legacy brand occurrences:\n`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} -> ${v.content}`);
    }
    console.error("\nPlease update all references to use 'AuraSMM' or import BRAND from '@/lib/brand'.\n");
    process.exit(1);
  }

  console.log("✔ SUCCESS: Zero legacy brand occurrences found across all inspected files.");
  console.log("=================================================================\n");
}

runBrandCheck();
