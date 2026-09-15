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

export interface EngineFill {
  fillId: string;
  tradeId: number;
  symbol: string;
  price: number;
  qty: number;
  buyOrderId: string;
  sellOrderId: string;
  createdAt: number;
}

export interface EngineOrder {
  orderId: string;
  userId: string;
  side: "buy" | "sell";
  type: "limit" | "market";
  symbol: string;
  price: number | null;
  qty: number;
  filledQty: number;
  status: "open" | "partially_filled" | "filled" | "cancelled";
  fills: EngineFill[];
  createdAt: number;
}

export interface CreateOrderResult {
  message: string;
  remainingQty?: number;
  incomingOrder: EngineOrder;
}
