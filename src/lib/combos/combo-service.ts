import { prisma } from "../prisma";
import { getActiveProvider } from "../provider/adapter";
import { getPostRequirementError, validateUrlForService } from "../urls/normalizer";
import { resolveTargetUrl } from "../urls/tiktok-resolver";

export interface ComboItemInput {
  serviceId: string;
  defaultQuantity: number;
  targetType?: "SAME_URL" | "CUSTOM_URL";
  customUrl?: string;
  orderIndex?: number;
}

export interface CreateComboInput {
  name: string;
  description?: string;
  items: ComboItemInput[];
  userId?: string;
}

export interface UpdateComboInput {
  name?: string;
  description?: string;
  active?: boolean;
  items?: ComboItemInput[];
}

export interface ExecuteComboInput {
  comboId: string;
  targetUrl?: string;
  targetUrls?: string[];
  orderItems?: {
    url: string;
    serviceId: string;
    quantity: number;
  }[];
  customServiceUrls?: Record<string, string>; // serviceId -> custom URL
  customQuantities?: Record<string, number>; // serviceId -> custom quantity
  scheduledJobId?: string;
  idempotencyToken?: string;
  userId?: string;
}

export interface ComboExecutionResult {
  success: boolean;
  executionId: string;
  executionRef: string;
  status: string;
  totalServices: number;
  successfulServices: number;
  failedServices: number;
  totalCost: number;
  childOrders: {
    orderId: string;
    orderRef: string;
    serviceId: string;
    serviceName: string;
    externalId: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    status: string;
    providerOrderId?: string;
    errorMessage?: string;
  }[];
  error?: string;
}

/**
 * Validates combo items constraints:
 * - 2 to 5 services
 * - Distinct services (no duplicate service IDs within the combo)
 * - Services exist and active
 * - Quantities within bounds
 */
export async function validateComboItems(items: ComboItemInput[]): Promise<void> {
  if (!items || items.length < 2) {
    throw new Error("A combo order must contain at least 2 distinct services.");
  }

  if (items.length > 5) {
    throw new Error("A combo order can contain at most 5 distinct services.");
  }

  const serviceIdSet = new Set<string>();
  for (const item of items) {
    if (serviceIdSet.has(item.serviceId)) {
      throw new Error(`Duplicate service selected in combo. Each service can be included at most once.`);
    }
    serviceIdSet.add(item.serviceId);
  }

  // Verify services exist in DB and respect min/max
  const services = await prisma.service.findMany({
    where: { id: { in: Array.from(serviceIdSet) } },
  });

  if (services.length !== items.length) {
    throw new Error("One or more selected services could not be found in the catalog.");
  }

  for (const item of items) {
    const s = services.find((srv) => srv.id === item.serviceId);
    if (!s) continue;
    if (!s.active) {
      throw new Error(`Service #${s.externalId} (${s.name}) is currently inactive.`);
    }
    if (item.defaultQuantity < s.minQuantity) {
      throw new Error(
        `Quantity for #${s.externalId} (${item.defaultQuantity}) is below minimum allowed (${s.minQuantity.toLocaleString()}).`
      );
    }
    if (item.defaultQuantity > s.maxQuantity) {
      throw new Error(
        `Quantity for #${s.externalId} (${item.defaultQuantity}) exceeds maximum allowed (${s.maxQuantity.toLocaleString()}).`
      );
    }
  }
}

/**
 * Creates a new Combo definition.
 */
export async function createCombo(input: CreateComboInput) {
  const { name, description, items, userId } = input;
  if (!name || name.trim().length === 0) {
    throw new Error("Combo name is required.");
  }

  await validateComboItems(items);

  const comboRef = `CMB-${Math.floor(100000 + Math.random() * 900000)}`;

  const combo = await prisma.$transaction(async (tx) => {
    const newCombo = await tx.combo.create({
      data: {
        comboRef,
        name: name.trim(),
        description: description?.trim() || null,
        active: true,
        userId: userId || null,
      },
    });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await tx.comboItem.create({
        data: {
          comboId: newCombo.id,
          serviceId: item.serviceId,
          defaultQuantity: item.defaultQuantity,
          targetType: item.targetType || "SAME_URL",
          customUrl: item.customUrl || null,
          orderIndex: item.orderIndex ?? i,
        },
      });
    }

    return newCombo;
  });

  return getComboById(combo.id);
}

/**
 * Retrieves a Combo by ID with full item and service details.
 */
export async function getComboById(id: string) {
  return prisma.combo.findUnique({
    where: { id },
    include: {
      items: {
        include: { service: true },
        orderBy: { orderIndex: "asc" },
      },
      _count: { select: { executions: true } },
    },
  });
}

