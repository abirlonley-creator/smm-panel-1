import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rawCategories = await prisma.service.findMany({
      where: { active: true },
      select: { category: true },
      distinct: ["category"],
    });

    const categories = rawCategories
      .map((c) => c.category)
      .filter((c) => Boolean(c) && c.toLowerCase() !== "engagement");

    return NextResponse.json({
      success: true,
      categories: ["Engagement", ...categories],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
