import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";
import { z } from "zod";

const batchUpdateSchema = z.object({
  batches: z.array(
    z.object({
      id: z.string().optional(),
      stepNumber: z.number().int().positive(),
      quantity: z.number().int().positive("Batch quantity must be greater than 0"),
      scheduledTime: z.string().optional(),
    })
  ).min(1, "At least one batch must be specified"),
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const parsed = batchUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: params.id }, { orderRef: params.id }],
      },
      include: {
        service: true,
        steps: { orderBy: { stepNumber: "asc" } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    if (session.role !== "ADMIN" && order.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    if (["COMPLETED", "CANCELLED", "FAILED"].includes(order.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot modify batches for an order that is ${order.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    // Identify which steps cannot be modified
    const lockedSteps = order.steps.filter((s) => ["SUBMITTED", "COMPLETED", "PROCESSING"].includes(s.status));
    const lockedStepNumbers = new Set(lockedSteps.map((s) => s.stepNumber));
    const lockedQuantity = lockedSteps.reduce((acc, s) => acc + s.quantity, 0);

    // Validate that no locked batch was modified
    for (const update of parsed.data.batches) {
      if (lockedStepNumbers.has(update.stepNumber)) {
        const existing = lockedSteps.find((s) => s.stepNumber === update.stepNumber);
        if (existing && existing.quantity !== update.quantity) {
          return NextResponse.json(
            {
              success: false,
              error: `Batch #${update.stepNumber} has already been submitted or is currently executing and cannot be modified.`,
            },
            { status: 400 }
          );
        }
      }

      // Check min/max against service rules
      if (update.quantity < order.service.minQuantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Batch #${update.stepNumber} quantity (${update.quantity}) is below provider minimum of ${order.service.minQuantity}.`,
          },
          { status: 400 }
        );
      }
      if (update.quantity > order.service.maxQuantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Batch #${update.stepNumber} quantity (${update.quantity}) exceeds provider maximum of ${order.service.maxQuantity}.`,
          },
          { status: 400 }
        );
      }
    }

    // Check sum consistency
    const totalNewBatchQuantity = parsed.data.batches.reduce((acc, b) => acc + b.quantity, 0);
    if (totalNewBatchQuantity !== order.requestedQuantity) {
      const diff = order.requestedQuantity - totalNewBatchQuantity;
      return NextResponse.json(
        {
          success: false,
          error: `Total quantity of updated batches (${totalNewBatchQuantity.toLocaleString()}) does not match order requested quantity (${order.requestedQuantity.toLocaleString()}). Discrepancy: ${diff > 0 ? `${diff} units unallocated` : `${Math.abs(diff)} units overallocated`}.`,
        },
        { status: 400 }
      );
    }

    // Transactionally update the editable steps
    await prisma.$transaction(async (tx) => {
      for (const batchUpdate of parsed.data.batches) {
        const existingStep = order.steps.find((s) => s.stepNumber === batchUpdate.stepNumber);
        if (!existingStep) continue;

        // Only modify unsubmitted steps
        if (["PENDING", "PAUSED"].includes(existingStep.status)) {
          const updateData: any = {
            quantity: batchUpdate.quantity,
          };
          if (batchUpdate.scheduledTime) {
            updateData.scheduledTime = new Date(batchUpdate.scheduledTime);
          }

          await tx.scheduledDeliveryStep.update({
            where: { id: existingStep.id },
            data: updateData,
          });
        }
      }
    });

    const refreshedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        service: true,
        steps: { orderBy: { stepNumber: "asc" } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "BATCHES_UPDATED",
        actor: "User",
        details: `Updated batches for order ${order.orderRef}.`,
      },
    });

    return NextResponse.json({
      success: true,
      order: refreshedOrder,
      message: "Schedule batches successfully updated.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update batches." },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(request);
    if (!session.authenticated || !session.user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id: params.id }, { orderRef: params.id }],
      },
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    if (session.role !== "ADMIN" && order.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      orderRef: order.orderRef,
      steps: order.steps,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load batches." },
      { status: 500 }
    );
  }
}
