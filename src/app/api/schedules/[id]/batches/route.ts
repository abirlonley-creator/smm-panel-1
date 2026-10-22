import { PATCH as batchesPatch, GET as batchesGet } from "@/app/api/orders/[id]/batches/route";

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  return batchesPatch(request, context);
}

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  return batchesGet(request, context);
}
