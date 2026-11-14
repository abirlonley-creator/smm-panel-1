import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/security/crypto";
import { StandardSMMv2Provider, MockSMMProvider } from "@/lib/provider/adapter";
import {
  getTikTokEngagementConfig,
  TIKTOK_TIER_PRESETS,
  getAllTikTokPresets,
} from "@/lib/engagement/tiktok-preset-config";

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

  // 1. Check Engagement connection (for Likes #1123, Saves #807, Shares #718)
  const zeofameConn = userConnections.find((c) => {
    const name = (c.name || "").toLowerCase();
    const url = (c.apiUrl || "").toLowerCase();
    return name.includes("zeofame") || name.includes("zefame") || name.includes("engagement") || url.includes("zeofame") || url.includes("zefame");
  });

  let zeofameStatus = {
    connected: false,
    valid: false,
    name: "Engagement Engine",
    connectionId: null as string | null,
    balance: null as number | null,
    currency: "EUR",
    hasService: false,
    service: null as any,
    savesService: null as any,
    sharesService: null as any,
    message: "Connect your Engagement API to activate TikTok Likes, Saves & Reposts.",
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
        let bal = zeofameConn.balance;
        const isFresh = zeofameConn.lastSyncAt && (Date.now() - zeofameConn.lastSyncAt.getTime() < 30000);
        if (!isFresh) {
          try {
            const balRes = await Promise.race([
              adapter.getBalance(),
              new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500)),
            ]);
            if (typeof balRes.balance === "number") bal = balRes.balance;
          } catch {
            // Fall back to stored balance without blocking
          }
        }
        zeofameStatus.valid = true;
        zeofameStatus.connected = true;
        zeofameStatus.balance = bal;

        // Check or import Likes service 1123
        let likesSrv = await prisma.service.findFirst({
          where: {
            userProviderId: zeofameConn.id,
            OR: [{ providerServiceId: "1123" }, { externalId: "1123" }],
          },
        });

        // Check or import Saves service 807
        let savesSrv = await prisma.service.findFirst({
          where: {
            userProviderId: zeofameConn.id,
            OR: [{ providerServiceId: "807" }, { externalId: "807" }],
          },
        });

        // Check or import Shares service 718
        let sharesSrv = await prisma.service.findFirst({
          where: {
            userProviderId: zeofameConn.id,
            OR: [{ providerServiceId: "718" }, { externalId: "718" }],
          },
        });

        if ((!likesSrv || !savesSrv || !sharesSrv) && !zeofameConn.isMock) {
          try {
            const allServices = await adapter.getServices();
            if (!likesSrv) {
              const match = allServices.find((s) => String(s.id) === "1123");
              if (match) {
                likesSrv = await prisma.service.create({
                  data: {
                    externalId: "1123",
                    providerServiceId: "1123",
                    name: match.name,
                    type: match.type || "Default",
                    platform: "TikTok",
                    category: "TikTok Likes",
                    description: match.description || match.name || "TikTok Likes",
                    minQuantity: match.minQuantity || 10,
                    maxQuantity: match.maxQuantity || 500000,
                    ratePer1000: match.ratePer1000 || 0.88,
                    userProviderId: zeofameConn.id,
                    active: true,
                  },
                });
              }
            }
            if (!savesSrv) {
              const match = allServices.find((s) => String(s.id) === "807");
              if (match) {
                savesSrv = await prisma.service.create({
                  data: {
                    externalId: "807",
                    providerServiceId: "807",
                    name: match.name,
                    type: match.type || "Default",
                    platform: "TikTok",
                    category: "TikTok Saves",
                    description: match.description || match.name || "TikTok Saves",
                    minQuantity: match.minQuantity || 10,
                    maxQuantity: match.maxQuantity || 500000,
                    ratePer1000: match.ratePer1000 || 0.22,
                    userProviderId: zeofameConn.id,
                    active: true,
                  },
                });
              }
            }
            if (!sharesSrv) {
              const match = allServices.find((s) => String(s.id) === "718");
              if (match) {
                sharesSrv = await prisma.service.create({
                  data: {
                    externalId: "718",
                    providerServiceId: "718",
                    name: match.name,
                    type: match.type || "Default",
                    platform: "TikTok",
                    category: "TikTok Shares",
                    description: match.description || match.name || "TikTok Shares",
                    minQuantity: match.minQuantity || 10,
                    maxQuantity: match.maxQuantity || 500000,
                    ratePer1000: match.ratePer1000 || 0.22,
                    userProviderId: zeofameConn.id,
                    active: true,
                  },
                });
              }
            }
          } catch (syncErr: any) {
            console.warn("[ENGAGEMENT] Could not sync Zeofame services:", syncErr.message);
          }
        }

        if (likesSrv) {
          zeofameStatus.hasService = true;
          zeofameStatus.service = {
            id: likesSrv.id,
            providerServiceId: likesSrv.providerServiceId || likesSrv.externalId,
            name: likesSrv.name,
            minQuantity: likesSrv.minQuantity,
            maxQuantity: likesSrv.maxQuantity,
            ratePer1000: likesSrv.ratePer1000,
          };
          zeofameStatus.message = "Connected & Active";
        }
        if (savesSrv) {
          zeofameStatus.savesService = {
            id: savesSrv.id,
            providerServiceId: savesSrv.providerServiceId || savesSrv.externalId,
            ratePer1000: savesSrv.ratePer1000,
          };
        }
        if (sharesSrv) {
          zeofameStatus.sharesService = {
            id: sharesSrv.id,
            providerServiceId: sharesSrv.providerServiceId || sharesSrv.externalId,
            ratePer1000: sharesSrv.ratePer1000,
          };
        }
      } catch (err: any) {
        zeofameStatus.connected = false;
        zeofameStatus.valid = false;
        zeofameStatus.message = `Engagement API connection failed: ${err.message || "Invalid API key or network error"}`;
      }
    }
  }

  // 2. Check Views connection (for Views Engine)
  const xmediaConn = userConnections.find((c) => {
    const name = (c.name || "").toLowerCase();
    const url = (c.apiUrl || "").toLowerCase();
    return name.includes("xmedia") || name.includes("views") || url.includes("xmedia");
  });

  let xmediaStatus = {
    connected: false,
    valid: false,
    name: "Views Engine",
    connectionId: null as string | null,
    balance: null as number | null,
    currency: "INR",
    hasService: false,
    service: null as any,
    message: "Connect your Views API to activate the TikTok Views service.",
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
        let bal = xmediaConn.balance;
        const isFresh = xmediaConn.lastSyncAt && (Date.now() - xmediaConn.lastSyncAt.getTime() < 30000);
        if (!isFresh) {
          try {
            const balRes = await Promise.race([
              adapter.getBalance(),
              new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500)),
            ]);
            if (typeof balRes.balance === "number") bal = balRes.balance;
          } catch {
            // Fall back to stored balance without blocking
          }
        }
        xmediaStatus.valid = true;
        xmediaStatus.connected = true;
        xmediaStatus.balance = bal;

        // Check if service 10322 is in DB for this connection
        let srv = await prisma.service.findFirst({
          where: {
            userProviderId: xmediaConn.id,
            OR: [
              { providerServiceId: "10322" },
              { externalId: "10322" },
            ],
          },
        });

        if (!srv && !xmediaConn.isMock) {
          try {
            const allServices = await adapter.getServices();
            const match = allServices.find((s) => String(s.id) === "10322");
            if (match) {
              srv = await prisma.service.create({
                data: {
                  externalId: "10322",
                  providerServiceId: "10322",
                  name: match.name,
                  type: match.type || "Default",
                  platform: "TikTok",
                  category: "TikTok Views",
                  description: match.description || match.name || "TikTok Views",
                  minQuantity: match.minQuantity || 100,
                  maxQuantity: match.maxQuantity || 10000000,
                  ratePer1000: match.ratePer1000 || 5.7,
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
        }
      } catch (err: any) {
        xmediaStatus.connected = false;
        xmediaStatus.valid = false;
        xmediaStatus.message = `Views API connection failed: ${err.message || "Invalid API key or network error"}`;
      }
    }
  }

  // Base Rates
  const viewsRate = xmediaStatus.service?.ratePer1000 ?? 5.7;
  const likesRate = zeofameStatus.service?.ratePer1000 ?? 0.88;
  const savesRate = zeofameStatus.savesService?.ratePer1000 ?? 0.22;
  const sharesRate = zeofameStatus.sharesService?.ratePer1000 ?? 0.22;

  // Calculate costs for all 4 presets
  const presetsList = getAllTikTokPresets().map((preset) => {
    const vCost = Number(((preset.targetViews / 1000) * viewsRate).toFixed(4));
    const lCost = Number(((preset.targetLikes / 1000) * likesRate).toFixed(4));
    const sCost = preset.saves?.enabled ? Number(((preset.targetSaves / 1000) * savesRate).toFixed(4)) : 0;
    const rCost = preset.shares?.enabled ? Number(((preset.targetShares / 1000) * sharesRate).toFixed(4)) : 0;
    const totalCost = Number((vCost + lCost + sCost + rCost).toFixed(2));

    return {
      ...preset,
      pricing: {
        viewsCost: vCost,
        likesCost: lCost,
        savesCost: sCost,
        sharesCost: rCost,
        totalCost,
      },
    };
  });

  const defaultPreset = presetsList[0];
  const readyToOrder = Boolean(zeofameStatus.connected && xmediaStatus.connected);

  return NextResponse.json({
    success: true,
    enabled: true,
    walletBalance,
    readyToOrder,
    zeofame: zeofameStatus,
    xmedia: xmediaStatus,
    rates: {
      viewsRate,
      likesRate,
      savesRate,
      sharesRate,
    },
    presets: presetsList,
    config,
    pricing: {
      totalEstimatedCost: defaultPreset.pricing.totalCost,
      viewsCost: defaultPreset.pricing.viewsCost,
      likesCost: defaultPreset.pricing.likesCost,
      viewsRate,
      likesRate,
      totalPlannedViews: defaultPreset.targetViews,
      totalPlannedLikes: defaultPreset.targetLikes,
      viewsRuns: defaultPreset.views.runsCount,
      likesRuns: defaultPreset.likes.runsCount,
      durationMinutes: defaultPreset.totalDurationMinutes,
    },
  });
}
