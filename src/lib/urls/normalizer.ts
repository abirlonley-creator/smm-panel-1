export type UrlContentType =
  | "post"
  | "profile"
  | "hashtag"
  | "sound"
  | "shortlink"
  | "unknown";

export interface NormalizedUrlResult {
  rawUrl: string;
  normalizedUrl: string;
  canonicalKey: string;
  platform: "TikTok" | "Instagram" | "YouTube" | "Twitter" | "Spotify" | "LinkedIn" | "Other";
  contentId: string | null;
  isValid: boolean;
  error?: string;
  contentType: UrlContentType;
  isPost: boolean;
  requiresResolution: boolean;
}

const TIKTOK_HOSTS = new Set([
  "tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

const TRACKING_KEYS = new Set([
  "is_from_webapp",
  "sender_device",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "igshid",
  "si",
  "feature",
  "t",
  "ref",
  "_r",
  "_d",
  "lang",
  "lang_ui",
  "lang_country",
  "enter_from",
]);

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function normalizeHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

function stripTrackingParams(searchParams: URLSearchParams): string {
  const clean = new URLSearchParams();
  searchParams.forEach((val, key) => {
    const lower = key.toLowerCase();
    if (!TRACKING_KEYS.has(lower) && !lower.startsWith("utm_")) {
      clean.append(key, val);
    }
  });
  return clean.toString();
}

export function normalizeTargetUrl(rawInput: string): NormalizedUrlResult {
  const trimmed = (rawInput || "").trim();

  if (!trimmed) {
    return {
      rawUrl: rawInput,
      normalizedUrl: "",
      canonicalKey: "",
      platform: "Other",
      contentId: null,
      isValid: false,
      error: "Empty URL provided",
      contentType: "unknown",
      isPost: false,
      requiresResolution: false,
    };
  }

  let toParse = trimmed;
  if (!/^https?:\/\//i.test(toParse)) {
    toParse = `https://${toParse}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(toParse);
  } catch {
    return {
      rawUrl: trimmed,
      normalizedUrl: trimmed,
      canonicalKey: trimmed.toLowerCase(),
      platform: "Other",
      contentId: null,
      isValid: false,
      error: "Malformed URL syntax",
      contentType: "unknown",
      isPost: false,
      requiresResolution: false,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      rawUrl: trimmed,
      normalizedUrl: trimmed,
      canonicalKey: trimmed.toLowerCase(),
      platform: "Other",
      contentId: null,
      isValid: false,
      error: "Only HTTP and HTTPS links are supported",
      contentType: "unknown",
      isPost: false,
      requiresResolution: false,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      rawUrl: trimmed,
      normalizedUrl: trimmed,
      canonicalKey: trimmed.toLowerCase(),
      platform: "Other",
      contentId: null,
      isValid: false,
      error: "Links with embedded credentials are not allowed",
      contentType: "unknown",
      isPost: false,
      requiresResolution: false,
    };
  }

  const hostname = normalizeHostname(parsed.hostname);
  const pathname = parsed.pathname.replace(/\/+$/, "");

  if (!hostname.includes(".") && hostname !== "localhost") {
    return {
      rawUrl: trimmed,
      normalizedUrl: trimmed,
      canonicalKey: trimmed.toLowerCase(),
      platform: "Other",
      contentId: null,
      isValid: false,
      error: "Malformed URL: missing valid domain extension",
      contentType: "unknown",
      isPost: false,
      requiresResolution: false,
    };
  }

  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(hostname) && hostname !== "localhost") {
    return {
      rawUrl: trimmed,
      normalizedUrl: trimmed,
      canonicalKey: trimmed.toLowerCase(),
      platform: "Other",
      contentId: null,
      isValid: false,
      error: "Malformed URL: invalid domain syntax",
      contentType: "unknown",
      isPost: false,
      requiresResolution: false,
    };
  }

  if (TIKTOK_HOSTS.has(hostname)) {
    return normalizeTikTokUrl(trimmed, parsed, hostname, pathname);
  }

  if (hostMatches(hostname, "instagram.com")) {
    return normalizeInstagramUrl(trimmed, parsed, hostname, pathname);
  }

  if (hostMatches(hostname, "youtube.com") || hostname === "youtu.be") {
    return normalizeYouTubeUrl(trimmed, parsed, hostname, pathname);
  }

  if (hostMatches(hostname, "twitter.com") || hostMatches(hostname, "x.com")) {
    return normalizeTwitterUrl(trimmed, parsed, hostname, pathname);
  }

  if (hostMatches(hostname, "spotify.com")) {
    return normalizeSpotifyUrl(trimmed, parsed, hostname, pathname);
  }

  if (hostMatches(hostname, "linkedin.com")) {
    const cleanSearch = stripTrackingParams(parsed.searchParams);
    const normalized = `https://www.linkedin.com${pathname}${cleanSearch ? `?${cleanSearch}` : ""}`;
    return {
      rawUrl: trimmed,
      normalizedUrl: normalized,
      canonicalKey: normalized.toLowerCase(),
      platform: "LinkedIn",
      contentId: null,
      isValid: true,
      contentType: "unknown",
      isPost: false,
      requiresResolution: false,
    };
  }

  const cleanSearch = stripTrackingParams(parsed.searchParams);
  const normalized = `https://${hostname}${pathname}${cleanSearch ? `?${cleanSearch}` : ""}`;

  return {
    rawUrl: trimmed,
    normalizedUrl: normalized,
    canonicalKey: normalized.toLowerCase(),
    platform: "Other",
    contentId: null,
    isValid: true,
    contentType: "unknown",
    isPost: false,
    requiresResolution: false,
  };
}

function normalizeTikTokUrl(
  rawUrl: string,
  url: URL,
  hostname: string,
  pathname: string
): NormalizedUrlResult {
  const videoMatch = pathname.match(/^\/@([^/]+)\/video\/(\d+)$/i);
  if (videoMatch) {
    const username = videoMatch[1].toLowerCase();
    const videoId = videoMatch[2];
    const normalizedUrl = `https://www.tiktok.com/@${username}/video/${videoId}`;
    return {
      rawUrl,
      normalizedUrl,
      canonicalKey: `tiktok:video:${videoId}`,
      platform: "TikTok",
      contentId: videoId,
      isValid: true,
      contentType: "post",
      isPost: true,
      requiresResolution: false,
    };
  }

  const photoMatch = pathname.match(/^\/@([^/]+)\/photo\/(\d+)$/i);
  if (photoMatch) {
    const username = photoMatch[1].toLowerCase();
    const photoId = photoMatch[2];
    const normalizedUrl = `https://www.tiktok.com/@${username}/photo/${photoId}`;
    return {
      rawUrl,
      normalizedUrl,
      canonicalKey: `tiktok:photo:${photoId}`,
      platform: "TikTok",
      contentId: photoId,
      isValid: true,
      contentType: "post",
      isPost: true,
      requiresResolution: false,
    };
  }

  const embedMatch = pathname.match(/^\/embed(?:\/v\d+)?\/(\d+)$/i);
  if (embedMatch) {
    const videoId = embedMatch[1];
    return {
      rawUrl,
      normalizedUrl: `https://www.tiktok.com/video/${videoId}`,
      canonicalKey: `tiktok:video:${videoId}`,
      platform: "TikTok",
      contentId: videoId,
      isValid: true,
      contentType: "post",
      isPost: true,
      requiresResolution: false,
    };
  }

  if (hostname === "vm.tiktok.com" || hostname === "vt.tiktok.com") {
    const code = pathname.split("/").filter(Boolean)[0] || "";
    if (code) {
      return {
        rawUrl,
        normalizedUrl: `https://${hostname}/${code}`,
        canonicalKey: `tiktok:shortlink:${code.toLowerCase()}`,
        platform: "TikTok",
        contentId: code,
        isValid: true,
        contentType: "shortlink",
        isPost: false,
        requiresResolution: true,
      };
    }
  }

  const shortMatch = pathname.match(/^\/t\/([A-Za-z0-9_-]+)$/i);
  if (shortMatch) {
    const code = shortMatch[1];
    return {
      rawUrl,
      normalizedUrl: `https://www.tiktok.com/t/${code}`,
      canonicalKey: `tiktok:shortlink:${code.toLowerCase()}`,
      platform: "TikTok",
      contentId: code,
      isValid: true,
      contentType: "shortlink",
      isPost: false,
      requiresResolution: true,
    };
  }

  const mobileMatch = pathname.match(/^\/(?:v|video)\/(\d+)(?:\.html)?$/i);
  if (mobileMatch) {
    const videoId = mobileMatch[1];
    return {
      rawUrl,
      normalizedUrl: `https://www.tiktok.com/video/${videoId}`,
      canonicalKey: `tiktok:video:${videoId}`,
      platform: "TikTok",
      contentId: videoId,
      isValid: true,
      contentType: "post",
      isPost: true,
      requiresResolution: false,
    };
  }

  const profileMatch = pathname.match(/^\/@([^/]+)$/i);
  if (profileMatch) {
    const username = profileMatch[1].toLowerCase();
    return {
      rawUrl,
      normalizedUrl: `https://www.tiktok.com/@${username}`,
      canonicalKey: `tiktok:profile:${username}`,
      platform: "TikTok",
      contentId: username,
      isValid: true,
      contentType: "profile",
      isPost: false,
      requiresResolution: false,
    };
  }

  const hashtagMatch = pathname.match(/^\/(?:tag|hashtag)\/([^/]+)$/i);
  if (hashtagMatch) {
    const tag = hashtagMatch[1].toLowerCase();
    return {
      rawUrl,
      normalizedUrl: `https://www.tiktok.com/tag/${tag}`,
      canonicalKey: `tiktok:hashtag:${tag}`,
      platform: "TikTok",
      contentId: tag,
      isValid: true,
      contentType: "hashtag",
      isPost: false,
      requiresResolution: false,
    };
  }

  const soundMatch = pathname.match(/^\/(?:music|sound)\/([^/]+)$/i);
  if (soundMatch) {
    const soundId = soundMatch[1].toLowerCase();
    return {
      rawUrl,
      normalizedUrl: `https://www.tiktok.com/music/${soundId}`,
      canonicalKey: `tiktok:sound:${soundId}`,
      platform: "TikTok",
      contentId: soundId,
      isValid: true,
      contentType: "sound",
      isPost: false,
      requiresResolution: false,
    };
  }

  const cleanSearch = stripTrackingParams(url.searchParams);
  const normalized = `https://www.tiktok.com${pathname}${cleanSearch ? `?${cleanSearch}` : ""}`;
  return {
    rawUrl,
    normalizedUrl: normalized,
    canonicalKey: normalized.toLowerCase(),
    platform: "TikTok",
    contentId: null,
    isValid: true,
    contentType: "unknown",
    isPost: false,
    requiresResolution: false,
  };
}

function normalizeInstagramUrl(
  rawUrl: string,
  url: URL,
  hostname: string,
  pathname: string
): NormalizedUrlResult {
  const postMatch = pathname.match(/\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i);
  if (postMatch) {
    const code = postMatch[1];
    const normalizedUrl = `https://www.instagram.com/p/${code}/`;
    return {
      rawUrl,
      normalizedUrl,
      canonicalKey: `instagram:post:${code}`,
      platform: "Instagram",
      contentId: code,
      isValid: true,
      contentType: "post",
      isPost: true,
      requiresResolution: false,
    };
  }

  const profileMatch = pathname.match(/^\/([a-zA-Z0-9._]+)\/?$/i);
  if (profileMatch && !["explore", "reels", "direct", "accounts"].includes(profileMatch[1].toLowerCase())) {
    const username = profileMatch[1].toLowerCase();
    return {
      rawUrl,
      normalizedUrl: `https://www.instagram.com/${username}/`,
      canonicalKey: `instagram:profile:${username}`,
      platform: "Instagram",
      contentId: username,
      isValid: true,
      contentType: "profile",
      isPost: false,
      requiresResolution: false,
    };
  }

  const cleanSearch = stripTrackingParams(url.searchParams);
  const normalized = `https://www.instagram.com${pathname}${cleanSearch ? `?${cleanSearch}` : ""}`;
  return {
    rawUrl,
    normalizedUrl: normalized,
    canonicalKey: normalized.toLowerCase(),
    platform: "Instagram",
    contentId: null,
    isValid: true,
    contentType: "unknown",
    isPost: false,
    requiresResolution: false,
  };
}

function normalizeYouTubeUrl(
  rawUrl: string,
  url: URL,
  hostname: string,
  pathname: string
): NormalizedUrlResult {
  if (hostname === "youtu.be") {
    const videoId = pathname.replace(/^\/+/, "");
    if (videoId) {
      return {
        rawUrl,
        normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
        canonicalKey: `youtube:video:${videoId}`,
        platform: "YouTube",
        contentId: videoId,
        isValid: true,
        contentType: "post",
        isPost: true,
        requiresResolution: false,
      };
    }
  }

  const vParam = url.searchParams.get("v");
  if (vParam) {
    return {
      rawUrl,
      normalizedUrl: `https://www.youtube.com/watch?v=${vParam}`,
      canonicalKey: `youtube:video:${vParam}`,
      platform: "YouTube",
      contentId: vParam,
      isValid: true,
      contentType: "post",
      isPost: true,
      requiresResolution: false,
    };
  }

  const shortsMatch = pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/i);
  if (shortsMatch) {
    const videoId = shortsMatch[1];
    return {
      rawUrl,
      normalizedUrl: `https://www.youtube.com/shorts/${videoId}`,
      canonicalKey: `youtube:video:${videoId}`,
      platform: "YouTube",
      contentId: videoId,
      isValid: true,
      contentType: "post",
      isPost: true,
      requiresResolution: false,
    };
  }

  const cleanSearch = stripTrackingParams(url.searchParams);
  const normalized = `https://www.youtube.com${pathname}${cleanSearch ? `?${cleanSearch}` : ""}`;
  return {
    rawUrl,
    normalizedUrl: normalized,
    canonicalKey: normalized.toLowerCase(),
    platform: "YouTube",
    contentId: null,
    isValid: true,
    contentType: "unknown",
    isPost: false,
    requiresResolution: false,
  };
}

function normalizeTwitterUrl(
  rawUrl: string,
  url: URL,
  hostname: string,
  pathname: string
): NormalizedUrlResult {
  const tweetMatch = pathname.match(/\/([^/]+)\/status\/(\d+)/i);
  if (tweetMatch) {
    const tweetId = tweetMatch[2];
    return {
      rawUrl,
      normalizedUrl: `https://x.com/${tweetMatch[1].toLowerCase()}/status/${tweetId}`,
      canonicalKey: `twitter:tweet:${tweetId}`,
      platform: "Twitter",
      contentId: tweetId,
      isValid: true,
      contentType: "post",
      isPost: true,
      requiresResolution: false,
    };
  }

  const cleanSearch = stripTrackingParams(url.searchParams);
  const normalized = `https://x.com${pathname}${cleanSearch ? `?${cleanSearch}` : ""}`;
  return {
    rawUrl,
    normalizedUrl: normalized,
    canonicalKey: normalized.toLowerCase(),
    platform: "Twitter",
    contentId: null,
    isValid: true,
    contentType: "unknown",
    isPost: false,
    requiresResolution: false,
  };
}

function normalizeSpotifyUrl(
  rawUrl: string,
  url: URL,
  hostname: string,
  pathname: string
): NormalizedUrlResult {
  const match = pathname.match(/\/(track|album|artist|playlist)\/([a-zA-Z0-9]+)/i);
  if (match) {
    const type = match[1].toLowerCase();
    const id = match[2];
    return {
      rawUrl,
      normalizedUrl: `https://open.spotify.com/${type}/${id}`,
      canonicalKey: `spotify:${type}:${id}`,
      platform: "Spotify",
      contentId: id,
      isValid: true,
      contentType: "post",
      isPost: true,
      requiresResolution: false,
    };
  }

  const normalized = `https://open.spotify.com${pathname}`;
  return {
    rawUrl,
    normalizedUrl: normalized,
    canonicalKey: normalized.toLowerCase(),
    platform: "Spotify",
    contentId: null,
    isValid: true,
    contentType: "unknown",
    isPost: false,
    requiresResolution: false,
  };
}

export interface ServiceUrlCompatibility {
  platform: string;
  category?: string | null;
  name?: string | null;
  restrictions?: string | null;
}

export function serviceRequiresPost(service: ServiceUrlCompatibility): boolean {
  if (!service.platform.toLowerCase().includes("tiktok")) {
    return false;
  }

  const category = (service.category || "").toLowerCase();
  const text = `${category} ${(service.name || "").toLowerCase()} ${(service.restrictions || "").toLowerCase()}`;

  if (/follower|subscriber|profile|account/.test(category)) {
    return false;
  }

  return /(like|view|comment|share|save|favorite|reaction|video|post)/.test(text);
}

export function getPostRequirementError(
  normalized: NormalizedUrlResult,
  service: ServiceUrlCompatibility
): string | null {
  if (!serviceRequiresPost(service) || normalized.platform !== "TikTok") {
    return null;
  }

  if (normalized.requiresResolution) {
    return "TikTok short links must be resolved before validating this order.";
  }

  if (!normalized.isPost) {
    return "A TikTok video or photo post URL is required for this service.";
  }

  return null;
}

export function validateUrlForService(
  url: string,
  servicePlatform: string
): { valid: boolean; reason?: string; normalized: NormalizedUrlResult } {
  const normalized = normalizeTargetUrl(url);

  if (!normalized.isValid) {
    return { valid: false, reason: normalized.error || "Invalid URL format", normalized };
  }

  if (servicePlatform && servicePlatform !== "All" && servicePlatform !== "Other") {
    const platLower = servicePlatform.toLowerCase();
    const urlPlatLower = normalized.platform.toLowerCase();

    const matches =
      (platLower.includes("tiktok") && urlPlatLower === "tiktok") ||
      (platLower.includes("instagram") && urlPlatLower === "instagram") ||
      (platLower.includes("youtube") && urlPlatLower === "youtube") ||
      ((platLower.includes("twitter") || platLower.includes("x")) && urlPlatLower === "twitter") ||
      (platLower.includes("spotify") && urlPlatLower === "spotify") ||
      (platLower.includes("linkedin") && urlPlatLower === "linkedin");

    if (!matches && urlPlatLower !== "other") {
      return {
        valid: false,
        reason: `Service requires a ${servicePlatform} link, but got ${normalized.platform} URL.`,
        normalized,
      };
    }
  }

  return { valid: true, normalized };
}
