import { loadEnvConfig } from "@next/env";

async function startWorkerWithEnvironment() {
  // The standalone worker does not pass through `next dev` or `next start`,
  // so load the same root .env/.env.local configuration before loading worker code.
  loadEnvConfig(process.cwd());
  const { startWorker } = await import("./worker");
  await startWorker();
}

startWorkerWithEnvironment().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[WORKER] Failed to load environment or start: ${message}`);
  process.exitCode = 1;
});
