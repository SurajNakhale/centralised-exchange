import "dotenv/config";
import { createClient } from "redis";
import { env } from "./utils/env.js";
import { depositMoney } from "./deposit/deposit.js";
import { createOrder } from "./order/create-order.js";
import { getDepth } from "./order/depth.js";
import { cancelOrder } from "./order/cancel-order.js";
import { getUserBalance } from "./order/balance.js";

export type EngineCommandType =
    "deposit"
  | "create_order"
  | "get_depth"
  | "get_user_balance"
  | "get_order"
  | "cancel_order";

export interface EngineRequest {
  correlationId: string;
  responseQueue: string;
  type: EngineCommandType;
  payload: Record<string, unknown>;
}

export interface EngineResponse {
  correlationId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

const brokerClient = createClient({ url: env.redisUrl }).on("error", (error) => {
  console.error("Redis broker client error", error);
});

const responseClient = createClient({ url: env.redisUrl }).on("error", (error) => {
  console.error("Redis response client error", error);
});


export const marketDataClient = createClient({ url: env.redisUrl }).on("error", (error) => {
  console.error("Redis response client error", error);
});

await Promise.all([brokerClient.connect(), responseClient.connect(), marketDataClient.connect()]);


async function sendResponse(responseQueue: string, response: EngineResponse): Promise<void> {
  await responseClient.lPush(responseQueue, JSON.stringify(response));
}


async function handleEngineRequest(message: EngineRequest) {
  /**
   * TODO(student):
   * 1. Check _message.type.
   * 2. Read _message.payload.
   * 3. Call your order book / balance / order logic.
   * 4. Return the data that should go back to the backend.
   *
   * Required message types:
   * - deposit
   * - create_order
   * - get_depth
   * - get_user_balance
   * - get_order
   * - cancel_order
   */
  switch (message.type) {
    case "deposit":
        return depositMoney(message.payload);

    case "create_order":
        return await createOrder(message.payload);

    case "get_depth":
        return getDepth(message.payload);

    case "get_user_balance":
        return getUserBalance(message.payload);

    case "cancel_order":
        return cancelOrder(message.payload);

    default:
        throw new Error(`Unknown message type: ${message.type}`);
  }
  
}

console.log(`Engine listening on Redis queue: ${env.incomingQueue}`);

for (;;) {
  const item = await brokerClient.brPop(env.incomingQueue, 0);
  if (!item) continue;

  let message: EngineRequest;

  try {
    message = JSON.parse(item.element) as EngineRequest;
  } catch {
    console.error("Skipping invalid broker message");
    continue;
  }

  try {
    const data = await handleEngineRequest(message);
    await sendResponse(message.responseQueue, {
      correlationId: message.correlationId,
      ok: true,
      data,
    });
    
  } catch (error) {
    await sendResponse(message.responseQueue, {
      correlationId: message.correlationId,
      ok: false,
      error: error instanceof Error ? error.message : "engine_error",
    });
  }
}