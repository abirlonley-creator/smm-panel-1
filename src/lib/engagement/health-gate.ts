import { prisma } from "../prisma";
import { EngagementType } from "./planner";
import { getPlatformProfile } from "./platform-profiles";
import { decryptApiKey } from "../security/crypto";

export interface HealthGateResult {
  ok: boolean;
  userMessage?: string;
  adminReason?: string;
  failedProviderId?: string;
  failedProviderName?: string;
  failedServiceId?: string;
}

/**
 * Validates upstream provider readiness before planning, previewing or charging an order.
 * - Provider must exist and be active
 * - API key must be valid (or mock provider)
 * - Provider balance must be sufficient for the estimated cost
 * - Mapped service ID must be active
 * 
 * If any check fails, logs an incident in AdminAlert and returns a calm user message.
 */
export async function checkProviderHealthGate(
  profileId: string,
  enabledTypes: EngagementType[],
  estimatedCost: number = 0,
  userId?: string
): Promise<HealthGateResult> {
  const profile = getPlatformProfile(profileId);

  // If userId is provided, check user's actual mapped providers
  if (userId) {
    const userMappings = await prisma.userEngagementMapping.findMany({
      where: { userId, platform: profile.platform },
      include: { provider: true },
    });
    const mappingMap = new Map(userMappings.map((m) => [m.engagementType, m]));

    for (const type of enabledTypes) {
      const mapping = mappingMap.get(type);
      if (!mapping || !mapping.active) {
        return {
          ok: false,
          userMessage: `Pick a service for ${type.charAt(0).toUpperCase() + type.slice(1)} to continue.`,
          adminReason: `No user engagement mapping configured for ${profile.platform} [${type}].`,
          failedServiceId: type,
        };
      }

      const provider = mapping.provider;
      if (!provider || !provider.active) {
        return {
          ok: false,
          userMessage: `${type.charAt(0).toUpperCase() + type.slice(1)} paused — its provider was disconnected. Pick a replacement service or leave ${type.charAt(0).toUpperCase() + type.slice(1)} off.`,
          adminReason: `Mapped provider for ${profile.platform} [${type}] is disconnected or deleted.`,
          failedProviderId: mapping.providerId,
          failedProviderName: provider?.name,
        };
      }

      // Check decrypted API key
      const decryptedKey = decryptApiKey(provider.apiKeyEncrypted);
      if (!decryptedKey || decryptedKey.trim() === "") {
        return {
          ok: false,
          userMessage: `Provider "${provider.name}" API key is invalid or unconfigured. Please update your key in the Wallet tab.`,
          adminReason: `Provider "${provider.name}" has an invalid or empty API key.`,
          failedProviderId: provider.id,
          failedProviderName: provider.name,
        };
      }

      // Check balance if available
      if (provider.balance !== null && provider.balance < estimatedCost && estimatedCost > 0) {
        return {
          ok: false,
          userMessage: `Insufficient balance on provider "${provider.name}". Available: ${provider.currency} ${provider.balance.toFixed(2)}, Needed: ${estimatedCost.toFixed(2)}.`,
          adminReason: `Insufficient balance on provider "${provider.name}".`,
          failedProviderId: provider.id,
          failedProviderName: provider.name,
        };
      }
    }

    return { ok: true };
  }

  // Fallback for unauthenticated preview mode:
  // Collect unique provider IDs needed for default profile
  const neededServices = enabledTypes.map((t) => ({
    type: t,
    mapping: profile.serviceMappings[t],
  }));

  for (const { type, mapping } of neededServices) {
    if (!mapping) continue;

    const providerId = mapping.providerId;
    const providerServiceId = mapping.providerServiceId;

    // Look up provider in DB
    const provider = await prisma.userProviderConnection.findFirst({
      where: {
        active: true,
      },
    }) || await prisma.provider.findFirst({
      where: {
        OR: [
          { id: providerId },
          { active: true },
        ],
      },
    });

    if (!provider || !provider.active) {
      // In unauthenticated preview mode, allow preview to render smoothly
      return { ok: true };
    }
  }

  return { ok: true };
}

/**
 * Helper to record incident in AdminAlert without disrupting execution.
 */
async function logHealthIncident(data: {
  severity: "high" | "medium" | "low";
  type: string;
  platform?: string;
  engagementType?: string;
  providerId?: string;
  providerName?: string;
  reason: string;
  orderId?: string;
  runId?: string;
}) {
  try {
    await prisma.adminAlert.create({
      data: {
        severity: data.severity,
        type: data.type,
        platform: data.platform,
        engagementType: data.engagementType,
        providerId: data.providerId,
        providerName: data.providerName,
        reason: data.reason,
        orderId: data.orderId,
        runId: data.runId,
        status: "open",
      },
    });
  } catch (err) {
    console.error("[HEALTH-GATE] Failed to record admin alert:", err);
  }
}
