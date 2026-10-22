/**
 * Video analytics adapters for Likes Analyze.
 *
 * The Standard SMM v2 provider API does not expose video analytics
 * (no likes/views observation endpoint exists in that specification),
 * so a separate analytics adapter is used.
 *
 * Adapters:
 *  - MockVideoAnalyticsAdapter  → deterministic sandbox simulation (clearly labelled)
 *  - UnavailableAnalyticsAdapter → honest "metrics unavailable" response
 *
 * No unauthorized endpoints are invented; when no approved data source is
 * configured the unavailable adapter is returned and the UI reports the
 * metrics as unavailable instead of fabricating them.
 */

export interface VideoAnalyticsSnapshot {
  /** When false, likes/views must not be persisted as measurements. */
  available: boolean;
  likes?: number | null;
  views?: number | null;
  shares?: number | null;
  /** ISO UTC timestamp of when the snapshot was fetched. */
  capturedAt: string;
  source: string;
  note?: string;
}

export interface VideoAnalyticsAdapter {
  readonly name: string;
  getSnapshot(videoUrl: string, now?: Date): Promise<VideoAnalyticsSnapshot>;
}

/**
 * Extracts a human readable video identifier from a common video platform URL.
 */
export function extractVideoIdentifier(videoUrl: string): string {
  try {
    const url = new URL(videoUrl);
    // YouTube: /watch?v=ID, /shorts/ID, youtu.be/ID
    if (url.hostname.includes("youtu")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      const match = url.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/);
      if (match) return match[1];
    }
    // TikTok: /@user/video/ID
    if (url.hostname.includes("tiktok")) {
      const match = url.pathname.match(/\/video\/(\d+)/);
      if (match) return match[1];
    }
    // Instagram: /p/CODE or /reel/CODE
    if (url.hostname.includes("instagram")) {
      const match = url.pathname.match(/\/(?:p|reel|tv)\/([\w-]+)/);
      if (match) return match[1];
    }
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length > 0 ? `${url.hostname}/${parts[parts.length - 1]}` : url.hostname;
  } catch {
    return videoUrl.slice(0, 64);
  }
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/**
 * Deterministic sandbox analytics simulator.
 *
 * Simulated counters depend only on (videoUrl, now) so tests and dev runs are
 * reproducible: views grow roughly linearly over time, likes follow the views
 * with a small seeded fluctuation. A URL query hook (?simulate=unavailable)
 * requests a "source did not respond" snapshot for that capture. Counter
 * corrections (platform reporting a smaller value than a previous
 * observation) are exercised by tests through a custom injected adapter.
 */
export class MockVideoAnalyticsAdapter implements VideoAnalyticsAdapter {
  readonly name = "MOCK_SANDBOX_ANALYTICS";

  async getSnapshot(videoUrl: string, now: Date = new Date()): Promise<VideoAnalyticsSnapshot> {
    const capturedAt = now.toISOString();
    const seed = hashString(videoUrl);

    try {
      const url = new URL(videoUrl);
      const simulate = url.searchParams.get("simulate");
      if (simulate === "unavailable") {
        return {
          available: false,
          likes: null,
          views: null,
          capturedAt,
          source: this.name,
          note: "Sandbox source did not return metrics for this checkpoint; metrics are unavailable.",
        };
      }
    } catch {
      // ignore parse issues, fall through to deterministic simulation
    }

    const anchorEpochMin = 1_800_000; // shared fixed epoch (about 2023-05)
    const elapsedMin = Math.max(0, now.getTime() / 60000 - anchorEpochMin);
    const viewsPerMin = 40 + (seed % 61); // 40..100
    const targetRatio = 0.02 + ((seed % 37) / 1000); // ~0.02..0.056 like/view

    // Counters integrate the growth RATE over time instead of multiplying a
    // wobble into the (huge) absolute count — this keeps the simulated
    // counters effectively monotonic while still varying the pace over time.
    //   ∫ (1 + a·sin(u/w)) du = t − a·w·(cos(t/w) − 1)
    const viewsIntegral = elapsedMin - 0.05 * 175 * (Math.cos(elapsedMin / 175) - 1);
    const likesIntegral = elapsedMin - 0.05 * 175 * (Math.cos(elapsedMin / 175) - 1) - 0.04 * 90 * (Math.cos(elapsedMin / 90) - 1);

    let views = Math.floor(3500 + viewsPerMin * viewsIntegral);
    let likes = Math.floor(120 + viewsPerMin * targetRatio * likesIntegral);

    return {
      available: true,
      likes,
      views,
      capturedAt,
      source: this.name,
    };
  }
}

