import type { Request, Response } from "express";
import {
  depositSchema,
  orderBodySchema,
  orderIdParamSchema,
  symbolParamSchema,
} from "../types/exchange-schema.js";
import { sendToEngine } from "../utils/engine-client.js";
import { sendValidationError } from "../utils/validation.js";
import { persistOrderResult } from "../utils/persist-order.js";
import { prisma } from "../db.js";
import type { CreateOrderResult } from "../types/engine.js";

function getUserId(req: Request): string {
  if (!req.userId) throw new Error("Missing authenticated user");
  return req.userId;
}

export async function depositMoney( req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);

  const parsedBody = depositSchema.safeParse(req.body);
  if(!parsedBody.success){
    sendValidationError(res, parsedBody.error);
    return;
  }

  const { amount, asset } = parsedBody.data;

  //db entry
  const assetRecord = await prisma.asset.findUnique({
    where: {
      symbol: asset,
    },
  });


  if (!assetRecord) {
    res.status(404).json({
      error: "Asset not found",
    });
    return;
  }

  const balance = await prisma.balance.findUnique({
    where: {
      userId_assetId: {
        userId,
        assetId: assetRecord.id
      }
    }
  })

  //create balance if not exists or increment the balance 

  const updatedBalance = balance ? await prisma.balance.update({
        where: {
          id: balance.id,
        },
        data: {
          available: {
            increment: amount,
          },
        },
      }) : await prisma.balance.create({
        data: {
          userId,
          assetId: assetRecord.id,
          available: amount,
          locked: 0,
        },
      });

     
  const engineResponse = await sendToEngine("deposit", {
    userId,
    amount,
    asset
  })

  if (!engineResponse.ok) {
    res.status(500).json(engineResponse.error);
    return;
  }

  res.status(200).json({
    message: "Deposit successful",
    balance: updatedBalance,
  });
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);

  const parsedBody = orderBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    sendValidationError(res, parsedBody.error);
    return;
  }

  const { type, side, symbol, qty } = parsedBody.data;
  const price = type === "market" ? null : parsedBody.data.price;

  // validate the market before touching the engine - cheaper failure than
  // a broken FK after the engine has already matched the order
  const market = await prisma.market.findUnique({ where: { symbol } });
  if (!market) {
    res.status(404).json({ error: "Market not found" });
    return;
  }

  const engineResponse = await sendToEngine("create_order", {
    userId,
    type,
    side,
    symbol,
    price,
    qty,
  });

  if(!engineResponse.ok){
    res.status(400).json({ error: engineResponse.error });
    return;
  }

  const result = engineResponse.data as CreateOrderResult;

  try {
    await persistOrderResult(market.symbol, result.incomingOrder);
  } catch (error) {
    // the engine has already moved state (locked balances, matched fills) -
    // we can't undo that, so we log and still return the engine's result
    // rather than 500ing a request that actually succeeded on the engine side
    console.error("Failed to persist order", result.incomingOrder.orderId, error);
  }

  res.status(200).json(result)
}

export async function getDepth(req: Request, res: Response): Promise<void> {
  const parsedParams = symbolParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendValidationError(res, parsedParams.error);
    return;
  }

  const { symbol } = parsedParams.data;
  const engineResponse = await sendToEngine("get_depth", { symbol });
  res.status(engineResponse.ok ? 200 : 400).json(engineResponse.ok ? engineResponse.data : {
    error: engineResponse.error,
  });
}

export async function getBalance(req: Request, res: Response): Promise<void> {
  const engineResponse = await sendToEngine("get_user_balance", {
    userId: getUserId(req),
  });
  console.log(engineResponse)
  res.status(engineResponse.ok ? 200 : 400).json(engineResponse.ok ? engineResponse.data : {
    error: engineResponse.error,
  });
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  const parsedParams = orderIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendValidationError(res, parsedParams.error);
    return;
  }

  const { orderId } = parsedParams.data;
  const engineResponse = await sendToEngine("get_order", {
    userId: getUserId(req),
    orderId,
  });

  res.status(engineResponse.ok ? 200 : 404).json(engineResponse.ok ? engineResponse.data : {
    error: engineResponse.error,
  });
}

export async function cancelOrder(req: Request, res: Response): Promise<void> {
  const parsedParams = orderIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendValidationError(res, parsedParams.error);
    return;
  }

  const { orderId } = parsedParams.data;
  const engineResponse = await sendToEngine("cancel_order", {
    userId: getUserId(req),
    orderId,
  });

  res.status(engineResponse.ok ? 200 : 400).json(engineResponse.ok ? engineResponse.data : {
    error: engineResponse.error,
  });
}
