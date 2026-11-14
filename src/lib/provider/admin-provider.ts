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
    orderBy: { createdAt: "asc" },
  });

  return adminConns.map((c) => {
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
}

/**
 * Resolves the Admin's Views provider (e.g. Views Network)
 */
export async function getAdminViewsProvider(): Promise<ResolvedAdminProvider | null> {
  const all = await getAdminProviderConnections();
  return (
    all.find((c) => {
      const name = c.name.toLowerCase();
      const url = c.apiUrl.toLowerCase();
      return name.includes("views") || name.includes("xmedia") || url.includes("xmedia");
    }) ||
    all[0] ||
    null
  );
}

/**
 * Resolves the Admin's Engagement provider (e.g. Engagement Network for Likes, Saves & Reposts)
 */
export async function getAdminEngagementProvider(): Promise<ResolvedAdminProvider | null> {
  const all = await getAdminProviderConnections();
  return (
    all.find((c) => {
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
    all[1] ||
    all[0] ||
    null
  );
}