/**
 * Lists all Combos with items and service details.
 */
export async function listCombos(
  activeOnly: boolean = false,
  userId?: string,
  isAdmin: boolean = false
) {
  const where: Record<string, unknown> = {};
  if (activeOnly) where.active = true;
  // Non-admin users only see their own combos
  if (!isAdmin && userId) where.userId = userId;

  return prisma.combo.findMany({
    where,
    include: {
      items: {
        include: { service: true },
        orderBy: { orderIndex: "asc" },
      },
      _count: { select: { executions: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Updates an existing Combo.
 */
export async function updateCombo(id: string, input: UpdateComboInput) {
  const existing = await prisma.combo.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Combo #${id} not found.`);
  }

  if (input.items) {
    await validateComboItems(input.items);
  }

  await prisma.$transaction(async (tx) => {
    if (input.name !== undefined || input.description !== undefined || input.active !== undefined) {
      await tx.combo.update({
        where: { id },
        data: {
          name: input.name !== undefined ? input.name.trim() : undefined,
          description: input.description !== undefined ? input.description?.trim() || null : undefined,
          active: input.active !== undefined ? input.active : undefined,
        },
      });
    }

    if (input.items) {
      await tx.comboItem.deleteMany({ where: { comboId: id } });
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i];
        await tx.comboItem.create({
          data: {
            comboId: id,
            serviceId: item.serviceId,
            defaultQuantity: item.defaultQuantity,
            targetType: item.targetType || "SAME_URL",
            customUrl: item.customUrl || null,
            orderIndex: item.orderIndex ?? i,
          },
        });
      }
    }
  });

  return getComboById(id);
}

/**
 * Duplicates a combo with a new comboRef and cloned items.
 */
export async function duplicateCombo(id: string, userId?: string) {
  const original = await getComboById(id);
  if (!original) {
    throw new Error(`Combo #${id} not found.`);
  }

  const items: ComboItemInput[] = original.items.map((it) => ({
    serviceId: it.serviceId,
    defaultQuantity: it.defaultQuantity,
    targetType: it.targetType as "SAME_URL" | "CUSTOM_URL",
    customUrl: it.customUrl || undefined,
    orderIndex: it.orderIndex,
  }));

  return createCombo({
    name: `${original.name} (Copy)`,
    description: original.description ? `${original.description} (Duplicate)` : undefined,
    items,
    userId: userId || undefined,
  });
}

/**
 * Deletes a combo definition.
 */
export async function deleteCombo(id: string) {
  const existing = await prisma.combo.findUnique({
    where: { id },
    include: { _count: { select: { executions: true } } },
  });

  if (!existing) {
    throw new Error(`Combo #${id} not found.`);
  }

  await prisma.combo.delete({ where: { id } });
  return { success: true, id };
}

// In-flight token set to prevent double-click or retry duplicate combo executions
const inFlightComboTokens = new Set<string>();

/**
 * Executes a Combo: creates parent ComboExecution and child orders for each service.
 */
export async function executeCombo(input: ExecuteComboInput): Promise<ComboExecutionResult> {
  const {
    comboId,
    targetUrl,
    targetUrls,
    orderItems,
    customServiceUrls = {},
    customQuantities = {},
    scheduledJobId,
    idempotencyToken,
    userId,
  } = input;

  if (idempotencyToken) {
    if (inFlightComboTokens.has(idempotencyToken)) {
      throw new Error("This combo execution is already in flight. Please do not submit twice.");
    }
    inFlightComboTokens.add(idempotencyToken);
  }

  try {
  const combo = await getComboById(comboId);
  if (!combo) {
    throw new Error(`Combo #${comboId} not found.`);
  }

  if (!combo.active) {
    throw new Error(`Combo "${combo.name}" is currently disabled.`);
  }

  const primaryTargetUrl =
    targetUrl?.trim() ||
    targetUrls?.[0]?.trim() ||
    orderItems?.[0]?.url?.trim() ||
    "";

  if (!primaryTargetUrl) {
    throw new Error("Target URL is required for combo order.");
  }

  const executionRef = `CMBX-${Math.floor(100000 + Math.random() * 900000)}`;
  const { adapter } = await getActiveProvider(userId);

  // Pre-validate all items before executing
  let totalCost = 0;
  const preparedItems: {
    service: (typeof combo.items)[0]["service"];
    target: string;
    quantity: number;
    unitCost: number;
    itemCost: number;
  }[] = [];

  if (orderItems && orderItems.length > 0) {
    // Mode A: Explicit order items per URL & service (Bulk Add + Randomizer)
    for (const oi of orderItems) {
      const urlNorm = await resolveTargetUrl(oi.url.trim());
      if (!urlNorm.isValid) {
        throw new Error(
          `Invalid target URL for order item: ${oi.url}${urlNorm.error ? ` (${urlNorm.error})` : ""}`
        );
      }

      const matchedItem = combo.items.find((it) => it.serviceId === oi.serviceId);
      const srv = matchedItem
        ? matchedItem.service
        : await prisma.service.findUnique({ where: { id: oi.serviceId } });
      if (!srv) {
        throw new Error(`Service #${oi.serviceId} not found in catalog.`);
      }
      if (!srv.active) {
        throw new Error(`Service #${srv.externalId} is currently disabled.`);
      }

      const compatibility = validateUrlForService(urlNorm.normalizedUrl, srv.platform);
      if (!compatibility.valid) {
        throw new Error(
          `Target URL for #${srv.externalId} (${srv.name}) is incompatible: ${compatibility.reason || srv.platform}`
        );
      }

      const postRequirementError = getPostRequirementError(urlNorm, srv);
      if (postRequirementError) {
        throw new Error(`Target URL for #${srv.externalId} (${srv.name}): ${postRequirementError}`);
      }

      if (oi.quantity < srv.minQuantity || oi.quantity > srv.maxQuantity) {
        throw new Error(
          `Quantity ${oi.quantity} for #${srv.externalId} (${srv.name}) is outside allowed bounds [${srv.minQuantity}, ${srv.maxQuantity}].`
        );
      }
      const unitCost = srv.ratePer1000 / 1000;
      const itemCost = Number(((oi.quantity / 1000) * srv.ratePer1000).toFixed(4));
      totalCost += itemCost;
      preparedItems.push({
        service: srv,
        target: urlNorm.normalizedUrl,
        quantity: oi.quantity,
        unitCost,
        itemCost,
      });
    }
  } else if (targetUrls && targetUrls.length > 0) {
    // Mode B: Multiple URLs with combo services
    for (const u of targetUrls) {
      const trimmedUrl = u.trim();
      if (!trimmedUrl) continue;
      for (const item of combo.items) {
        const srv = item.service;
        const finalUrl =
          item.targetType === "CUSTOM_URL" && item.customUrl
            ? item.customUrl
            : customServiceUrls[srv.id] || trimmedUrl;

        const finalQty =
          customQuantities[srv.id] && customQuantities[srv.id] > 0
            ? customQuantities[srv.id]
            : item.defaultQuantity;

        const resolvedTarget = await resolveTargetUrl(finalUrl);
        if (!resolvedTarget.isValid) {
          throw new Error(
            `Invalid target URL for #${srv.externalId} (${srv.name}): ${resolvedTarget.error || finalUrl}`
          );
        }

        const compatibility = validateUrlForService(resolvedTarget.normalizedUrl, srv.platform);
        if (!compatibility.valid) {
          throw new Error(
            `Target URL for #${srv.externalId} (${srv.name}) is incompatible: ${compatibility.reason || srv.platform}`
          );
        }

        const postRequirementError = getPostRequirementError(resolvedTarget, srv);
        if (postRequirementError) {
          throw new Error(`Target URL for #${srv.externalId} (${srv.name}): ${postRequirementError}`);
        }

        if (finalQty < srv.minQuantity || finalQty > srv.maxQuantity) {
          throw new Error(
            `Quantity ${finalQty} for #${srv.externalId} (${srv.name}) is outside allowed bounds [${srv.minQuantity}, ${srv.maxQuantity}].`
          );
        }

        const unitCost = srv.ratePer1000 / 1000;
        const itemCost = Number(((finalQty / 1000) * srv.ratePer1000).toFixed(4));
        totalCost += itemCost;

        preparedItems.push({
          service: srv,
          target: resolvedTarget.normalizedUrl,
          quantity: finalQty,
          unitCost,
          itemCost,
        });
      }
    }
  } else {
    // Mode C: Single target URL (legacy standard)
    for (const item of combo.items) {
      const srv = item.service;
      const finalUrl =
        item.targetType === "CUSTOM_URL" && item.customUrl
          ? item.customUrl
          : customServiceUrls[srv.id] || primaryTargetUrl;

      const finalQty =
        customQuantities[srv.id] && customQuantities[srv.id] > 0
          ? customQuantities[srv.id]
          : item.defaultQuantity;

      const resolvedTarget = await resolveTargetUrl(finalUrl);
      if (!resolvedTarget.isValid) {
        throw new Error(
          `Invalid target URL for #${srv.externalId} (${srv.name}): ${resolvedTarget.error || finalUrl}`
        );
      }

      const compatibility = validateUrlForService(resolvedTarget.normalizedUrl, srv.platform);
      if (!compatibility.valid) {
        throw new Error(
          `Target URL for #${srv.externalId} (${srv.name}) is incompatible: ${compatibility.reason || srv.platform}`
        );
      }

      const postRequirementError = getPostRequirementError(resolvedTarget, srv);
      if (postRequirementError) {
        throw new Error(`Target URL for #${srv.externalId} (${srv.name}): ${postRequirementError}`);
      }

      if (finalQty < srv.minQuantity || finalQty > srv.maxQuantity) {
        throw new Error(
          `Quantity ${finalQty} for #${srv.externalId} (${srv.name}) is outside allowed bounds [${srv.minQuantity}, ${srv.maxQuantity}].`
        );
      }

      const unitCost = srv.ratePer1000 / 1000;
      const itemCost = Number(((finalQty / 1000) * srv.ratePer1000).toFixed(4));
      totalCost += itemCost;

      preparedItems.push({
        service: srv,
        target: resolvedTarget.normalizedUrl,
        quantity: finalQty,
        unitCost,
        itemCost,
      });
    }
  }

  if (preparedItems.length === 0) {
    throw new Error("No valid orders could be generated for execution.");
  }

  // Create Parent ComboExecution Record
  const execution = await prisma.comboExecution.create({
    data: {
      executionRef,
      comboId: combo.id,
      targetUrl: primaryTargetUrl,
      status: "PROCESSING",
      totalCost: Number(totalCost.toFixed(4)),
      totalServices: preparedItems.length,
      successfulServices: 0,
      failedServices: 0,
      userId: userId || null,
    },
  });

  const childOrdersResult: ComboExecutionResult["childOrders"] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const item of preparedItems) {
    const orderRef = `SMM-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      // Submit child order to provider
      const providerRes = await adapter.createOrder({
        serviceExternalId: item.service.externalId,
        targetUrl: item.target,
        quantity: item.quantity,
      });

      if (providerRes.success && providerRes.providerOrderId) {
        successCount++;
        const childOrder = await prisma.order.create({
          data: {
            orderRef,
            serviceId: item.service.id,
            targetUrl: item.target,
            requestedQuantity: item.quantity,
            submittedQuantity: item.quantity,
            deliveredQuantity: 0,
            remainingQuantity: item.quantity,
            failedQuantity: 0,
            unitCost: item.unitCost,
            totalCost: item.itemCost,
            isScheduled: Boolean(scheduledJobId),
            scheduleMode: "INSTANT",
            status: "PROCESSING",
            providerOrderId: providerRes.providerOrderId,
            comboExecutionId: execution.id,
            scheduledJobId: scheduledJobId || null,
            userId: userId || null,
          },
        });

        childOrdersResult.push({
          orderId: childOrder.id,
          orderRef,
          serviceId: item.service.id,
          serviceName: item.service.name,
          externalId: item.service.externalId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.itemCost,
          status: "PROCESSING",
          providerOrderId: providerRes.providerOrderId,
        });
      } else {
        failedCount++;
        const errMsg = providerRes.error || "Provider rejected order placement";
        const childOrder = await prisma.order.create({
          data: {
            orderRef,
            serviceId: item.service.id,
            targetUrl: item.target,
            requestedQuantity: item.quantity,
            submittedQuantity: 0,
            deliveredQuantity: 0,
            remainingQuantity: item.quantity,
            failedQuantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.itemCost,
            isScheduled: Boolean(scheduledJobId),
            scheduleMode: "INSTANT",
            status: "FAILED",
            errorMessage: errMsg,
            comboExecutionId: execution.id,
            scheduledJobId: scheduledJobId || null,
            userId: userId || null,
          },
        });

        childOrdersResult.push({
          orderId: childOrder.id,
          orderRef,
          serviceId: item.service.id,
          serviceName: item.service.name,
          externalId: item.service.externalId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.itemCost,
          status: "FAILED",
          errorMessage: errMsg,
        });
      }
    } catch (err: unknown) {
      failedCount++;
      const errMsg = err instanceof Error ? err.message : String(err);
      const childOrder = await prisma.order.create({
        data: {
          orderRef,
          serviceId: item.service.id,
          targetUrl: item.target,
          requestedQuantity: item.quantity,
          submittedQuantity: 0,
          deliveredQuantity: 0,
          remainingQuantity: item.quantity,
          failedQuantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.itemCost,
          isScheduled: Boolean(scheduledJobId),
          scheduleMode: "INSTANT",
          status: "FAILED",
          errorMessage: errMsg,
          comboExecutionId: execution.id,
          scheduledJobId: scheduledJobId || null,
          userId: userId || null,
        },
      });

      childOrdersResult.push({
        orderId: childOrder.id,
        orderRef,
        serviceId: item.service.id,
        serviceName: item.service.name,
        externalId: item.service.externalId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.itemCost,
        status: "FAILED",
        errorMessage: errMsg,
      });
    }
  }

  const finalStatus =
    failedCount === 0 ? "COMPLETED" : successCount > 0 ? "PARTIAL" : "FAILED";

  await prisma.comboExecution.update({
    where: { id: execution.id },
    data: {
      status: finalStatus,
      successfulServices: successCount,
      failedServices: failedCount,
      completedAt: finalStatus === "COMPLETED" ? new Date() : null,
      errorMessage: failedCount > 0 ? `${failedCount} of ${preparedItems.length} child orders failed.` : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "COMBO_EXECUTED",
      actor: "Customer",
      details: `Combo "${combo.name}" (${executionRef}) executed: ${successCount}/${preparedItems.length} services submitted (${finalStatus})`,
    },
  });

  return {
    success: successCount > 0,
    executionId: execution.id,
    executionRef,
    status: finalStatus,
    totalServices: preparedItems.length,
    successfulServices: successCount,
    failedServices: failedCount,
    totalCost: Number(totalCost.toFixed(4)),
    childOrders: childOrdersResult,
  };
  } finally {
    if (idempotencyToken) {
      setTimeout(() => inFlightComboTokens.delete(idempotencyToken), 5000);
    }
  }
}

/**
 * Retries ONLY failed child orders of a combo execution without duplicating accepted orders.
 */
export async function retryFailedComboChildOrders(executionId: string) {
  const execution = await prisma.comboExecution.findUnique({
    where: { id: executionId },
    include: {
      orders: {
        include: { service: true },
      },
    },
  });

  if (!execution) {
    throw new Error(`Combo execution #${executionId} not found.`);
  }

  // Find strictly failed child orders (where provider has NOT accepted the order)
  const failedOrders = execution.orders.filter(
    (o) => o.status === "FAILED" && !o.providerOrderId
  );

  if (failedOrders.length === 0) {
    return {
      message: "No unaccepted failed child orders to retry.",
      retriedCount: 0,
      execution,
    };
  }

  const { adapter } = await getActiveProvider();
  let newlySucceeded = 0;

  for (const child of failedOrders) {
    try {
      const res = await adapter.createOrder({
        serviceExternalId: child.service.externalId,
        targetUrl: child.targetUrl,
        quantity: child.requestedQuantity,
      });

      if (res.success && res.providerOrderId) {
        newlySucceeded++;
        await prisma.order.update({
          where: { id: child.id },
          data: {
            status: "PROCESSING",
            submittedQuantity: child.requestedQuantity,
            remainingQuantity: child.requestedQuantity,
            failedQuantity: 0,
            providerOrderId: res.providerOrderId,
            errorMessage: null,
            updatedAt: new Date(),
          },
        });
      }
    } catch (err: unknown) {
      console.warn(`Retry failed for child order ${child.orderRef}:`, err);
    }
  }

  // Re-calculate aggregate execution status
  const refreshed = await prisma.comboExecution.findUnique({
    where: { id: executionId },
    include: { orders: true },
  });

  if (refreshed) {
    const successTotal = refreshed.orders.filter((o) => o.status !== "FAILED").length;
    const failedTotal = refreshed.orders.filter((o) => o.status === "FAILED").length;
    const newStatus =
      failedTotal === 0 ? "COMPLETED" : successTotal > 0 ? "PARTIAL" : "FAILED";

    await prisma.comboExecution.update({
      where: { id: executionId },
      data: {
        status: newStatus,
        successfulServices: successTotal,
        failedServices: failedTotal,
        completedAt: newStatus === "COMPLETED" ? new Date() : null,
      },
    });
  }

  return {
    success: true,
    retriedCount: failedOrders.length,
    newlySucceeded,
  };
}

/**
 * Lists combo execution history with child order details.
 */
export async function listComboExecutions(
  limit: number = 20,
  userId?: string,
  isAdmin: boolean = false
) {
  const where: Record<string, unknown> = {};
  // Non-admin users only see their own executions
  if (!isAdmin && userId) where.userId = userId;

  return prisma.comboExecution.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      combo: true,
      orders: {
        include: { service: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
