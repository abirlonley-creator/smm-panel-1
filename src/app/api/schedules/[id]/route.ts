import { NextResponse } from "next/server";
import { GET as orderGet, DELETE as orderDelete } from "@/app/api/orders/[id]/route";

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  return orderGet(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  return orderDelete(request, context);
}
