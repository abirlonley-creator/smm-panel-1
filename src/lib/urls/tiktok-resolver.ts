import { normalizeTargetUrl, NormalizedUrlResult } from "./normalizer";

const TIKTOK_REDIRECT_HOSTS = new Set([
  "tiktok.com",
  "m.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
]);

const DEFAULT_TIMEOUT_MS = 6000;
const DEFAULT_MAX_REDIRECTS = 5;

export interface TikTokResolveOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
}

function normalizeHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

function validateRedirectTarget(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "TikTok returned an invalid redirect URL.";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "TikTok redirected to an unsupported protocol.";
  }

  if (parsed.username || parsed.password) {
    return "TikTok redirected to a URL containing embedded credentials.";
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!TIKTOK_REDIRECT_HOSTS.has(hostname)) {
    return `TikTok redirected to an untrusted host: ${hostname || "unknown"}.`;
  }

  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    return "TikTok redirected to an unsupported port.";
  }

  return null;
}

function unresolved(
  original: NormalizedUrlResult,
  message: string,
  normalizedUrl?: string
): NormalizedUrlResult {
  return {
    ...original,
    normalizedUrl: normalizedUrl || original.normalizedUrl,
    isValid: false,
    error: message,
    isPost: false,
    requiresResolution: false,
  };
}

export function isTikTokShortLink(input: string | NormalizedUrlResult): boolean {
  const normalized = typeof input === "string" ? normalizeTargetUrl(input) : input;
  return normalized.platform === "TikTok" && normalized.requiresResolution;
}

export async function resolveTargetUrl(
  rawUrl: string,
  options: TikTokResolveOptions = {}
): Promise<NormalizedUrlResult> {
  const normalized = normalizeTargetUrl(rawUrl);

  if (!normalized.isValid || !normalized.requiresResolution) {
    return normalized;
  }

  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let currentUrl = normalized.normalizedUrl;

  try {
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
      const unsafeReason = validateRedirectTarget(currentUrl);
      if (unsafeReason) {
        return unresolved(normalized, unsafeReason, currentUrl);
      }

      const response = await fetchImpl(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "AuraSMM-TikTokLinkResolver/1.0",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        if (redirectCount === maxRedirects) {
          try {
            await response.body?.cancel();
          } catch {
            // ignore body cancellation errors
          }
          return unresolved(normalized, "TikTok short link exceeded the redirect limit.", currentUrl);
        }

        const location = response.headers.get("location");
        try {
          await response.body?.cancel();
        } catch {
          // ignore body cancellation errors
        }

        if (!location) {
          return unresolved(normalized, "TikTok short link returned a redirect without a location.", currentUrl);
        }

        let nextUrl: string;
        try {
          nextUrl = new URL(location, currentUrl).toString();
        } catch {
          return unresolved(normalized, "TikTok short link returned an invalid redirect location.", currentUrl);
        }

        const nextUnsafeReason = validateRedirectTarget(nextUrl);
        if (nextUnsafeReason) {
          return unresolved(normalized, nextUnsafeReason, nextUrl);
        }

        const nextNormalized = normalizeTargetUrl(nextUrl);
        if (nextNormalized.isValid && nextNormalized.isPost && !nextNormalized.requiresResolution) {
          return {
            ...nextNormalized,
            rawUrl: normalized.rawUrl,
            requiresResolution: false,
          };
        }

        currentUrl = nextUrl;
        continue;
      }

      try {
        await response.body?.cancel();
      } catch {
        // ignore body cancellation errors
      }

      if (!response.ok) {
        return unresolved(
          normalized,
          `TikTok short link resolution failed (HTTP ${response.status}).`,
          currentUrl
        );
      }

      const resolved = normalizeTargetUrl(currentUrl);
      if (!resolved.isValid) {
        return unresolved(normalized, resolved.error || "TikTok short link resolved to an invalid URL.", currentUrl);
      }

      if (resolved.requiresResolution) {
        return unresolved(
          normalized,
          "TikTok short link did not resolve to a canonical TikTok URL.",
          currentUrl
        );
      }

      return {
        ...resolved,
        rawUrl: normalized.rawUrl,
        requiresResolution: false,
      };
    }

    return unresolved(normalized, "TikTok short link exceeded the redirect limit.", currentUrl);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return unresolved(normalized, "TikTok short link resolution timed out.", currentUrl);
    }

    const message = err instanceof Error ? err.message : String(err);
    return unresolved(normalized, `Unable to resolve TikTok short link: ${message}`, currentUrl);
  } finally {
    clearTimeout(timer);
  }
}
