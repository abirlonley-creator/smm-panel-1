import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelScheduledJob, editScheduledJobTime } from "@/lib/scheduler/job-runner";
import { getAuthSession } from "@/lib/auth/session";
import { z } from "zod";

const editTimeSchema = z.object({
  scheduledFor: z.string().datetime({ message: "scheduledFor must be a valid ISO 8601 UTC date string" }),
});

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const job = await prisma.scheduledOrderJob.findUnique({
      where: { id: params.id },
      include: {
        orders: {
          include: { service: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ success: false, error: "Scheduled job not found" }, { status: 404 });
    }

    if (session.role !== "ADMIN" && job.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Scheduled job not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, job });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const job = await prisma.scheduledOrderJob.findUnique({
      where: { id: params.id },
    });
    if (!job) {
      return NextResponse.json({ success: false, error: "Scheduled job not found" }, { status: 404 });
    }
    if (session.role !== "ADMIN" && job.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Scheduled job not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = editTimeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const updated = await editScheduledJobTime(params.id, parsed.data.scheduledFor);
    return NextResponse.json({ success: true, job: updated });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const job = await prisma.scheduledOrderJob.findUnique({
      where: { id: params.id },
    });
    if (!job) {
      return NextResponse.json({ success: false, error: "Scheduled job not found" }, { status: 404 });
    }
    if (session.role !== "ADMIN" && job.userId !== session.user.id) {
      return NextResponse.json({ success: false, error: "Scheduled job not found" }, { status: 404 });
    }

    const cancelled = await cancelScheduledJob(params.id);
    return NextResponse.json({ success: true, job: cancelled });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 400 });
  }
}
