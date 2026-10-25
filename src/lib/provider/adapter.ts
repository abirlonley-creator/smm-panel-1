import { 
  ProviderService, 
  CreateOrderParams, 
  CreateOrderResult, 
  OrderStatusResult, 
  OrderStatus,
  RefillResult,
  RefillStatusResult,
  CancelOrderResult 
} from "../types";
import { prisma } from "../prisma";
import { parseProviderBalanceResponse, ProviderBalance } from "./balance";
import { validateProviderEndpointUrl } from "../security/ssrf";
import { decryptApiKey } from "../security/crypto";

export interface SMMProviderAdapter {
  readonly apiUrl?: string;
  getServices(): Promise<ProviderService[]>;
  createOrder(params: CreateOrderParams): Promise<CreateOrderResult>;
  getOrderStatus(providerOrderId: string): Promise<OrderStatusResult>;
  getMultipleOrdersStatus(providerOrderIds: string[]): Promise<Record<string, OrderStatusResult>>;
  createRefill(providerOrderId: string): Promise<RefillResult>;
  getRefillStatus(refillId: string): Promise<RefillStatusResult>;
  cancelOrder(providerOrderId: string): Promise<CancelOrderResult>;
  getBalance(): Promise<ProviderBalance>;
}

/**
 * Standard Mock SMM Provider for local development and offline resilience.
 * Implements the exact same response schema as the user's SMM API specification.
 */
