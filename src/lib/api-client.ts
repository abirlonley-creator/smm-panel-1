/**
 * Centralized API Client for AuraSMM
 * Configured via NEXT_PUBLIC_API_BASE_URL or falls back to relative paths for unified Next.js deployments.
 */

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export interface ApiClientOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

export function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  let url = getApiUrl(endpoint);
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }
  return url;
}

export async function apiClient<T = any>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<ApiResponse<T>> {
  const { params, headers, ...restOptions } = options;
  const url = buildUrl(endpoint, params);

  try {
    const res = await fetch(url, {
      ...restOptions,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });

    let json: any = null;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      json = await res.json();
    } else {
      const text = await res.text();
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text };
      }
    }

    if (!res.ok) {
      return {
        success: false,
        error: json?.error || json?.message || `Request failed with status ${res.status}`,
        status: res.status,
      };
    }

    return {
      success: true,
      data: json,
      status: res.status,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Network error: Unable to connect to backend",
      status: 0,
    };
  }
}

(apiClient as any).buildUrl = buildUrl;
(apiClient as any).getApiUrl = getApiUrl;
