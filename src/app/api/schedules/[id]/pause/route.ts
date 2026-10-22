import { POST as pausePost } from "@/app/api/orders/[id]/pause/route";

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  return pausePost(request, context);
}
