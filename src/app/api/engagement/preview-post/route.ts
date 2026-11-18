import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { resolveTargetUrl } from "@/lib/urls/tiktok-resolver";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim();

  if (!rawUrl) {
    return NextResponse.json({ success: false, error: "URL is required" }, { status: 400 });
  }

  try {
    // 1. Resolve short links (vt.tiktok.com, vm.tiktok.com) if needed
    let finalUrl = rawUrl;
    if (rawUrl.includes("vt.tiktok.com") || rawUrl.includes("vm.tiktok.com")) {
      try {
        const resolved = await resolveTargetUrl(rawUrl);
        if (resolved?.normalizedUrl) {
          finalUrl = resolved.normalizedUrl;
        }
      } catch (err) {
        // Continue with original url if resolution fails
      }
    }

    // 2. Extract author handle from URL
    const handleMatch = finalUrl.match(/@([^/?#]+)/);
    const authorHandle = handleMatch ? `@${handleMatch[1]}` : "@creator";
    const videoIdMatch = finalUrl.match(/\/video\/(\d+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    // 3. Attempt TikTok public oEmbed lookup
    let oembedData: any = null;
    try {
      const oembedRes = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(finalUrl)}`,
        {
          headers: { "User-Agent": "AuraSMM-Preview/1.0" },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (oembedRes.ok) {
        oembedData = await oembedRes.json();
      }
    } catch {
      // Fallback cleanly on timeout or network block
    }

    return NextResponse.json({
      success: true,
      data: {
        rawUrl,
        finalUrl,
        videoId,
        authorName: oembedData?.author_name ? `@${oembedData.author_name}` : authorHandle,
        authorUrl: oembedData?.author_url || `https://www.tiktok.com/${authorHandle}`,
        title: oembedData?.title || "TikTok Video Post",
        thumbnailUrl: oembedData?.thumbnail_url || null,
        thumbnailWidth: oembedData?.thumbnail_width || 720,
        thumbnailHeight: oembedData?.thumbnail_height || 1280,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err?.message || "Failed to fetch post preview",
    }, { status: 500 });
  }
}
