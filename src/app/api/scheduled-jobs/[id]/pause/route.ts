import { NextResponse } from "next/server";
import { pauseScheduledJob } from "@/lib/scheduler/job-runner";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const job = await pauseScheduledJob(params.id);
    return NextResponse.json({ success: true, job });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}
