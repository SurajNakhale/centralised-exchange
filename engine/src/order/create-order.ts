import { type CreateOrderInput } from "../types/exchange-store";
import { handleLimitOrder } from "./limit-order";
import { handleMarketOrder } from "./market-order";

export async function createOrder(payload: Record<string, unknown>){
    const lInput = payload as unknown as CreateOrderInput;
    const mInput = payload;

    if(lInput.type == "limit"){
        return await handleLimitOrder(lInput);
    }
    else{
        return await handleMarketOrder(mInput);
    }
}