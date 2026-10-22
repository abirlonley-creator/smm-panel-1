import { NextResponse } from "next/server";
import { POST as calculatePost } from "@/app/api/planner/calculate/route";

/**
 * Endpoint: POST /api/schedules/preview
 * Dedicated schedule validation and preview endpoint conforming to Section 6.
 * Previews and validates a schedule without initiating provider operations.
 */
export async function POST(request: Request) {
  return calculatePost(request);
}
