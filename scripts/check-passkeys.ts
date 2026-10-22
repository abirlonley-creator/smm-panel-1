import { prisma } from "../src/lib/prisma";
import { createHash } from "crypto";

async function main() {
  const keys = await prisma.passkey.findMany({
    include: { user: { select: { id: true, role: true } } },
  });

  console.log(`Total passkeys found: ${keys.length}`);
  console.log(
    JSON.stringify(
      keys.map((k) => ({
        id: k.id,
        label: k.label,
        keyPrefix: k.keyPrefix,
        role: k.role,
        status: k.status,
        expiresAt: k.expiresAt,
        isExpired: k.expiresAt ? k.expiresAt < new Date() : false,
        createdAt: k.createdAt,
        userId: k.userId,
        userRole: k.user?.role,
      })),
      null,
      2
    )
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
