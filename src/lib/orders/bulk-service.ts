import { prisma } from "../prisma";
import { getActiveProvider } from "../provider/adapter";
import {
  getPostRequirementError,
  normalizeTargetUrl,
  validateUrlForService,
} from "../urls/normalizer";
import { resolveTargetUrl } from "../urls/tiktok-resolver";

export type BulkRowStatus =
  | "VALID"
  | "BATCH_DUPLICATE"
  | "EXISTING_ACTIVE_ORDER"
  | "INVALID_URL"
  | "UNSUPPORTED_LINK"
  | "INVALID_QUANTITY";

export interface ParsedBulkRow {
  index: number;
  lineNumber: number;
  rawUrl: string;
  normalizedUrl: string;
  canonicalKey: string;
  platform: string;
  quantity: number;
  status: BulkRowStatus;
  statusLabel: string;
  canSubmit: boolean;
  errorMessage?: string;
  existingOrderId?: string;
  serviceId?: string;
  serviceExternalId?: string;
  serviceName?: string;
  minQuantity?: number;
  maxQuantity?: number;
  ratePer1000?: number;
}

export interface BulkValidationSummary {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  activeOrderRows: number;
  invalidRows: number;
  readyToSubmitRows: number;
  rows: ParsedBulkRow[];
  totalQuantity: number;
  estimatedCost: number;
}

export interface SubmitBulkOrdersParams {
  serviceId: string;
  rows: {
    rawUrl: string;
    normalizedUrl?: string;
    quantity: number;
  }[];
  idempotencyToken?: string;
  scheduledJobId?: string;
  userId?: string;
}

export interface BulkOrderRowOutcome {
  index: number;
  url: string;
  quantity: number;
  success: boolean;
  orderId?: string;
  orderRef?: string;
  providerOrderId?: string;
  errorMessage?: string;
}

export interface SubmitBulkOrdersResult {
  success: boolean;
  batchId: string;
  batchRef: string;
  totalOrders: number;
  successOrders: number;
  failedOrders: number;
  totalCost: number;
  outcomes: BulkOrderRowOutcome[];
  error?: string;
}

/**
 * Validates a list of multiline links pasted by the user against database and service rules.
 * Supports either a single serviceId or a comboId (with multiple bundle services).
 */
