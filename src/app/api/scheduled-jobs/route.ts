import { NextResponse } from "next/server";
import { scheduleOrderJob, listScheduledJobs } from "@/lib/scheduler/job-runner";
import { getAuthSession } from "@/lib/auth/session";
import { z } from "zod";

const scheduleJobSchema = z.object({
  jobType: z.enum(["SINGLE", "BULK", "COMBO"]),
  scheduledFor: z.string().datetime({ message: "scheduledFor must be a valid ISO 8601 UTC date string" }),
  timezone: z.string().optional().default("UTC"),
  payload: z.record(z.string(), z.any()),
});

export async function GET(request: Request) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);

    const result = await listScheduledJobs({
      status,
      limit,
      skip,
      userId: session.user.id,
      role: session.role,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }
    const body = await request.json();
    const parsed = scheduleJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const job = await scheduleOrderJob({
      jobType: parsed.data.jobType,
      scheduledFor: parsed.data.scheduledFor,
      timezone: parsed.data.timezone,
      payload: parsed.data.payload,
      userId: session?.user?.id,
    });

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}
