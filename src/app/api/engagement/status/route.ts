import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/security/crypto";
import { StandardSMMv2Provider, MockSMMProvider } from "@/lib/provider/adapter";
import { getTikTokEngagementConfig } from "@/lib/engagement/tiktok-preset-config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const config = getTikTokEngagementConfig();

  // If engagement is globally disabled by admin
  if (!config.enabled) {
    return NextResponse.json({
      success: true,
      enabled: false,
      message: "Engagement system is currently undergoing scheduled maintenance.",
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, walletBalance: true },
  });

  const walletBalance = user?.walletBalance ?? 0;

  // Find user's provider connections
  const userConnections = await prisma.userProviderConnection.findMany({
    where: { userId },
  });

  // 1. Check Zeofame connection (for Likes, Service 1123)
  const zeofameTargetServiceId = config.likes.serviceId; // "1123"
  const zeofameConn = userConnections.find((c) => {
    const name = (c.name || "").toLowerCase();
    const url = (c.apiUrl || "").toLowerCase();
    return name.includes("zeofame") || name.includes("zefame") || url.includes("zeofame") || url.includes("zefame");
  });

  let zeofameStatus = {
    connected: false,
    valid: false,
    name: "Zeofame",
    connectionId: null as string | null,
    balance: null as number | null,
    currency: "EUR",
    hasService: false,
    service: null as any,
    message: "Connect your Zeofame API to activate the TikTok Likes service.",
  };

  if (zeofameConn && zeofameConn.active) {
    zeofameStatus.connectionId = zeofameConn.id;
    zeofameStatus.currency = zeofameConn.currency || "EUR";
    const rawKey = zeofameConn.apiKeyEncrypted ? decryptApiKey(zeofameConn.apiKeyEncrypted) : null;

    if (rawKey || zeofameConn.isMock) {
      const adapter = (zeofameConn.isMock || !rawKey)
        ? new MockSMMProvider()
        : new StandardSMMv2Provider(zeofameConn.apiUrl, rawKey);

      try {
        const balRes = await adapter.getBalance();
        zeofameStatus.valid = true;
        zeofameStatus.connected = true;
        zeofameStatus.balance = typeof balRes.balance === "number" ? balRes.balance : zeofameConn.balance;

        // Check if service 1123 is in DB for this connection
        let srv = await prisma.service.findFirst({
          where: {
            userProviderId: zeofameConn.id,
            OR: [
              { providerServiceId: zeofameTargetServiceId },
              { externalId: zeofameTargetServiceId },
            ],
          },
        });

        // If not in DB, query adapter's services live and import it
        if (!srv && !zeofameConn.isMock) {
          try {
            const allServices = await adapter.getServices();
            const match = allServices.find((s) => String(s.id) === zeofameTargetServiceId);
            if (match) {
              srv = await prisma.service.create({
                data: {
                  externalId: String(match.id),
                  providerServiceId: String(match.id),
                  name: match.name,
                  type: match.type || "Default",
                  platform: match.platform || "TikTok",
                  category: match.category || "TikTok Likes",
                  description: match.description || "TikTok Likes",
                  minQuantity: match.minQuantity || config.likes.minQuantity,
                  maxQuantity: match.maxQuantity || 500000,
                  ratePer1000: match.ratePer1000 || 0.85,
                  userProviderId: zeofameConn.id,
                  active: true,
                },
              });
            }
          } catch (syncErr: any) {
            console.warn("[ENGAGEMENT] Could not sync Zeofame service 1123:", syncErr.message);
          }
        }

        if (srv) {
          zeofameStatus.hasService = true;
          zeofameStatus.service = {
            id: srv.id,
            providerServiceId: srv.providerServiceId || srv.externalId,
            name: srv.name,
            minQuantity: srv.minQuantity,
            maxQuantity: srv.maxQuantity,
            ratePer1000: srv.ratePer1000,
          };
          zeofameStatus.message = "Connected & Active";
        } else {
          zeofameStatus.message = `Service ID ${zeofameTargetServiceId} not found on Zeofame. Please update service configuration.`;
        }
      } catch (err: any) {
        zeofameStatus.connected = false;
        zeofameStatus.valid = false;
        zeofameStatus.message = `Zeofame API connection failed: ${err.message || "Invalid API key or network error"}`;
      }
    }
  }

  // 2. Check Xmedia connection (for Views, Service 10322)
  const xmediaTargetServiceId = config.views.serviceId; // "10322"
  const xmediaConn = userConnections.find((c) => {
    const name = (c.name || "").toLowerCase();
    const url = (c.apiUrl || "").toLowerCase();
    return name.includes("xmedia") || url.includes("xmedia");
  });

  let xmediaStatus = {
    connected: false,
    valid: false,
    name: "Xmedia",
    connectionId: null as string | null,
    balance: null as number | null,
    currency: "INR",
    hasService: false,
    service: null as any,
    message: "Connect your Xmedia API to activate the TikTok Views service.",
  };

  if (xmediaConn && xmediaConn.active) {
    xmediaStatus.connectionId = xmediaConn.id;
    xmediaStatus.currency = xmediaConn.currency || "INR";
    const rawKey = xmediaConn.apiKeyEncrypted ? decryptApiKey(xmediaConn.apiKeyEncrypted) : null;

    if (rawKey || xmediaConn.isMock) {
      const adapter = (xmediaConn.isMock || !rawKey)
        ? new MockSMMProvider()
        : new StandardSMMv2Provider(xmediaConn.apiUrl, rawKey);

      try {
        const balRes = await adapter.getBalance();
        xmediaStatus.valid = true;
        xmediaStatus.connected = true;
        xmediaStatus.balance = typeof balRes.balance === "number" ? balRes.balance : xmediaConn.balance;

        // Check if service 10322 is in DB for this connection
        let srv = await prisma.service.findFirst({
          where: {
            userProviderId: xmediaConn.id,
            OR: [
              { providerServiceId: xmediaTargetServiceId },
              { externalId: xmediaTargetServiceId },
            ],
          },
        });

        // If not in DB, query adapter's services live and import it
        if (!srv && !xmediaConn.isMock) {
          try {
            const allServices = await adapter.getServices();
            const match = allServices.find((s) => String(s.id) === xmediaTargetServiceId);
            if (match) {
              srv = await prisma.service.create({
                data: {
                  externalId: String(match.id),
                  providerServiceId: String(match.id),
                  name: match.name,
                  type: match.type || "Default",
                  platform: match.platform || "TikTok",
                  category: match.category || "TikTok Views",
                  description: match.description || "TikTok Views",
                  minQuantity: match.minQuantity || config.views.minQuantity,
                  maxQuantity: match.maxQuantity || 10000000,
                  ratePer1000: match.ratePer1000 || 0.15,
                  userProviderId: xmediaConn.id,
                  active: true,
                },
              });
            }
          } catch (syncErr: any) {
            console.warn("[ENGAGEMENT] Could not sync Xmedia service 10322:", syncErr.message);
          }
        }

        if (srv) {
          xmediaStatus.hasService = true;
          xmediaStatus.service = {
            id: srv.id,
            providerServiceId: srv.providerServiceId || srv.externalId,
            name: srv.name,
            minQuantity: srv.minQuantity,
            maxQuantity: srv.maxQuantity,
            ratePer1000: srv.ratePer1000,
          };
          xmediaStatus.message = "Connected & Active";
        } else {
          xmediaStatus.message = `Service ID ${xmediaTargetServiceId} not found on Xmedia. Please update service configuration.`;
        }
      } catch (err: any) {
        xmediaStatus.connected = false;
        xmediaStatus.valid = false;
        xmediaStatus.message = `Xmedia API connection failed: ${err.message || "Invalid API key or network error"}`;
      }
    }
  }

  // Calculate pricing estimates
  const avgViewsPerRun = Math.round((config.views.minQuantity + config.views.maxQuantity) / 2); // ~185
  const totalPlannedViews = avgViewsPerRun * config.views.runsCount; // 185 * 16 = 2960
  const viewsRate = xmediaStatus.service?.ratePer1000 ?? 0.15;
  const estimatedViewsCost = Number(((totalPlannedViews / 1000) * viewsRate).toFixed(4));

  const avgLikesPerRun = Math.round((config.likes.minQuantity + config.likes.maxQuantity) / 2); // ~14
  const totalPlannedLikes = avgLikesPerRun * config.likes.runsCount; // 14 * 3 = 42
  const likesRate = zeofameStatus.service?.ratePer1000 ?? 0.95;
  const estimatedLikesCost = Number(((totalPlannedLikes / 1000) * likesRate).toFixed(4));

  const totalEstimatedCost = Number((estimatedViewsCost + estimatedLikesCost).toFixed(2));

  const readyToOrder = zeofameStatus.connected && zeofameStatus.hasService &&
                       xmediaStatus.connected && xmediaStatus.hasService;

  return NextResponse.json({
    success: true,
    enabled: true,
    walletBalance,
    readyToOrder,
    zeofame: zeofameStatus,
    xmedia: xmediaStatus,
    config,
    pricing: {
      totalEstimatedCost,
      viewsCost: estimatedViewsCost,
      likesCost: estimatedLikesCost,
      viewsRate,
      likesRate,
      totalPlannedViews,
      totalPlannedLikes,
      viewsRuns: config.views.runsCount,
      likesRuns: config.likes.runsCount,
      durationMinutes: config.views.runsCount * config.views.intervalMinutes, // 320 minutes
    },
  });
}