/**
 * Honest "no data source" adapter: explicitly reports unavailable metrics
 * instead of fabricating values.
 */
export class UnavailableAnalyticsAdapter implements VideoAnalyticsAdapter {
  readonly name = "NO_APPROVED_ANALYTICS_SOURCE";

  async getSnapshot(_videoUrl: string, now: Date = new Date()): Promise<VideoAnalyticsSnapshot> {
    return {
      available: false,
      likes: null,
      views: null,
      capturedAt: now.toISOString(),
      source: this.name,
      note:
        "No authorized analytics data source is configured. Enable the sandbox adapter or connect an approved source.",
    };
  }
}

export interface ApifyTikTokAnalyticsOptions {
  token?: string;
  timeoutMs?: number;
  maxTotalChargeUsd?: number;
  fetchImpl?: typeof fetch;
}

type ApifyTikTokVideoItem = {
  id?: unknown;
  webVideoUrl?: unknown;
  submittedVideoUrl?: unknown;
  input?: unknown;
  diggCount?: unknown;
  playCount?: unknown;
  shareCount?: unknown;
  error?: unknown;
  errorCode?: unknown;
};

/** True for TikTok video and short-share URLs supported by the scraper. */
export function isTikTokVideoUrl(videoUrl: string): boolean {
  try {
    const url = new URL(videoUrl);
    const isTikTokHost = url.hostname === "tiktok.com" || url.hostname.endsWith(".tiktok.com");
    const isVideoPage = /\/video\/\d+(?:\/|$)/i.test(url.pathname);
    const isShortLink =
      ["vm.tiktok.com", "vt.tiktok.com"].includes(url.hostname) &&
      url.pathname.split("/").filter(Boolean).length > 0;
    const isSharePath = /^\/t\/[^/]+/i.test(url.pathname);
    return (url.protocol === "https:" || url.protocol === "http:") && isTikTokHost && (isVideoPage || isShortLink || isSharePath);
  } catch {
    return false;
  }
}

function unavailableApifySnapshot(capturedAt: string, note: string): VideoAnalyticsSnapshot {
  return {
    available: false,
    likes: null,
    views: null,
    shares: null,
    capturedAt,
    source: "APIFY_TIKTOK_SCRAPER",
    note,
  };
}

