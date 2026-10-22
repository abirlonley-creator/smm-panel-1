export interface CancellationTarget {
  id: string;
  orderRef: string;
  status: string;
  providerOrderId: string | null;
}

export interface CancellationDependencies<TDetail> {
  findOrder(identifier: string): Promise<CancellationTarget | null>;
  getOrderDetail(orderId: string): Promise<TDetail | null>;
  cancelProviderOrder(providerOrderId: string): Promise<{ success: boolean; error?: string }>;
  persistCancellation(orderId: string): Promise<void>;
  writeAudit(order: CancellationTarget): Promise<void>;
}

export interface CancellationHttpResult<TDetail> {
  status: number;
  body: {
    success: boolean;
    order?: TDetail;
    error?: string;
    alreadyCancelled?: boolean;
    message?: string;
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Coordinates provider and local cancellation while leaving failed requests unchanged. */
export async function cancelOrder<TDetail>(
  identifier: string,
  dependencies: CancellationDependencies<TDetail>
): Promise<CancellationHttpResult<TDetail>> {
  const order = await dependencies.findOrder(identifier);
  if (!order) {
    return { status: 404, body: { success: false, error: "Order not found." } };
  }

  if (order.status === "CANCELLED") {
    const detail = await dependencies.getOrderDetail(order.id);
    if (!detail) {
      return { status: 500, body: { success: false, error: "Cancelled order details could not be loaded." } };
    }
    return {
      status: 200,
      body: {
        success: true,
        order: detail,
        alreadyCancelled: true,
        message: "Order was already cancelled.",
      },
    };
  }

  if (order.status === "COMPLETED") {
    return {
      status: 400,
      body: { success: false, error: "Order is already completed and cannot be cancelled." },
    };
  }

  if (order.providerOrderId) {
    try {
      const providerResult = await dependencies.cancelProviderOrder(order.providerOrderId);
      if (!providerResult.success) {
        return {
          status: 502,
          body: {
            success: false,
            error: providerResult.error || "The provider did not confirm cancellation.",
          },
        };
      }
    } catch (error: unknown) {
      return { status: 502, body: { success: false, error: getErrorMessage(error) } };
    }
  }

  await dependencies.persistCancellation(order.id);
  await dependencies.writeAudit(order);

  const detail = await dependencies.getOrderDetail(order.id);
  if (!detail) {
    return { status: 500, body: { success: false, error: "Order was cancelled but its details could not be loaded." } };
  }

  return {
    status: 200,
    body: {
      success: true,
      order: detail,
      message: "Order was cancelled successfully.",
    },
  };
}