export class MockSMMProvider implements SMMProviderAdapter {
  public readonly apiUrl: string = "mock";
  private mockServices: ProviderService[] = [
    {
      id: "1",
      name: "Instagram Followers — High Quality / Non-Drop",
      type: "Default",
      platform: "Instagram",
      category: "Followers",
      description: "Authentic profile accounts with profile pictures and active posts. 30-day auto-refill guarantee.",
      minQuantity: 50,
      maxQuantity: 10000,
      ratePer1000: 0.90,
      refillSupported: true,
      cancelSupported: true,
      dripFeedSupported: true,
      dripFeedMinInterval: 15,
      dripFeedMaxInterval: 1440,
      restrictions: "Account must be public during entire delivery. Do not change username while processing.",
      isMock: true,
    },
    {
      id: "2",
      name: "Instagram Custom Comments — Verified Quality",
      type: "Custom Comments",
      platform: "Instagram",
      category: "Comments",
      description: "Custom relevant English comments from active users. High engagement quality.",
      minQuantity: 10,
      maxQuantity: 1500,
      ratePer1000: 8.00,
      refillSupported: false,
      cancelSupported: true,
      dripFeedSupported: false,
      dripFeedMinInterval: 0,
      dripFeedMaxInterval: 0,
      restrictions: "Direct post URL. Comments must follow platform safety guidelines.",
      isMock: true,
    },
    {
      id: "101",
      name: "Instagram Likes — Instant & Natural Pace",
      type: "Default",
      platform: "Instagram",
      category: "Likes",
      description: "High speed gradual delivery likes. Starts within 2-5 minutes.",
      minQuantity: 20,
      maxQuantity: 25000,
      ratePer1000: 0.85,
      refillSupported: true,
      cancelSupported: true,
      dripFeedSupported: true,
      dripFeedMinInterval: 10,
      dripFeedMaxInterval: 720,
      restrictions: "Post URL must be publicly accessible. Compatible with Reels and standard posts.",
      isMock: true,
    },
    {
      id: "201",
      name: "YouTube Views — High Retention (3-5 min watch)",
      type: "Default",
      platform: "YouTube",
      category: "Views",
      description: "High engagement watch duration views from organic browse features and search suggestions.",
      minQuantity: 500,
      maxQuantity: 1000000,
      ratePer1000: 3.10,
      refillSupported: true,
      cancelSupported: true,
      dripFeedSupported: true,
      dripFeedMinInterval: 60,
      dripFeedMaxInterval: 1440,
      restrictions: "Video must be public and unrestricted worldwide. Embed allowed.",
      isMock: true,
    },
    {
      id: "202",
      name: "YouTube Subscribers — Real & Active",
      type: "Default",
      platform: "YouTube",
      category: "Subscribers",
      description: "Real YouTube subscribers delivered gradually to comply with algorithms. 60-day refill.",
      minQuantity: 100,
      maxQuantity: 10000,
      ratePer1000: 18.50,
      refillSupported: true,
      cancelSupported: false,
      dripFeedSupported: true,
      dripFeedMinInterval: 180,
      dripFeedMaxInterval: 1440,
      restrictions: "Subscriber count must be made public on the channel.",
      isMock: true,
    },
    {
      id: "301",
      name: "TikTok Followers — Organic Targeted Profiles",
      type: "Default",
      platform: "TikTok",
      category: "Followers",
      description: "Steady rate TikTok followers with 0% drop rate and instant start.",
      minQuantity: 100,
      maxQuantity: 100000,
      ratePer1000: 4.20,
      refillSupported: true,
      cancelSupported: true,
      dripFeedSupported: true,
      dripFeedMinInterval: 30,
      dripFeedMaxInterval: 720,
      restrictions: "Profile must not be set to private.",
      isMock: true,
    },
    {
      id: "302",
      name: "TikTok Video Likes — Fast & Safe",
      type: "Default",
      platform: "TikTok",
      category: "Likes",
      description: "Fast delivery TikTok video likes to boost engagement in the For You feed.",
      minQuantity: 50,
      maxQuantity: 50000,
      ratePer1000: 0.95,
      refillSupported: false,
      cancelSupported: true,
      dripFeedSupported: false,
      dripFeedMinInterval: 0,
      dripFeedMaxInterval: 0,
      restrictions: "Direct video link required. Video must be public.",
      isMock: true,
    },
    {
      id: "401",
      name: "Twitter / X Followers — Aged Accounts",
      type: "Default",
      platform: "Twitter / X",
      category: "Followers",
      description: "Verified style high credibility profiles with bios, banners, and tweet history.",
      minQuantity: 100,
      maxQuantity: 20000,
      ratePer1000: 6.80,
      refillSupported: true,
      cancelSupported: true,
      dripFeedSupported: true,
      dripFeedMinInterval: 60,
      dripFeedMaxInterval: 1440,
      restrictions: "Account must be public.",
      isMock: true,
    },
    {
      id: "501",
      name: "LinkedIn Post Reactions & Likes",
      type: "Default",
      platform: "LinkedIn",
      category: "Reactions",
      description: "B2B professional profile accounts delivering insightful and thumbs up reactions.",
      minQuantity: 25,
      maxQuantity: 5000,
      ratePer1000: 12.00,
      refillSupported: false,
      cancelSupported: false,
      dripFeedSupported: false,
      dripFeedMinInterval: 0,
      dripFeedMaxInterval: 0,
      restrictions: "Post URL must be public and open for interaction.",
      isMock: true,
    },
    {
      id: "601",
      name: "Spotify Track Streams — Premium Worldwide",
      type: "Default",
      platform: "Spotify",
      category: "Streams",
      description: "Royalty eligible streams with 90-120 seconds play time from Spotify premium users.",
      minQuantity: 1000,
      maxQuantity: 500000,
      ratePer1000: 1.65,
      refillSupported: true,
      cancelSupported: true,
      dripFeedSupported: true,
      dripFeedMinInterval: 60,
      dripFeedMaxInterval: 1440,
      restrictions: "Direct Spotify Track link. Album or Playlist links not accepted for track streams.",
      isMock: true,
    },
  ];

