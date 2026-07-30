import { error } from "node:console";
import { ORDERS, type OrderRecord } from "../types/exchange-store";
import { getOrderBook } from "./limit-order";
import { getUserAsset } from "../deposit/helperBalance";

function getOrder(orderId: string){
    return ORDERS.get(orderId) ?? null;
}

function validOrderToCancel(order: OrderRecord){
    if(order.status == "open" || order.status == "partially_filled") return true;
    else return false;
}

function removeFromOB(order: OrderRecord){
    const side = order.side;
    const book = getOrderBook(order.symbol);
    const currSide = side == "buy" ? book.bids : book.asks;
    
    let restingorder = currSide.get(order.price!);
    if(!restingorder) return;
    
    restingorder = restingorder?.filter(x => x.orderId != order.orderId) 
    if(restingorder.length == 0){
        currSide.delete(order.price!);
    }
    else{
        currSide.set(order.price!, restingorder!);
    }
}

function unlockBalances(userId: string, asset: string, order: OrderRecord){
    const userAssetBalance = getUserAsset(userId, asset);
    const remainingQty = (order.qty - order.filledQty);
    const unlockamount = order.side == "buy" ? remainingQty*order.price! : remainingQty;
    
    userAssetBalance.available = userAssetBalance.available.plus(unlockamount);
    userAssetBalance.locked = userAssetBalance.locked.minus(unlockamount);

}
export function cancelOrder(payload: Record<string, unknown>){
    const userId = payload.userId as unknown as string;
    const orderId = payload.orderId as unknown as string;

    // 1. Get order details
    // 2. Verify the order belongs to the requesting user
    // 3. Verify the order status is OPEN or PARTIALLY_FILLED
    // 4. Remove the order from the order book
    // 5. Unlock the remaining locked balance/assets
    // 6. Update order status to CANCELLED
    // 7. Return the updated order

    const order = getOrder(orderId)
    if(!order || order?.userId != userId) throw new Error("order does not exists or order for this user does not exists")

    if(!validOrderToCancel(order)) throw new Error("can't cancel")

    removeFromOB(order);

    const asset = order.side == "buy" ? "INR" : order.symbol;
    unlockBalances(userId, asset, order);

    order.status = "cancelled";

    return {
        order
    }
      

}