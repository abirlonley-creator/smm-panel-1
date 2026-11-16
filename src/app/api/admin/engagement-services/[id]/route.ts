import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idOrNumeric = params.id;
  try {
    const body = await request.json();
    const numId = Number(idOrNumeric);

    const existing = await prisma.service.findFirst({
      where: {
        OR: [
          { id: idOrNumeric },
          ...(isNaN(numId) ? [] : [{ numericId: numId }]),
          { externalId: idOrNumeric },
        ],
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const data: any = {};
    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.platform === "string") data.platform = body.platform.trim();
    if (typeof body.type === "string") data.type = body.type.trim();
    if (typeof body.rate === "number") data.ratePer1000 = body.rate;
    if (typeof body.ratePer1000 === "number") data.ratePer1000 = body.ratePer1000;
    if (typeof body.min === "number") data.minQuantity = body.min;
    if (typeof body.minQuantity === "number") data.minQuantity = body.minQuantity;
    if (typeof body.max === "number") data.maxQuantity = body.max;
    if (typeof body.maxQuantity === "number") data.maxQuantity = body.maxQuantity;
    if (typeof body.active === "boolean") data.active = body.active;
    if (typeof body.description === "string") data.description = body.description.trim();

    const updated = await prisma.service.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({ success: true, service: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idOrNumeric = params.id;
  try {
    const numId = Number(idOrNumeric);
    const existing = await prisma.service.findFirst({
      where: {
        OR: [
          { id: idOrNumeric },
          ...(isNaN(numId) ? [] : [{ numericId: numId }]),
          { externalId: idOrNumeric },
        ],
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    await prisma.service.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ success: true, message: "Service deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