export async function validateBulkOrderLinks(
  rawText: string,
  serviceId?: string,
  defaultQuantity?: number,
  perRowQuantities?: number[],
  comboId?: string
): Promise<BulkValidationSummary> {
  const service = serviceId
    ? await prisma.service.findUnique({ where: { id: serviceId } })
    : null;

  const combo = comboId
    ? await prisma.combo.findUnique({
        where: { id: comboId },
        include: { items: { include: { service: true } } },
      })
    : null;

  if (!service && !combo) {
    throw new Error(
      comboId ? `Combo #${comboId} not found` : `Service #${serviceId} not found`
    );
  }

  const rawLines = rawText.split(/\r?\n/);
  const nonBlankEntries: { line: string; lineNumber: number }[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    if (trimmed.length > 0) {
      nonBlankEntries.push({ line: trimmed, lineNumber: i + 1 });
    }
  }

  if (nonBlankEntries.length === 0) {
    return {
      totalRows: 0,
      validRows: 0,
      duplicateRows: 0,
      activeOrderRows: 0,
      invalidRows: 0,
      readyToSubmitRows: 0,
      rows: [],
      totalQuantity: 0,
      estimatedCost: 0,
    };
  }

  // Find all active orders in the database to prevent duplicate active orders
  const activeOrders = await prisma.order.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING", "SCHEDULED", "SUBMITTED"] },
    },
    select: {
      id: true,
      orderRef: true,
      targetUrl: true,
    },
  });

  // Pre-normalize active order URLs for fast matching
  const activeUrlMap = new Map<string, string>();
  for (const o of activeOrders) {
    const norm = normalizeTargetUrl(o.targetUrl);
    if (norm.canonicalKey) {
      activeUrlMap.set(norm.canonicalKey, o.orderRef);
    }
    activeUrlMap.set(o.targetUrl.toLowerCase(), o.orderRef);
  }

  const seenCanonicalMap = new Map<string, number>();
  const parsedRows: ParsedBulkRow[] = [];

  let validCount = 0;
  let dupCount = 0;
  let activeOrderCount = 0;
  let invalidCount = 0;
  let totalQty = 0;
  let estimatedCost = 0;

  if (combo) {
    // Mode: Combo Bundle with multiple services applied to each valid link
    for (let i = 0; i < nonBlankEntries.length; i++) {
      const entry = nonBlankEntries[i];
      const line = entry.line;
      const lineNumber = entry.lineNumber;
      const norm = await resolveTargetUrl(line);

      if (!norm.isValid) {
        invalidCount++;
        parsedRows.push({
          index: parsedRows.length + 1,
          lineNumber,
          rawUrl: line,
          normalizedUrl: line,
          canonicalKey: line.toLowerCase(),
          platform: norm.platform || "Other",
          quantity: defaultQuantity || 1000,
          status: "INVALID_URL",
          statusLabel: `Invalid URL (Line ${lineNumber})`,
          canSubmit: false,
          errorMessage: `Line ${lineNumber}: ${norm.error || "Malformed URL format"}`,
        });
        continue;
      }

      if (seenCanonicalMap.has(norm.canonicalKey)) {
        const firstLine = seenCanonicalMap.get(norm.canonicalKey);
        dupCount++;
        parsedRows.push({
          index: parsedRows.length + 1,
          lineNumber,
          rawUrl: line,
          normalizedUrl: norm.normalizedUrl,
          canonicalKey: norm.canonicalKey,
          platform: norm.platform,
          quantity: defaultQuantity || 1000,
          status: "BATCH_DUPLICATE",
          statusLabel: `Duplicate of Line ${firstLine}`,
          canSubmit: false,
          errorMessage: `Line ${lineNumber} duplicates video from Line ${firstLine}`,
        });
        continue;
      }

      seenCanonicalMap.set(norm.canonicalKey, lineNumber);

      if (activeUrlMap.has(norm.canonicalKey) || activeUrlMap.has(norm.normalizedUrl.toLowerCase())) {
        const existingOrderId =
          activeUrlMap.get(norm.canonicalKey) || activeUrlMap.get(norm.normalizedUrl.toLowerCase());
        activeOrderCount++;
        parsedRows.push({
          index: parsedRows.length + 1,
          lineNumber,
          rawUrl: line,
          normalizedUrl: norm.normalizedUrl,
          canonicalKey: norm.canonicalKey,
          platform: norm.platform,
          quantity: defaultQuantity || 1000,
          status: "EXISTING_ACTIVE_ORDER",
          statusLabel: "Existing active order",
          canSubmit: false,
          errorMessage: `Line ${lineNumber}: Active order (${existingOrderId}) is already in progress for this link`,
          existingOrderId,
        });
        continue;
      }

      // Create an order row for each service in the combo
      for (const item of combo.items) {
        const srv = item.service;
        const validation = validateUrlForService(norm.normalizedUrl || line, srv.platform);
        const postRequirementError = getPostRequirementError(norm, srv);
        const qty =
          perRowQuantities && typeof perRowQuantities[i] === "number" && perRowQuantities[i] > 0
            ? perRowQuantities[i]
            : defaultQuantity && defaultQuantity > 0
            ? defaultQuantity
            : item.defaultQuantity || srv.minQuantity;

        let status: BulkRowStatus = "VALID";
        let statusLabel = "Ready to submit";
        let canSubmit = true;
        let errorMessage: string | undefined;

        if (!validation.valid) {
          status = "UNSUPPORTED_LINK";
          statusLabel = `Unsupported link (Line ${lineNumber})`;
          canSubmit = false;
          errorMessage = `Line ${lineNumber}: ${validation.reason || `Incompatible with ${srv.platform}`}`;
          invalidCount++;
        } else if (postRequirementError) {
          status = "UNSUPPORTED_LINK";
          statusLabel = `Unsupported link (Line ${lineNumber})`;
          canSubmit = false;
          errorMessage = `Line ${lineNumber}: ${postRequirementError}`;
          invalidCount++;
        } else if (qty < srv.minQuantity) {
          status = "INVALID_QUANTITY";
          statusLabel = "Invalid quantity";
          canSubmit = false;
          errorMessage = `Line ${lineNumber}: Below service minimum (${srv.minQuantity.toLocaleString()})`;
          invalidCount++;
        } else if (qty > srv.maxQuantity) {
          status = "INVALID_QUANTITY";
          statusLabel = "Invalid quantity";
          canSubmit = false;
          errorMessage = `Line ${lineNumber}: Exceeds service maximum (${srv.maxQuantity.toLocaleString()})`;
          invalidCount++;
        } else {
          status = "VALID";
          statusLabel = "Ready to submit";
          canSubmit = true;
          validCount++;
          totalQty += qty;
          estimatedCost += Number(((qty / 1000) * srv.ratePer1000).toFixed(4));
        }

        parsedRows.push({
          index: parsedRows.length + 1,
          lineNumber,
          rawUrl: line,
          normalizedUrl: norm.normalizedUrl,
          canonicalKey: norm.canonicalKey,
          platform: srv.platform,
          quantity: qty,
          status,
          statusLabel,
          canSubmit,
          errorMessage,
          serviceId: srv.id,
          serviceExternalId: srv.externalId,
          serviceName: srv.name,
          minQuantity: srv.minQuantity,
          maxQuantity: srv.maxQuantity,
          ratePer1000: srv.ratePer1000,
        });
      }
    }
  } else if (service) {
    // Mode: Single Service Catalog Bulk Add
    for (let i = 0; i < nonBlankEntries.length; i++) {
      const entry = nonBlankEntries[i];
      const line = entry.line;
      const lineNumber = entry.lineNumber;
      const qty =
        perRowQuantities && typeof perRowQuantities[i] === "number" && perRowQuantities[i] > 0
          ? perRowQuantities[i]
          : defaultQuantity && defaultQuantity > 0
          ? defaultQuantity
          : service.minQuantity;

      const normalized = await resolveTargetUrl(line);
      const validation = validateUrlForService(normalized.normalizedUrl || line, service.platform);
      const postRequirementError = getPostRequirementError(normalized, service);

      let status: BulkRowStatus = "VALID";
      let statusLabel = "Ready to submit";
      let canSubmit = true;
      let errorMessage: string | undefined;
      let existingOrderId: string | undefined;

      if (!normalized.isValid) {
        status = "INVALID_URL";
        statusLabel = `Invalid URL (Line ${lineNumber})`;
        canSubmit = false;
        errorMessage = `Line ${lineNumber}: ${normalized.error || "Malformed URL format"}`;
        invalidCount++;
      } else if (!validation.valid) {
        status = "UNSUPPORTED_LINK";
        statusLabel = `Unsupported link (Line ${lineNumber})`;
        canSubmit = false;
        errorMessage = `Line ${lineNumber}: ${validation.reason || `Incompatible with ${service.platform}`}`;
        invalidCount++;
      } else if (postRequirementError) {
        status = "UNSUPPORTED_LINK";
        statusLabel = `Unsupported link (Line ${lineNumber})`;
        canSubmit = false;
        errorMessage = `Line ${lineNumber}: ${postRequirementError}`;
        invalidCount++;
      } else if (seenCanonicalMap.has(normalized.canonicalKey)) {
        const firstLine = seenCanonicalMap.get(normalized.canonicalKey);
        status = "BATCH_DUPLICATE";
        statusLabel = `Duplicate of Line ${firstLine}`;
        canSubmit = false;
        errorMessage = `Line ${lineNumber} duplicates video from Line ${firstLine}`;
        dupCount++;
      } else if (
        activeUrlMap.has(normalized.canonicalKey) ||
        activeUrlMap.has(normalized.normalizedUrl.toLowerCase())
      ) {
        status = "EXISTING_ACTIVE_ORDER";
        existingOrderId =
          activeUrlMap.get(normalized.canonicalKey) ||
          activeUrlMap.get(normalized.normalizedUrl.toLowerCase());
        statusLabel = "Existing active order";
        canSubmit = false;
        errorMessage = `Line ${lineNumber}: Active order (${existingOrderId}) is already in progress for this link`;
        activeOrderCount++;
      } else if (qty < service.minQuantity) {
        status = "INVALID_QUANTITY";
        statusLabel = "Invalid quantity";
        canSubmit = false;
        errorMessage = `Line ${lineNumber}: Below service minimum (${service.minQuantity.toLocaleString()})`;
        invalidCount++;
      } else if (qty > service.maxQuantity) {
        status = "INVALID_QUANTITY";
        statusLabel = "Invalid quantity";
        canSubmit = false;
        errorMessage = `Line ${lineNumber}: Exceeds service maximum (${service.maxQuantity.toLocaleString()})`;
        invalidCount++;
      } else {
        status = "VALID";
        statusLabel = "Ready to submit";
        canSubmit = true;
        validCount++;
        totalQty += qty;
      }

      if (normalized.isValid && normalized.canonicalKey && !seenCanonicalMap.has(normalized.canonicalKey)) {
        seenCanonicalMap.set(normalized.canonicalKey, lineNumber);
      }

      parsedRows.push({
        index: i + 1,
        lineNumber,
        rawUrl: line,
        normalizedUrl: normalized.normalizedUrl || line,
        canonicalKey: normalized.canonicalKey || line.toLowerCase(),
        platform: normalized.platform,
        quantity: qty,
        status,
        statusLabel,
        canSubmit,
        errorMessage,
        existingOrderId,
        serviceId: service.id,
        serviceExternalId: service.externalId,
        serviceName: service.name,
        minQuantity: service.minQuantity,
        maxQuantity: service.maxQuantity,
        ratePer1000: service.ratePer1000,
      });
    }

    estimatedCost = Number(((totalQty / 1000) * service.ratePer1000).toFixed(4));
  }

  return {
    totalRows: nonBlankEntries.length,
    validRows: validCount,
    duplicateRows: dupCount,
    activeOrderRows: activeOrderCount,
    invalidRows: invalidCount,
    readyToSubmitRows: validCount,
    rows: parsedRows,
    totalQuantity: totalQty,
    estimatedCost: Number(estimatedCost.toFixed(4)),
  };
}