function isNonNegativeSafeCounter(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Reads one TikTok post through the documented Clockworks Apify Actor.
 * It requests no related posts, comments, downloads, or AI add-ons, and never
 * returns a made-up count when the API fails or omits a documented counter.
 */
export class ApifyTikTokAnalyticsAdapter implements VideoAnalyticsAdapter {
  readonly name = "APIFY_TIKTOK_SCRAPER";
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly maxTotalChargeUsd: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApifyTikTokAnalyticsOptions = {}) {
    this.token = (options.token ?? process.env.APIFY_API_TOKEN ?? "").trim();
    const timeoutFromEnv = Number.parseInt(process.env.APIFY_REQUEST_TIMEOUT_MS || "120000", 10);
    this.timeoutMs = options.timeoutMs ?? (Number.isFinite(timeoutFromEnv) ? Math.min(300000, Math.max(1000, timeoutFromEnv)) : 120000);
    // Apify currently rejects actor runs with a cap below $0.50. Keep this
    // configurable while defaulting to the provider's documented minimum.
    const chargeFromEnv = Number.parseFloat(process.env.APIFY_MAX_RUN_CHARGE_USD || "0.5");
    const requestedChargeCap = options.maxTotalChargeUsd ?? chargeFromEnv;
    this.maxTotalChargeUsd = Number.isFinite(requestedChargeCap) && requestedChargeCap >= 0.5 ? requestedChargeCap : 0.5;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getSnapshot(videoUrl: string, now: Date = new Date()): Promise<VideoAnalyticsSnapshot> {
    const capturedAt = now.toISOString();
    if (!this.token) {
      return unavailableApifySnapshot(capturedAt, "Apify analytics is not configured: APIFY_API_TOKEN is missing.");
    }
    if (!isTikTokVideoUrl(videoUrl)) {
      return unavailableApifySnapshot(capturedAt, "Apify analytics only accepts TikTok video URLs.");
    }

    const endpoint = new URL("https://api.apify.com/v2/actors/clockworks~tiktok-scraper/run-sync-get-dataset-items");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("maxItems", "1");
    endpoint.searchParams.set("maxTotalChargeUsd", String(this.maxTotalChargeUsd));
    endpoint.searchParams.set("timeout", String(Math.min(300, Math.ceil(this.timeoutMs / 1000))));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          postURLs: [videoUrl],
          scrapeRelatedVideos: false,
          scrapeAdditionalAuthorMeta: false,
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
          shouldDownloadSlideshowImages: false,
          shouldDownloadAvatars: false,
          shouldDownloadMusicCovers: false,
          downloadSubtitlesOptions: "NEVER_DOWNLOAD_SUBTITLES",
          aiVideoDescription: false,
          aiVideoSummary: false,
          commentsPerPost: 0,
          topLevelCommentsPerPost: 0,
          maxRepliesPerComment: 0,
          proxyCountryCode: "None",
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        return unavailableApifySnapshot(capturedAt, `Apify analytics request failed (HTTP ${response.status}).`);
      }

      let items: unknown;
      try {
        items = await response.json();
      } catch {
        return unavailableApifySnapshot(capturedAt, "Apify returned an invalid JSON response.");
      }
      if (!Array.isArray(items) || items.length === 0) {
        return unavailableApifySnapshot(capturedAt, "Apify returned no video result for this TikTok URL.");
      }

      const expectedVideoId = extractVideoIdentifier(videoUrl);
      const matchesRequestedVideo = (candidate: ApifyTikTokVideoItem): boolean => {
        const returnedUrls = [candidate.webVideoUrl, candidate.submittedVideoUrl, candidate.input]
          .filter((value): value is string => typeof value === "string");
        return candidate.id === expectedVideoId || returnedUrls.some((url) => extractVideoIdentifier(url) === expectedVideoId);
      };
      const item = /^\d+$/.test(expectedVideoId)
        ? (items as ApifyTikTokVideoItem[]).find((candidate) => candidate && matchesRequestedVideo(candidate))
        : items.length === 1
          ? (items[0] as ApifyTikTokVideoItem)
          : undefined;
      if (!item) {
        return unavailableApifySnapshot(capturedAt, "Apify returned an ambiguous result that did not match the requested TikTok video.");
      }
      if (typeof item.error === "string" || typeof item.errorCode === "string") {
        const errorCode = typeof item.errorCode === "string" ? ` (${item.errorCode.slice(0, 80)})` : "";
        return unavailableApifySnapshot(capturedAt, `Apify could not read this TikTok video${errorCode}.`);
      }
      if (!isNonNegativeSafeCounter(item.diggCount) || !isNonNegativeSafeCounter(item.playCount)) {
        return unavailableApifySnapshot(capturedAt, "Apify's video result is missing valid diggCount or playCount metrics.");
      }

      return {
        available: true,
        likes: item.diggCount,
        views: item.playCount,
        shares: isNonNegativeSafeCounter(item.shareCount) ? item.shareCount : null,
        capturedAt,
        source: this.name,
      };
    } catch (error: unknown) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      return unavailableApifySnapshot(
        capturedAt,
        timedOut ? "Apify analytics request timed out; the previous verified reading is retained." : "Apify analytics could not be reached; the previous verified reading is retained."
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Resolves which analytics adapter to use:
 *  - ANALYTICS_DATA_SOURCE=mock  → sandbox simulation
 *  - ANALYTICS_DATA_SOURCE=apify → real TikTok metrics from Apify
 *  - ANALYTICS_DATA_SOURCE=none  → unavailable metrics
 *  - APIFY_API_TOKEN set: Apify is selected unless explicitly overridden
 *  - unset: sandbox when the SMM provider itself is in mock mode, otherwise
 *    unavailable (never fabricates live-looking metrics without config).
 */
export function resolveAnalyticsAdapter(env: Partial<NodeJS.ProcessEnv> = process.env): VideoAnalyticsAdapter {
  const configured = (env.ANALYTICS_DATA_SOURCE || "").trim().toLowerCase();
  if (configured === "mock") return new MockVideoAnalyticsAdapter();
  if (configured === "none" || configured === "unavailable") return new UnavailableAnalyticsAdapter();
  if (configured === "apify" || configured === "live") {
    return env.APIFY_API_TOKEN?.trim()
      ? new ApifyTikTokAnalyticsAdapter({ token: env.APIFY_API_TOKEN })
      : new UnavailableAnalyticsAdapter();
  }
  if (env.APIFY_API_TOKEN?.trim()) return new ApifyTikTokAnalyticsAdapter({ token: env.APIFY_API_TOKEN });
  const providerIsMock = (env.PROVIDER_IS_MOCK || "").toLowerCase() !== "false";
  return providerIsMock ? new MockVideoAnalyticsAdapter() : new UnavailableAnalyticsAdapter();
}
