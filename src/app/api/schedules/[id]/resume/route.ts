import { POST as resumePost } from "@/app/api/orders/[id]/resume/route";

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  return resumePost(request, context);
}