// In-flight token set to prevent double-click duplicate batch submissions
const inFlightTokens = new Set<string>();
const completedTokens = new Map<string, { result: SubmitBulkOrdersResult; expiresAt: number }>();
const COMPLETED_TOKEN_TTL_MS = 10 * 60 * 1000;

/**
 * Executes a verified bulk orders batch submission through the existing order service.
 */
export async function submitBulkOrders(
  params: SubmitBulkOrdersParams
): Promise<SubmitBulkOrdersResult> {
  const { serviceId, rows, idempotencyToken, scheduledJobId, userId } = params;

  if (idempotencyToken) {
    const cached = completedTokens.get(idempotencyToken);
    if (cached) {
      if (cached.expiresAt > Date.now()) {
        return cached.result;
      }
      completedTokens.delete(idempotencyToken);
    }

    if (inFlightTokens.has(idempotencyToken)) {
      throw new Error("This bulk submission is already currently processing. Please do not double click.");
    }
    inFlightTokens.add(idempotencyToken);
  }

  try {
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service || !service.active) {
      throw new Error("Selected service is unavailable");
    }

    if (!rows || rows.length === 0) {
      throw new Error("No order rows provided for bulk submission");
    }

    const batchRef = `BLK-${Math.floor(100000 + Math.random() * 900000)}`;
    const unitCost = service.ratePer1000 / 1000;

    // Create BulkBatch container
    const bulkBatch = await prisma.bulkBatch.create({
      data: {
        batchRef,
        userId: userId || null,
        status: "PROCESSING",
        totalOrders: rows.length,
        successOrders: 0,
        failedOrders: 0,
        totalCost: 0,
      },
    });

    const { adapter } = await getActiveProvider(userId);
    const outcomes: BulkOrderRowOutcome[] = [];
    const seenTargets = new Set<string>();
    let successCount = 0;
    let failedCount = 0;
    let accumulatedCost = 0;

    // Process each valid row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const resolved = await resolveTargetUrl(row.normalizedUrl || row.rawUrl);
      const targetUrl = resolved.normalizedUrl || row.rawUrl;
      const quantity = row.quantity;
      const orderCost = Number(((quantity / 1000) * service.ratePer1000).toFixed(4));
      const orderRef = `SMM-${Math.floor(100000 + Math.random() * 900000)}`;

      let rowError: string | undefined;

      if (quantity < service.minQuantity || quantity > service.maxQuantity) {
        rowError = `Quantity ${quantity} outside service bounds [${service.minQuantity}, ${service.maxQuantity}]`;
      } else if (!resolved.isValid) {
        rowError = resolved.error || "Invalid target URL";
      } else {
        const compatibility = validateUrlForService(targetUrl, service.platform);
        if (!compatibility.valid) {
          rowError = compatibility.reason || `Incompatible with ${service.platform}`;
        } else {
          rowError = getPostRequirementError(resolved, service) || undefined;
        }

        if (!rowError) {
          const targetKey = resolved.canonicalKey || targetUrl.toLowerCase();
          if (seenTargets.has(targetKey)) {
            rowError = "Duplicate link within this bulk submission";
          } else {
            seenTargets.add(targetKey);
          }
        }
      }

      if (rowError) {
        failedCount++;
        outcomes.push({
          index: i + 1,
          url: targetUrl,
          quantity,
          success: false,
          errorMessage: rowError,
        });

        await prisma.order.create({
          data: {
            orderRef,
            serviceId: service.id,
            targetUrl,
            requestedQuantity: quantity,
            submittedQuantity: 0,
            deliveredQuantity: 0,
            remainingQuantity: quantity,
            failedQuantity: quantity,
            unitCost,
            totalCost: orderCost,
            isScheduled: false,
            scheduleMode: "INSTANT",
            status: "FAILED",
            errorMessage: rowError,
            bulkBatchId: bulkBatch.id,
            scheduledJobId: scheduledJobId || null,
            userId: userId || null,
          },
        });
        continue;
      }

      // Submit row to external provider adapter
      try {
        const providerRes = await adapter.createOrder({
          serviceExternalId: service.externalId,
          targetUrl,
          quantity,
        });

        if (providerRes.success && providerRes.providerOrderId) {
          successCount++;
          accumulatedCost += orderCost;

          const createdOrder = await prisma.order.create({
            data: {
              orderRef,
              serviceId: service.id,
              targetUrl,
              requestedQuantity: quantity,
              submittedQuantity: quantity,
              deliveredQuantity: 0,
              remainingQuantity: quantity,
              failedQuantity: 0,
              unitCost,
              totalCost: orderCost,
              isScheduled: false,
              scheduleMode: "INSTANT",
              status: "PROCESSING",
              providerOrderId: providerRes.providerOrderId,
              bulkBatchId: bulkBatch.id,
              scheduledJobId: scheduledJobId || null,
              userId: userId || null,
            },
          });

          outcomes.push({
            index: i + 1,
            url: targetUrl,
            quantity,
            success: true,
            orderId: createdOrder.id,
            orderRef,
            providerOrderId: providerRes.providerOrderId,
          });
        } else {
          failedCount++;
          const errMsg = providerRes.error || "Provider rejected order";

          const createdOrder = await prisma.order.create({
            data: {
              orderRef,
              serviceId: service.id,
              targetUrl,
              requestedQuantity: quantity,
              submittedQuantity: 0,
              deliveredQuantity: 0,
              remainingQuantity: quantity,
              failedQuantity: quantity,
              unitCost,
              totalCost: orderCost,
              isScheduled: false,
              scheduleMode: "INSTANT",
              status: "FAILED",
              errorMessage: errMsg,
              bulkBatchId: bulkBatch.id,
              scheduledJobId: scheduledJobId || null,
              userId: userId || null,
            },
          });

          outcomes.push({
            index: i + 1,
            url: targetUrl,
            quantity,
            success: false,
            orderId: createdOrder.id,
            orderRef,
            errorMessage: errMsg,
          });
        }
      } catch (err: unknown) {
        failedCount++;
        const errMsg = err instanceof Error ? err.message : String(err);
        outcomes.push({
          index: i + 1,
          url: targetUrl,
          quantity,
          success: false,
          errorMessage: errMsg,
        });

        await prisma.order.create({
          data: {
            orderRef,
            serviceId: service.id,
            targetUrl,
            requestedQuantity: quantity,
            submittedQuantity: 0,
            deliveredQuantity: 0,
            remainingQuantity: quantity,
            failedQuantity: quantity,
            unitCost,
            totalCost: orderCost,
            isScheduled: false,
            scheduleMode: "INSTANT",
            status: "FAILED",
            errorMessage: errMsg,
            bulkBatchId: bulkBatch.id,
            scheduledJobId: scheduledJobId || null,
            userId: userId || null,
          },
        });
      }
    }

    // Determine final batch status
    const batchStatus =
      failedCount === 0 ? "COMPLETED" : successCount > 0 ? "PARTIAL" : "FAILED";

    await prisma.bulkBatch.update({
      where: { id: bulkBatch.id },
      data: {
        status: batchStatus,
        successOrders: successCount,
        failedOrders: failedCount,
        totalCost: Number(accumulatedCost.toFixed(4)),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "BULK_ORDERS_SUBMITTED",
        actor: "Customer",
        details: `Bulk Batch ${batchRef}: ${successCount}/${rows.length} orders created successfully (${batchStatus})`,
      },
    });

    const result: SubmitBulkOrdersResult = {
      success: successCount > 0,
      batchId: bulkBatch.id,
      batchRef,
      totalOrders: rows.length,
      successOrders: successCount,
      failedOrders: failedCount,
      totalCost: Number(accumulatedCost.toFixed(4)),
      outcomes,
    };

    if (idempotencyToken) {
      completedTokens.set(idempotencyToken, {
        result,
        expiresAt: Date.now() + COMPLETED_TOKEN_TTL_MS,
      });
    }

    return result;
  } finally {
    if (idempotencyToken) {
      inFlightTokens.delete(idempotencyToken);
    }
  }
}
