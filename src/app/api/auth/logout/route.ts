import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, ADMIN_COOKIE_NAME } from "@/lib/auth/session";
import { invalidateSession } from "@/lib/auth/passkey-service";

export async function POST() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      await invalidateSession(token);
    }

    // Invalidate cookies
    cookieStore.delete(SESSION_COOKIE_NAME);
    cookieStore.delete(ADMIN_COOKIE_NAME);

    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    // Ensure cache control headers prevent browser back caching
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to log out" },
      { status: 500 }
    );
  }
}