  async getServices(): Promise<ProviderService[]> {
    return this.mockServices;
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const service = this.mockServices.find((s) => s.id === params.serviceExternalId);
    if (service) {
      if (params.quantity < service.minQuantity) {
        return {
          success: false,
          error: `Requested quantity ${params.quantity} is below provider minimum of ${service.minQuantity}`,
        };
      }

      if (params.quantity > service.maxQuantity) {
        return {
          success: false,
          error: `Requested quantity ${params.quantity} exceeds provider maximum of ${service.maxQuantity}`,
        };
      }
    }

    // Exact response matching: { "order": 23501 }
    const providerOrderId = `${Math.floor(20000 + Math.random() * 80000)}`;

    return {
      success: true,
      providerOrderId,
      rawResponse: {
        order: Number(providerOrderId),
      },
    };
  }

  async getOrderStatus(providerOrderId: string): Promise<OrderStatusResult> {
    // Exact schema matching: { charge, start_count, status, remains, currency }
    return {
      success: true,
      providerOrderId,
      status: "PROCESSING",
      charge: 0.27819,
      startCount: 3572,
      deliveredQuantity: 120,
      remains: 157,
      currency: "USD",
    };
  }

  async getMultipleOrdersStatus(providerOrderIds: string[]): Promise<Record<string, OrderStatusResult>> {
    const results: Record<string, OrderStatusResult> = {};
    for (const id of providerOrderIds) {
      results[id] = await this.getOrderStatus(id);
    }
    return results;
  }

  async createRefill(providerOrderId: string): Promise<RefillResult> {
    const refillId = String(Math.floor(100 + Math.random() * 900));
    return {
      success: true,
      refillId,
    };
  }

  async getRefillStatus(refillId: string): Promise<RefillStatusResult> {
    return {
      success: true,
      status: "Completed",
    };
  }

  async cancelOrder(providerOrderId: string): Promise<CancelOrderResult> {
    return {
      success: true,
      message: `Order #${providerOrderId} cancelled successfully by provider`,
    };
  }

  async getBalance(): Promise<ProviderBalance> {
    throw new Error("Provider balance is unavailable while the mock provider is active");
  }
}

/**
 * Standard SMM API v2 Provider implementation adhering 100% to the user's specification:
 * - action=services
 * - action=add (service, link, quantity, runs, interval) -> { "order": 23501 }
 * - action=status (order) -> { "charge": "0.27819", "start_count": "3572", "status": "Partial", "remains": "157", "currency": "USD" }
 * - action=status (orders) -> multi status
 * - action=refill (order) -> { "refill": "1" }
 * - action=refill_status (refill) -> { "status": "Completed" }
 * - action=cancel (orders) -> [ { "order": 2, "cancel": 1 } ]
 * - action=balance -> { "balance": "100.84292", "currency": "USD" }
 */
