/**
 * Server-Side Request Forgery (SSRF) Protection Utility.
 * Validates and normalizes upstream SMM provider endpoints before
 * making outbound HTTP requests or saving configurations to the database.
 */

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

/**
 * Checks if an IPv4 address string falls into private, loopback, link-local,
 * or cloud metadata ranges.
 */
function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (Private)
  if (a === 10) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-local & AWS/GCP/Azure/DO Metadata: 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;

  // 100.64.0.0/10 (Carrier-grade NAT: 100.64.0.0 - 100.127.255.255)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && parts[2] === 2) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && parts[2] === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;

  return false;
}

/**
 * Validates a provider endpoint URL for security, protocol compliance,
 * and SSRF risks.
 */
export function validateProviderEndpointUrl(
  inputUrl: string,
  options: { allowMock?: boolean } = {}
): UrlValidationResult {
  const trimmed = (inputUrl || "").trim();
  if (!trimmed) {
    return { valid: false, error: "Provider API URL is required." };
  }

  // Allow explicit mock addresses in development/mock mode
  if (options.allowMock) {
    if (
      trimmed.includes("mock-provider.smm.internal") ||
      trimmed.includes("api.smmprovider.com") ||
      trimmed.includes(".smm.internal") ||
      trimmed.includes(".example.")
    ) {
      return { valid: true, normalizedUrl: trimmed };
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Invalid URL format." };
  }

  // Enforce protocol: https is required for all external providers (http permitted for mock test environments)
  const isHttps = parsed.protocol.toLowerCase() === "https:";
  const isHttp = parsed.protocol.toLowerCase() === "http:";

  if (!isHttps && !isHttp) {
    return {
      valid: false,
      error: `Unsupported protocol "${parsed.protocol}". Provider URL must use HTTPS.`,
    };
  }

  // In production or live connections, require HTTPS
  if (process.env.NODE_ENV === "production" && !isHttps && !options.allowMock) {
    return {
      valid: false,
      error: "Provider URL must use secure HTTPS in production.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block forbidden hostnames
  const forbiddenHostnames = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
    "instance-data",
    "metadata",
  ];

  if (forbiddenHostnames.includes(hostname)) {
    return {
      valid: false,
      error: "Access to loopback, local, or cloud metadata destinations is blocked for security.",
    };
  }

  // Disallow dotless hostnames (e.g. "intranet", "corp") unless mock
  if (!hostname.includes(".") && !options.allowMock) {
    return {
      valid: false,
      error: "Provider hostname must be a fully qualified domain name.",
    };
  }

  // Check IPv4 private/reserved ranges
  if (isPrivateOrReservedIPv4(hostname)) {
    return {
      valid: false,
      error: "Access to private or reserved IP address spaces is blocked for security (SSRF prevention).",
    };
  }

  // Check IPv6 addresses
  if (hostname.startsWith("[") || hostname.includes(":")) {
    const rawIpv6 = hostname.replace(/^\[|\]$/g, "");
    if (
      rawIpv6 === "::1" ||
      rawIpv6.startsWith("fc") ||
      rawIpv6.startsWith("fd") ||
      rawIpv6.startsWith("fe80")
    ) {
      return {
        valid: false,
        error: "Access to private or local IPv6 addresses is blocked for security.",
      };
    }
  }

  // Disallow dangerous or sensitive port numbers
  const forbiddenPorts = [21, 22, 23, 25, 53, 110, 143, 3306, 5432, 6379, 9200, 11211, 27017];
  if (parsed.port) {
    const portNum = parseInt(parsed.port, 10);
    if (forbiddenPorts.includes(portNum)) {
      return {
        valid: false,
        error: `Port ${portNum} is restricted for security.`,
      };
    }
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString().replace(/\/+$/, ""), // strip trailing slashes for uniformity
  };
}
