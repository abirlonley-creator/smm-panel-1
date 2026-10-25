/**
 * Error Classifier for AuraSMM SMM Provider Interactions
 * Categorizes upstream and runtime errors into standard error types.
 */

export type SMMErrorType =
  | "timeout"
  | "invalid_key"
  | "insufficient_funds"
  | "service_not_found"
  | "rate_limit"
  | "link_rejected"
  | "dns_tls"
  | "unknown";

export interface ClassifiedError {
  errorType: SMMErrorType;
  httpStatus: number;
  plainLanguage: string;
  isFatal: boolean;
  suggestedAction: string;
}

export function classifyProviderError(err: string | Error | any, httpStatus?: number): ClassifiedError {
  const errMsg = typeof err === "string" ? err : err?.message || String(err || "");
  const lower = errMsg.toLowerCase();

  // 1. Timeout
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("abort") || lower.includes("etimedout")) {
    return {
      errorType: "timeout",
      httpStatus: httpStatus || 504,
      plainLanguage: "Provider API timed out before responding to order dispatch.",
      isFatal: false,
      suggestedAction: "Worker will automatically retry with exponential backoff.",
    };
  }

  // 2. DNS / TLS Connection Issues
  if (lower.includes("enotfound") || lower.includes("econnrefused") || lower.includes("econnreset") || lower.includes("tls") || lower.includes("cert") || lower.includes("ssl")) {
    return {
      errorType: "dns_tls",
      httpStatus: httpStatus || 502,
      plainLanguage: "Network or TLS handshake failure connecting to provider endpoint.",
      isFatal: false,
      suggestedAction: "Verify provider API URL and SSL certificates in Provider settings.",
    };
  }

  // 3. Invalid API Key
  if (
    lower.includes("api key") ||
    lower.includes("apikey") ||
    lower.includes("incorrect api") ||
    lower.includes("invalid key") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication failed") ||
    httpStatus === 401 ||
    httpStatus === 403
  ) {
    return {
      errorType: "invalid_key",
      httpStatus: httpStatus || 401,
      plainLanguage: "Provider rejected request due to an invalid or revoked API key.",
      isFatal: true,
      suggestedAction: "Update API credentials in Admin / User Provider Manager.",
    };
  }

  // 4. Insufficient Provider Balance
  if (
    lower.includes("not enough balance") ||
    lower.includes("insufficient balance") ||
    lower.includes("low balance") ||
    lower.includes("not enough funds") ||
    lower.includes("balance too low")
  ) {
    return {
      errorType: "insufficient_funds",
      httpStatus: httpStatus || 402,
      plainLanguage: "Upstream provider account has insufficient funds to fulfill this batch.",
      isFatal: false,
      suggestedAction: "Recharge provider account balance to resume deliveries.",
    };
  }

  // 5. Service Not Found or Disabled
  if (
    lower.includes("service not found") ||
    lower.includes("service inactive") ||
    lower.includes("service disabled") ||
    lower.includes("service is disabled") ||
    lower.includes("invalid service")
  ) {
    return {
      errorType: "service_not_found",
      httpStatus: httpStatus || 404,
      plainLanguage: "Service ID does not exist or has been disabled by upstream provider.",
      isFatal: true,
      suggestedAction: "Remap service to an active service ID in Platform Settings.",
    };
  }

  // 6. Rate Limit
  if (lower.includes("rate limit") || lower.includes("too many requests") || httpStatus === 429) {
    return {
      errorType: "rate_limit",
      httpStatus: httpStatus || 429,
      plainLanguage: "Provider rate limit reached. Pausing dispatches to respect limits.",
      isFatal: false,
      suggestedAction: "System is automatically throttling and backing off calls.",
    };
  }

  // 7. Link / Target URL Rejected
  if (
    lower.includes("invalid link") ||
    lower.includes("link rejected") ||
    (lower.includes("link") && lower.includes("rejected")) ||
    lower.includes("link format") ||
    lower.includes("link is private") ||
    lower.includes("link not found") ||
    lower.includes("invalid url") ||
    lower.includes("bad link")
  ) {
    return {
      errorType: "link_rejected",
      httpStatus: httpStatus || 400,
      plainLanguage: "Target URL was rejected by provider (e.g. account is private or post deleted).",
      isFatal: true,
      suggestedAction: "Check target URL accessibility or cancel remaining batches with refund.",
    };
  }

  // 8. Unknown / Generic
  return {
    errorType: "unknown",
    httpStatus: httpStatus || 500,
    plainLanguage: errMsg || "Provider returned an unclassified error during order creation.",
    isFatal: false,
    suggestedAction: "Inspect sanitized provider response in alert details.",
  };
}
