import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import {
  createPasskey,
  renewPasskey,
  revokePasskey,
  togglePasskeyStatus,
  deletePasskey,
} from "@/lib/auth/passkey-service";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createPasskeySchema = z.object({
  label: z.string().min(2, "Label must be at least 2 characters").max(60),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
  durationDays: z.number().int().positive().nullable().optional(),
  customExpiresAt: z.string().nullable().optional(),
  customKey: z.string().min(4).max(100).optional(),
  username: z.string().min(2).max(40).optional(),
});

const patchPasskeySchema = z.object({
  id: z.string().min(1, "Passkey ID is required"),
  action: z.enum(["renew", "revoke", "disable", "enable"]),
  additionalDays: z.number().int().positive().optional(),
});

export async function GET(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const passkeys = await prisma.passkey.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const formatted = passkeys.map((pk) => {
      let remainingDays: number | null = null;
      let remainingHours: number | null = null;
      let isExpired = false;

      if (pk.expiresAt) {
        if (pk.expiresAt < now) {
          isExpired = true;
        } else {
          const diffMs = pk.expiresAt.getTime() - now.getTime();
          remainingDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
          remainingHours = Math.floor(diffMs / (60 * 60 * 1000));
        }
      }

      return {
        id: pk.id,
        label: pk.label,
        keyPrefix: pk.keyPrefix,
        role: pk.role,
        status: isExpired && pk.status === "ACTIVE" ? "EXPIRED" : pk.status,
        durationDays: pk.durationDays,
        expiresAt: pk.expiresAt,
        remainingDays,
        remainingHours,
        isExpired,
        lastUsedAt: pk.lastUsedAt,
        createdAt: pk.createdAt,
        user: pk.user,
      };
    });

    return NextResponse.json({ success: true, keys: formatted });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to retrieve passkeys" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createPasskeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { label, role, durationDays, customExpiresAt, customKey, username } = parsed.data;

    const result = await createPasskey({
      label,
      role,
      durationDays: durationDays || null,
      customExpiresAt: customExpiresAt || null,
      customKey,
      username,
      actor: session.label || "Admin",
    });

    return NextResponse.json({
      success: true,
      key: {
        id: result.id,
        label: result.label,
        prefix: result.prefix,
        role: result.role,
        durationDays: result.durationDays,
        expiresAt: result.expiresAt,
        user: result.user,
        // Secret key revealed ONLY once upon creation!
        secretKey: result.rawKey,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate passkey" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = patchPasskeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { id, action, additionalDays = 30 } = parsed.data;
    const actor = session.label || "Admin";

    if (action === "renew") {
      const renewed = await renewPasskey(id, additionalDays, actor);
      return NextResponse.json({
        success: true,
        message: `Passkey renewed successfully (+${additionalDays} days).`,
        newExpiresAt: renewed.newExpiresAt,
      });
    }

    if (action === "revoke") {
      await revokePasskey(id, actor);
      return NextResponse.json({ success: true, message: "Passkey revoked immediately." });
    }

    if (action === "disable") {
      await togglePasskeyStatus(id, "DISABLED", actor);
      return NextResponse.json({ success: true, message: "Passkey disabled." });
    }

    if (action === "enable") {
      await togglePasskeyStatus(id, "ACTIVE", actor);
      return NextResponse.json({ success: true, message: "Passkey activated." });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Action failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession(request);
  if (!session.authenticated) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Passkey ID is required" }, { status: 400 });
    }

    await deletePasskey(id, session.label || "Admin");

    return NextResponse.json({ success: true, message: "Passkey deleted safely." });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete passkey" },
      { status: 400 }
    );
  }
}
