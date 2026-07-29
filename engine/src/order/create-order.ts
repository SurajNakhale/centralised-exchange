import { type CreateOrderInput } from "../types/exchange-store";
import { handleLimitOrder } from "./limit-order";

export function createOrder(payload: Record<string, unknown>){
    const input = payload as unknown as CreateOrderInput;

    if(input.type == "limit"){
        return handleLimitOrder(input);
    }
}