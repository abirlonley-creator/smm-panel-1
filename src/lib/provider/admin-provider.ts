import { prisma } from "../prisma";
import { decryptApiKey } from "../security/crypto";
import { StandardSMMv2Provider, MockSMMProvider, type SMMProviderAdapter } from "./adapter";

export interface ResolvedAdminProvider {
  id: string;
  name: string;
  apiUrl: string;
  currency: string;
  adapter: SMMProviderAdapter;
  isMock: boolean;
  connectionRecord: any;
}

/**
 * Returns all active provider connections configured by the Administrator.
 * If a regular user places an order or runs a background job, the system
 * strictly routes execution through the Admin's configured providers.
 */
export async function getAdminProviderConnections(): Promise<ResolvedAdminProvider[]> {
  const adminConns = await prisma.userProviderConnection.findMany({
    where: {
      user: { role: "ADMIN" },
      active: true,
    },
    orderBy: [
      { isMock: "asc" },
      { updatedAt: "desc" },
    ],
  });

  const list = adminConns.map((c) => {
    const rawKey = c.apiKeyEncrypted ? decryptApiKey(c.apiKeyEncrypted) : null;
    const isMock =
      c.isMock ||
      !rawKey ||
      c.apiUrl.includes("mock") ||
      c.apiUrl.includes(".internal") ||
      c.apiUrl.includes(".test");
    const adapter =
      isMock || !rawKey
        ? new MockSMMProvider()
        : new StandardSMMv2Provider(c.apiUrl, rawKey);

    return {
      id: c.id,
      name: c.name,
      apiUrl: c.apiUrl,
      currency: c.currency || "USD",
      adapter,
      isMock,
      connectionRecord: c,
    };
  });

  // Prioritize active non-mock connections with real API keys
  return list.sort((a, b) => (a.isMock === b.isMock ? 0 : a.isMock ? 1 : -1));
}

/**
 * Resolves the Admin's Views provider (e.g. Views Network)
 */
export async function getAdminViewsProvider(): Promise<ResolvedAdminProvider | null> {
  const all = await getAdminProviderConnections();
  const realConns = all.filter((c) => !c.isMock && c.connectionRecord?.apiKeyEncrypted);
  const pool = realConns.length > 0 ? realConns : all;

  return (
    pool.find((c) => {
      const name = c.name.toLowerCase();
      const url = c.apiUrl.toLowerCase();
      return name.includes("views") || name.includes("xmedia") || url.includes("xmedia");
    }) ||
    pool[0] ||
    null
  );
}

/**
 * Resolves the Admin's Engagement provider (e.g. Engagement Network for Likes, Saves & Reposts)
 */
export async function getAdminEngagementProvider(): Promise<ResolvedAdminProvider | null> {
  const all = await getAdminProviderConnections();
  const realConns = all.filter((c) => !c.isMock && c.connectionRecord?.apiKeyEncrypted);
  const pool = realConns.length > 0 ? realConns : all;

  return (
    pool.find((c) => {
      const name = c.name.toLowerCase();
      const url = c.apiUrl.toLowerCase();
      return (
        name.includes("engagement") ||
        name.includes("likes") ||
        name.includes("zeofame") ||
        name.includes("zefame") ||
        url.includes("zeofame") ||
        url.includes("zefame")
      );
    }) ||
    pool.find((c) => !c.name.toLowerCase().includes("views") && !c.apiUrl.toLowerCase().includes("xmedia")) ||
    pool[1] ||
    pool[0] ||
    null
  );
}
