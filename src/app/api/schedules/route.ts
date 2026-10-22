import { NextResponse } from "next/server";
import { POST as ordersPost, GET as ordersGet } from "@/app/api/orders/route";

/**
 * Endpoint: POST /api/schedules
 * Dedicated schedule submission endpoint. Transactionally validates, stores, and confirms scheduled growth plans.
 */
export async function POST(request: Request) {
  return ordersPost(request);
}

/**
 * Endpoint: GET /api/schedules
 * Returns scheduled orders with their persistent batches.
 */
export async function GET(request: Request) {
  return ordersGet(request);
}
