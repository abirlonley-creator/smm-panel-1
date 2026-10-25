import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // 1. Get or create user preference
    let pref = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      pref = await prisma.userPreference.create({
        data: {
          userId,
          onlyFavourites: false,
        },
      });
    }

    // 2. Get current favourites
    const currentFavourites = await prisma.favourite.findMany({
      where: { userId },
      include: { service: true },
    });

    const currentKeyMap = new Map<string, any>();
    for (const f of currentFavourites) {
      const key = `${f.providerId}:${f.providerServiceId}`;
      currentKeyMap.set(key, f);
    }
    const currentKeys = Array.from(currentKeyMap.keys());

    // 3. Get snapshot
    const snapshot = await prisma.favouritesSnapshot.findUnique({
      where: { userId },
    });

    let snapshotKeys: string[] = [];
    if (snapshot?.serviceKeys) {
      try {
        snapshotKeys = JSON.parse(snapshot.serviceKeys);
      } catch {
        snapshotKeys = [];
      }
    }

    // 4. Calculate diff between current favourites and confirmed snapshot
    const snapshotKeySet = new Set(snapshotKeys);
    const currentKeySet = new Set(currentKeys);

    const addedKeys = currentKeys.filter((k) => !snapshotKeySet.has(k));
    const removedKeys = snapshotKeys.filter((k) => !currentKeySet.has(k));

    // Resolve details for added and removed items
    const addedDetails = addedKeys.map((k) => {
      const fav = currentKeyMap.get(k);
      return {
        key: k,
        providerId: fav?.providerId,
        providerServiceId: fav?.providerServiceId,
        name: fav?.service?.name || `Service #${fav?.providerServiceId}`,
        platform: fav?.service?.platform || "Unknown",
      };
    });

    const removedDetails: any[] = [];
    if (removedKeys.length > 0) {
      // Look up services for removed keys
      for (const k of removedKeys) {
        const [pId, pSrvId] = k.split(":");
        removedDetails.push({
          key: k,
          providerId: pId,
          providerServiceId: pSrvId,
          name: `Service #${pSrvId}`,
          platform: "Removed",
        });
      }
    }

    const hasDiff = snapshot ? addedKeys.length > 0 || removedKeys.length > 0 : currentKeys.length > 0;

    return NextResponse.json({
      success: true,
      onlyFavourites: pref.onlyFavourites,
      activeProviderId: pref.activeProviderId,
      snapshotConfirmedAt: snapshot?.confirmedAt || null,
      snapshotCount: snapshotKeys.length,
      currentCount: currentKeys.length,
      hasSnapshot: Boolean(snapshot),
      hasDiff,
      diff: {
        addedCount: addedKeys.length,
        removedCount: removedKeys.length,
        added: addedKeys,
        removed: removedKeys,
        addedDetails,
        removedDetails,
      },
      snapshotKeys,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAuthSession(request);
  if (!session.authenticated || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await request.json();
    const { onlyFavourites, activeProviderId, action } = body;

    // 1. Handle snapshot confirmation
    if (action === "confirmSnapshot") {
      const currentFavourites = await prisma.favourite.findMany({
        where: { userId },
      });
      const currentKeys = currentFavourites.map((f) => `${f.providerId}:${f.providerServiceId}`);

      await prisma.favouritesSnapshot.upsert({
        where: { userId },
        create: {
          userId,
          serviceKeys: JSON.stringify(currentKeys),
          serviceCount: currentKeys.length,
          confirmedAt: new Date(),
        },
        update: {
          serviceKeys: JSON.stringify(currentKeys),
          serviceCount: currentKeys.length,
          confirmedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Favourites snapshot updated and applied successfully",
        serviceCount: currentKeys.length,
      });
    }

    // 2. Handle toggling onlyFavourites
    const updateData: any = {};
    if (typeof onlyFavourites === "boolean") {
      updateData.onlyFavourites = onlyFavourites;

      // If turning ON and no snapshot exists, create one from current favourites
      if (onlyFavourites) {
        const existingSnapshot = await prisma.favouritesSnapshot.findUnique({
          where: { userId },
        });

        if (!existingSnapshot) {
          const currentFavourites = await prisma.favourite.findMany({
            where: { userId },
          });
          const currentKeys = currentFavourites.map((f) => `${f.providerId}:${f.providerServiceId}`);

          await prisma.favouritesSnapshot.create({
            data: {
              userId,
              serviceKeys: JSON.stringify(currentKeys),
              serviceCount: currentKeys.length,
              confirmedAt: new Date(),
            },
          });
        }
      }
    }

    if (activeProviderId !== undefined) {
      updateData.activeProviderId = activeProviderId || null;
    }

    const updatedPref = await prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        onlyFavourites: updateData.onlyFavourites ?? false,
        activeProviderId: updateData.activeProviderId || null,
      },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      preferences: updatedPref,
      message: "Preferences updated successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
