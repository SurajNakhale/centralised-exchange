import { getUserAsset } from "../deposit/helperBalance";
import { publishToEventStream, type Ievent } from "../market-data/redis-stream";
import { FILLS, ORDERS, TRADE_ID, type Fill, type OrderRecord, type RestingOrder, type Side } from "../types/exchange-store";
import { getNextTradeId, getNextUpdateId } from "../utils/generateId";
import { getDepth } from "./depth";
import { getOrderBook, lockBalances, settleBalances, updateOrderStatus } from "./limit-order";

export async function handleMarketOrder(input: Record<string, unknown>){
    const qty = input.qty as unknown as number;
    const symbol = input.symbol as unknown as string;
    const userId = input.userId as unknown as string;
    const side = input.side as unknown as Side;

    const book = getOrderBook(symbol);
    const oppositeSide = side == "buy" ? book.asks : book.bids;


    const events: Ievent[] = []

    let remainingQty: number = qty;
    let totalCost = 0;
    

    const prices = [...oppositeSide.keys()].sort((a,b) => side == "buy" ? a-b : b-a);

    for(let price of prices){
        const restingorder = oppositeSide.get(price)!;

        if(remainingQty != 0){

            for(let order of restingorder){
                const orderQty = order.qty - order.filledQty;
                const qty = Math.min(orderQty, remainingQty);
                
                remainingQty -= qty;
                totalCost += qty*price;
    
                if(remainingQty == 0){
                    break;
                }
            }
        }
            
    }
    
    if(remainingQty != 0)   throw new Error("not enough liquidity");
    
    const amountToLock = side == "buy" ? totalCost : qty;
    const asset = side == "buy" ? "INR" : symbol;

    lockBalances(userId, asset, amountToLock)

    const orderId = crypto.randomUUID();

    const incomingOrder: OrderRecord = {
        orderId: orderId,
        userId: userId,
        side: side,
        type: "market",
        symbol,
        price: null,
        qty,
        filledQty: 0,
        status: "open",
        fills: [],
        createdAt: Date.now()
    }

    ORDERS.set(incomingOrder.orderId, incomingOrder);

    remainingQty = qty;
    for(let price of prices){
        const restingorder = oppositeSide.get(price)!;

        for(let rest of restingorder){
            const orderQty = rest.qty - rest.filledQty;
            const filled = Math.min(orderQty, remainingQty);

            if(!orderQty) continue;

            //update rest, incomingorder, remaining qty
            remainingQty -= filled;
            rest.filledQty += filled;
            incomingOrder.filledQty += filled;

            const tradeId = getNextTradeId(symbol);
            const fill: Fill = {
                fillId: crypto.randomUUID(),
                symbol,
                tradeId,
                price: price,
                qty: filled,
                buyOrderId: side == "buy" ? incomingOrder.orderId : rest.orderId,
                sellOrderId: side == "buy" ? rest.orderId : incomingOrder.orderId,
                createdAt: Date.now(),
            }

            events.push({
                type: "trade",
                topic: `trade.${symbol}`,
                data: {
                    fill
                }
            });

            incomingOrder.fills.push(fill);
            FILLS.push(fill);

            //settle balances
            const buyerId = side == "buy" ? incomingOrder.userId : rest.userId;
            const sellerId = side == "buy" ? rest.userId : incomingOrder.userId;

            settleBalances(buyerId, sellerId, filled, price, symbol);

            updateOrderStatus(incomingOrder);
            updateOrderStatus(rest);

            if(remainingQty == 0){
                break;
            }

        }

        //clean up filled order 
        const remainingOrder = restingorder.filter(order => order.filledQty < order.qty);
        if(remainingOrder.length == 0){
            oppositeSide.delete(price);
        }
        oppositeSide.set(price, remainingOrder);

        
        if(remainingQty == 0){
            break;
        }

    }

    getNextUpdateId(symbol);
    const depth = getDepth({symbol});
    events.push({
        type: "depth",
        topic: `depth.${symbol}`,
        data: {
            depth
        }
    });

    for(let event of events){
        const streamId = await publishToEventStream(event);

        console.log(`Published ${event.topic} to ${streamId}`);
    }

    return {
        message: "order Processed",
        incomingOrder
    }
}