export class StandardSMMv2Provider implements SMMProviderAdapter {
  public readonly apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl.trim();
    this.apiKey = apiKey.trim();
  }

  private async postRequest(action: string, extraParams: Record<string, string | number> = {}) {
    const urlValidation = validateProviderEndpointUrl(this.apiUrl);
    if (!urlValidation.valid) {
      throw new Error(`SSRF Security Guard blocked request: ${urlValidation.error}`);
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const bodyParams = new URLSearchParams({
      key: this.apiKey,
      action,
      ...Object.fromEntries(Object.entries(extraParams).map(([k, v]) => [k, String(v)])),
    });

    let statusCode = 200;
    let responseText = "";
    let isSuccess = false;

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        // Next.js extends fetch with a data cache. Provider balances must always
        // come from the configured account when a live refresh is requested.
        cache: "no-store",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "AuraSMM-Engine/2.0",
        },
        body: bodyParams.toString(),
        signal: controller.signal,
      });

      statusCode = response.status;
      responseText = await response.text();
      clearTimeout(timeout);

      let parsed: unknown;
      try {
        parsed = JSON.parse(responseText);
        isSuccess = response.ok && !((parsed as Record<string, unknown>)?.error);
      } catch {
        parsed = { raw: responseText };
        isSuccess = false;
      }

      // Record audit record in DB (redact key!)
      const safePayload = {
        action,
        ...extraParams,
        key: "••••••••",
      };

      await prisma.providerRequestRecord.create({
        data: {
          action,
          endpoint: this.apiUrl,
          requestPayload: JSON.stringify(safePayload),
          responsePayload: responseText.slice(0, 2000),
          statusCode,
          durationMs: Date.now() - startTime,
          success: isSuccess,
        },
      }).catch((e) => console.error("Failed to log provider request record:", e));

      return {
        ok: response.ok,
        status: response.status,
        data: parsed,
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      await prisma.providerRequestRecord.create({
        data: {
          action,
          endpoint: this.apiUrl,
          requestPayload: JSON.stringify({ action, ...extraParams, key: "••••••••" }),
          responsePayload: JSON.stringify({ error: errorMessage }),
          statusCode: 504,
          durationMs: Date.now() - startTime,
          success: false,
        },
      }).catch(() => {});

      throw new Error(`Provider connection failed: ${errorMessage}`);
    }
  }

  async getServices(): Promise<ProviderService[]> {
    const result = await this.postRequest("services");
    if (!result.ok || !Array.isArray(result.data)) {
      throw new Error("Invalid services response from provider");
    }

    return (result.data as Array<Record<string, unknown>>).map((item) => {
      const cat = String(item.category || "General");
      // Detect platform from category or name
      let platform: ProviderService["platform"] = "Other";
      const lower = `${cat} ${item.name}`.toLowerCase();
      if (lower.includes("instagram")) platform = "Instagram";
      else if (lower.includes("youtube")) platform = "YouTube";
      else if (lower.includes("tiktok")) platform = "TikTok";
      else if (lower.includes("twitter") || lower.includes(" x ")) platform = "Twitter / X";
      else if (lower.includes("linkedin")) platform = "LinkedIn";
      else if (lower.includes("spotify")) platform = "Spotify";
      else if (lower.includes("telegram")) platform = "Telegram";

      const type = String(item.type || "Default");
      const isDrip = type.toLowerCase().includes("drip") || Boolean(item.dripfeed);

      return {
        id: String(item.service ?? item.id),
        name: String(item.name),
        type,
        platform,
        category: cat,
        description: String(item.desc || item.description || `${type} service in ${cat}`),
        minQuantity: parseInt(String(item.min || "10"), 10),
        maxQuantity: parseInt(String(item.max || "100000"), 10),
        ratePer1000: parseFloat(String(item.rate || "1.0")),
        refillSupported: Boolean(item.refill),
        cancelSupported: item.cancel !== undefined ? Boolean(item.cancel) : true,
        dripFeedSupported: isDrip,
        dripFeedMinInterval: 10,
        dripFeedMaxInterval: 1440,
        restrictions: "Provider verified restrictions apply.",
        isMock: false,
      };
    });
  }

  async createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
    const extra: Record<string, string | number> = {
      service: params.serviceExternalId,
      link: params.targetUrl,
      quantity: params.quantity,
    };

    if (params.runs && params.runs > 1 && params.interval) {
      extra.runs = params.runs;
      extra.interval = params.interval;
    }

    try {
      const res = await this.postRequest("add", extra);
      const data = res.data as Record<string, unknown>;

      if (data && data.order) {
        return {
          success: true,
          providerOrderId: String(data.order),
          rawResponse: data,
        };
      }

      return {
        success: false,
        error: String(data?.error || "Provider rejected order placement"),
        rawResponse: data,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getOrderStatus(providerOrderId: string): Promise<OrderStatusResult> {
    try {
      const res = await this.postRequest("status", { order: providerOrderId });
      const data = res.data as Record<string, unknown>;

      if (!data || data.error) {
        return {
          success: false,
          providerOrderId,
          status: "REQUIRES_RECONCILIATION",
          error: String(data?.error || "Unable to read order status"),
        };
      }

      // Map provider status according to SMM standard specification:
      // "Completed", "In progress", "Processing", "Pending", "Partial", "Canceled", "Cancelled", "Fail"
      const rawStatus = String(data.status || "").toLowerCase();
      let status: OrderStatus = "PENDING";

      if (rawStatus.includes("complete")) status = "COMPLETED";
      else if (rawStatus.includes("progress") || rawStatus.includes("process")) status = "PROCESSING";
      else if (rawStatus.includes("partial")) status = "PARTIAL";
      else if (rawStatus.includes("cancel")) status = "CANCELLED";
      else if (rawStatus.includes("fail") || rawStatus.includes("error")) status = "FAILED";

      const remains = data.remains !== undefined ? parseInt(String(data.remains), 10) : undefined;
      const startCount = data.start_count !== undefined ? parseInt(String(data.start_count), 10) : undefined;
      const charge = data.charge !== undefined ? parseFloat(String(data.charge)) : undefined;

      return {
        success: true,
        providerOrderId,
        status,
        charge,
        startCount,
        remains,
        currency: String(data.currency || "USD"),
      };
    } catch (err: unknown) {
      return {
        success: false,
        providerOrderId,
        status: "REQUIRES_RECONCILIATION",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getMultipleOrdersStatus(providerOrderIds: string[]): Promise<Record<string, OrderStatusResult>> {
    try {
      const res = await this.postRequest("status", { orders: providerOrderIds.join(",") });
      const data = res.data as Record<string, Record<string, unknown>>;
      const results: Record<string, OrderStatusResult> = {};

      for (const [orderId, orderData] of Object.entries(data || {})) {
        if (orderData.error) {
          results[orderId] = {
            success: false,
            providerOrderId: orderId,
            status: "REQUIRES_RECONCILIATION",
            error: String(orderData.error),
          };
          continue;
        }

        const rawStatus = String(orderData.status || "").toLowerCase();
        let status: OrderStatus = "PENDING";
        if (rawStatus.includes("complete")) status = "COMPLETED";
        else if (rawStatus.includes("progress") || rawStatus.includes("process")) status = "PROCESSING";
        else if (rawStatus.includes("partial")) status = "PARTIAL";
        else if (rawStatus.includes("cancel")) status = "CANCELLED";
        else if (rawStatus.includes("fail") || rawStatus.includes("error")) status = "FAILED";

        results[orderId] = {
          success: true,
          providerOrderId: orderId,
          status,
          charge: orderData.charge !== undefined ? parseFloat(String(orderData.charge)) : undefined,
          startCount: orderData.start_count !== undefined ? parseInt(String(orderData.start_count), 10) : undefined,
          remains: orderData.remains !== undefined ? parseInt(String(orderData.remains), 10) : undefined,
          currency: String(orderData.currency || "USD"),
        };
      }

      return results;
    } catch {
      return {};
    }
  }

  async createRefill(providerOrderId: string): Promise<RefillResult> {
    try {
      const res = await this.postRequest("refill", { order: providerOrderId });
      const data = res.data as Record<string, unknown>;

      if (data && data.refill && !data.error) {
        return {
          success: true,
          refillId: String(data.refill),
        };
      }

      return {
        success: false,
        error: String(data?.error || "Provider rejected refill request"),
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getRefillStatus(refillId: string): Promise<RefillStatusResult> {
    try {
      const res = await this.postRequest("refill_status", { refill: refillId });
      const data = res.data as Record<string, unknown>;

      if (data && data.status) {
        const raw = String(data.status);
        let status: RefillStatusResult["status"] = "In progress";
        if (raw.toLowerCase().includes("complete")) status = "Completed";
        else if (raw.toLowerCase().includes("reject")) status = "Rejected";
        else if (raw.toLowerCase().includes("pending")) status = "Pending";

        return {
          success: true,
          status,
        };
      }

      return {
        success: false,
        status: "Error",
        error: String(data?.error || "Unable to retrieve refill status"),
      };
    } catch (err: unknown) {
      return {
        success: false,
        status: "Error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async cancelOrder(providerOrderId: string): Promise<CancelOrderResult> {
    try {
      const res = await this.postRequest("cancel", { orders: providerOrderId });
      const data = res.data;

      // User spec response: [ { "order": 2, "cancel": 1 } ] or [ { "order": 9, "cancel": { "error": "Incorrect order ID" } } ]
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        if (item.cancel && item.cancel !== null && typeof item.cancel !== "object") {
          return {
            success: true,
            message: `Order #${providerOrderId} cancel accepted`,
          };
        } else if (item.cancel && typeof item.cancel === "object" && item.cancel.error) {
          return {
            success: false,
            error: String(item.cancel.error),
          };
        }
      } else if (typeof data === "object" && data !== null) {
        const obj = data as Record<string, unknown>;
        if (obj.cancel && !obj.error) {
          return { success: true, message: "Cancellation request processed" };
        }
        if (obj.error) {
          return { success: false, error: String(obj.error) };
        }
      }

      return {
        success: true,
        message: "Cancellation request sent to provider",
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getBalance(): Promise<ProviderBalance> {
    const res = await this.postRequest("balance");
    return parseProviderBalanceResponse(res.data, res.status);
  }
}

/**
 * Resolves active provider adapter based on user configuration or fallback.
 * When userId is provided, strictly routes all operations through that specific user's provider connection.
 */
export async function getActiveProvider(
  userId?: string,
  providerId?: string
): Promise<{
  adapter: SMMProviderAdapter;
  config: {
    id: string;
    name: string;
    isMock: boolean;
    apiUrl: string;
    userId?: string;
    lastSyncAt?: Date | null;
    currency?: string;
  };
}> {
  if (userId) {
    let connection: any = null;

    if (providerId) {
      connection = await prisma.userProviderConnection.findFirst({
        where: { id: providerId, userId },
      });
    }

    if (!connection) {
      const pref = await prisma.userPreference.findUnique({
        where: { userId },
      });
      if (pref?.activeProviderId) {
        connection = await prisma.userProviderConnection.findFirst({
          where: { id: pref.activeProviderId, userId },
        });
      }
    }

    if (!connection) {
      connection = await prisma.userProviderConnection.findFirst({
        where: { userId, active: true },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!connection) {
      connection = await prisma.userProviderConnection.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
    }

    if (connection) {
      const decryptedKey = decryptApiKey(connection.apiKeyEncrypted);
      const isMockUrl = connection.isMock || !decryptedKey || connection.apiUrl.includes("mock") || connection.apiUrl.includes(".internal") || connection.apiUrl.includes(".test");
      if (isMockUrl) {
        return {
          adapter: new MockSMMProvider(),
          config: {
            id: connection.id,
            name: connection.name,
            isMock: true,
            apiUrl: connection.apiUrl,
            userId: connection.userId,
            lastSyncAt: connection.lastSyncAt,
            currency: connection.currency,
          },
        };
      }

      return {
        adapter: new StandardSMMv2Provider(connection.apiUrl, decryptedKey),
        config: {
          id: connection.id,
          name: connection.name,
          isMock: false,
          apiUrl: connection.apiUrl,
          userId: connection.userId,
          lastSyncAt: connection.lastSyncAt,
          currency: connection.currency,
        },
      };
    }

    // Default mock if user has no connection
    return {
      adapter: new MockSMMProvider(),
      config: {
        id: `mock-${userId}`,
        name: "Standard SMM Mock Adapter",
        isMock: true,
        apiUrl: "https://mock-provider.smm.internal/v2",
        userId,
        lastSyncAt: null,
        currency: "INR",
      },
    };
  }

  // Fallback if no userId: return standard MockSMMProvider
  return {
    adapter: new MockSMMProvider(),
    config: {
      id: "mock-system",
      name: "Standard SMM Mock Adapter",
      isMock: true,
      apiUrl: "https://mock-provider.smm.internal/v2",
      lastSyncAt: null,
      currency: "INR",
    },
  };
}
