import { ORDERBOOKS, ORDERBOOKS_SEQUENCE, type RestingOrder } from "../types/exchange-store";
import { getOrderBook } from "./limit-order";

function getDepthLevel(side: Map<number, RestingOrder[]>){
    const depth = [];

    for(let [key, value] of side.entries()){

        const totalQty = value?.reduce((sum, order) => {
            const qty = order.qty - order.filledQty;
            sum += qty
            return sum 
        }, 0)

        depth.push({
            price: key,
            qty: totalQty
        })
    }

    return depth;
}

export function getDepth(payload: Record<string, unknown> | string){
    const symbol = payload as unknown as string;
    const orderbook = getOrderBook(symbol);

    const newBids = getDepthLevel(orderbook.bids).sort((a, b) => b.price - a.price)
    const newAsks = getDepthLevel(orderbook.asks).sort((a, b) => a.price - b.price)

    const updateId = ORDERBOOKS_SEQUENCE.get(symbol)!

    return {
        symbol: symbol,
        lastUpdateId: updateId, 
        bids: newBids,
        asks: newAsks
    }
    
}