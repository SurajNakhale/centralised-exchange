import { prisma } from "../db.js";
import type { EngineOrder } from "../types/engine.js";

function statusFor(qty: number, filledQty: number) {
  if (filledQty === 0) return "open" as const;
  return filledQty < qty ? ("partially_filled" as const) : ("filled" as const);
}

/**
 * Persists the result of an engine create_order call: the incoming order,
 * plus any fills it generated. Every fill also mutates a *resting* order
 * (the one already on the book) which the engine response does not include
 * directly - we derive it from buyOrderId/sellOrderId on each fill.
 *
 * Order matters: the incoming order must exist before Fill rows (which FK
 * to both buyOrderId and sellOrderId) are inserted. All in one transaction
 * so a partial failure can't leave fills pointing at stale filledQty.
 */
export async function persistOrderResult(market: string, order: EngineOrder): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. incoming order first - fills FK to it
    await tx.order.create({
      data: {
        id: order.orderId,
        userId: order.userId,
        side: order.side,
        type: order.type,
        market,
        price: order.price === null ? null : order.price.toString(),
        qty: order.qty.toString(),
        filledQty: order.filledQty.toString(),
        status: order.status,
        createdAt: new Date(order.createdAt),
      },
    });

    // 2. each fill is a delta on the resting counterparty order
    for (const fill of order.fills) {
      const restingId =
        fill.buyOrderId === order.orderId ? fill.sellOrderId : fill.buyOrderId;

      const resting = await tx.order.update({
        where: { id: restingId },
        data: { filledQty: { increment: fill.qty.toString() } },
      });

      const next = statusFor(Number(resting.qty), Number(resting.filledQty));
      if (next !== resting.status) {
        await tx.order.update({ where: { id: restingId }, data: { status: next } });
      }
    }

    // 3. fills last - both FK targets now exist
    if (order.fills.length > 0) {
      await tx.fill.createMany({
        data: order.fills.map((fill) => ({
          id: fill.fillId,
          tradeId: fill.tradeId,
          symbol: fill.symbol,
          price: fill.price.toString(),
          qty: fill.qty.toString(),
          buyOrderId: fill.buyOrderId,
          sellOrderId: fill.sellOrderId,
          createdAt: new Date(fill.createdAt),
        })),
      });
    }
  });
}
