import { getUserAsset } from "../deposit/helperBalance";
import { FILLS, ORDERBOOKS, ORDERS, type CreateOrderInput, type Fill, type OrderRecord, type RestingOrder, type Side } from "../types/exchange-store";

export function getOrderBook(symbol: string){
    let orderbook = ORDERBOOKS.get(symbol);

    if(!orderbook){
        orderbook = {
            bids: new Map(),
            asks: new Map(),
        }

    }
    ORDERBOOKS.set(symbol, orderbook);
    return orderbook;
}

function settleBalances(buyerId: string, sellerId: string, tradeQty: number, tradePrice: number, symbol: string){
    const totalCost = tradePrice * tradeQty;
    
    const buyerINR = getUserAsset(buyerId, "INR")
    const sellerINR = getUserAsset(sellerId, "INR")

    const buyerAsset = getUserAsset(buyerId, symbol)
    const sellerAsset = getUserAsset(sellerId, symbol)

    buyerINR.locked = buyerINR.locked.minus(totalCost);
    buyerAsset.available = buyerAsset.available.plus(tradeQty);

    sellerINR.available = sellerINR.available.plus(totalCost);
    sellerAsset.locked = sellerAsset.locked.minus(tradeQty);
}

function getBestPrice(side: Side, oppositeSide: Map<number, RestingOrder[]>){
    const prices = [...oppositeSide.keys()];
    if(prices.length == 0) return null;

    if(side == "buy"){
        return prices.reduce((min, price) => Math.min(min, price))
    } 
    else{
        return prices.reduce((max, price) => Math.max(max, price))
    }
}

function updateOrderStatus(order: OrderRecord | RestingOrder){
    if(order.filledQty > 0 && order.filledQty < order.qty){
        order.status = "partially_filled";
    }
    else if(order.filledQty == order.qty){
        order.status = "filled";
    }
    else if(order.filledQty == 0){
        order.status = "open";
    }
}

function lockBalances(userId: string, asset: string, amountToLock: number){
    const userAssetBalance = getUserAsset(userId, asset);

    if(Number(userAssetBalance.available) < amountToLock) throw new Error("insufficient funds");

    userAssetBalance.available = userAssetBalance.available.minus(amountToLock);
    userAssetBalance.locked = userAssetBalance.locked.plus(amountToLock);
}

function isMatchAble(side: string, bestPrice: number, price: number){
    if(side == "buy"){
        if(price! >= bestPrice) return true;
    }
    else{
        if(price! <= bestPrice) return true;
    }

    return false;
}

export function handleLimitOrder(input: CreateOrderInput){
    const {userId, type, side, symbol, price, qty} = input
    const orderId = crypto.randomUUID();
    
    const totalCost = (price || 0) * qty;
    //lock balances write helper function to do this
    let asset = (side == "buy") ? "INR" : symbol;
    let amountToLock = (side == "buy") ? totalCost : qty;

    lockBalances(userId, asset, amountToLock);

    const incomingOrder: OrderRecord = {
        orderId,
        userId,
        side,
        type,
        symbol,
        price,
        qty,
        fills: [],
        filledQty: 0,
        status: "open",
        createdAt: Date.now()
    }

    //we can set before cause object in js are referenced types
    ORDERS.set(incomingOrder.orderId, incomingOrder);

    const book = getOrderBook(symbol)
    const oppositeSide = (side == "buy") ? book.asks : book.bids;

    let remainingQty = qty;
    
    while(remainingQty > 0){
        
        //find best price
        const bestPrice = getBestPrice(side, oppositeSide);
        if(!bestPrice) break;
        
        if(!isMatchAble) break;

        let existingOrders: RestingOrder[] = oppositeSide.get(bestPrice)!;

        for(let i=0; i<existingOrders.length; i++){
            let restingOrder = existingOrders[i]!;
            const orderQty = restingOrder.qty - restingOrder.filledQty;
            
            if(!orderQty) continue;

            const filled = Math.min(orderQty, remainingQty);
            
            remainingQty -= filled;
            incomingOrder.filledQty += filled;
            restingOrder.filledQty += filled;

            //add to fills
            const fill: Fill = {
                fillId: crypto.randomUUID(),
                symbol: restingOrder.symbol,
                price: restingOrder.price,
                qty: filled,
                buyOrderId: (side == "buy") ? incomingOrder.orderId : restingOrder.orderId,
                sellOrderId: (side == "buy") ? restingOrder.orderId : incomingOrder.orderId,
                createdAt: Date.now()
            }
            
            incomingOrder.fills.push(fill);
            FILLS.push(fill);

            let buyerId = (side == "buy") ? incomingOrder.userId : restingOrder.userId;
            let sellerId = (side == "buy") ? restingOrder.userId : incomingOrder.userId;

            settleBalances(buyerId, sellerId, filled, restingOrder.price, symbol);
            
            
            updateOrderStatus(incomingOrder);
            updateOrderStatus(restingOrder);

            if(remainingQty === 0){
                break;
            }
        }    

        const remainingOrders = existingOrders.filter(order => order.filledQty < order.qty);
        if(remainingOrders.length == 0){
            oppositeSide.delete(bestPrice);
        }
        else{
            oppositeSide.set(bestPrice, remainingOrders);
        }
        
    }

    //add remaining incomingOrder in incommmingorder.side 
    if(remainingQty > 0){
        let currSide = (side == "buy") ? book.bids : book.asks;
        
        let currPriceOrders = currSide.get(incomingOrder.price!);
        if(!currPriceOrders){
            currPriceOrders = [];
            currSide.set(incomingOrder.price!, currPriceOrders)
        }
    
        const restingorder: RestingOrder = {
            userId: incomingOrder.userId,
            orderId: incomingOrder.orderId,
            side: incomingOrder.side,
            type: "limit",
            symbol: incomingOrder.symbol,
            price: incomingOrder.price!,
            qty: incomingOrder.qty,
            filledQty: incomingOrder.filledQty,
            status: incomingOrder.status,
            createdAt: incomingOrder.createdAt
            
        }

        currPriceOrders.push(restingorder);
    }

    return {
        message: "Order Processed!!",
        remainingQty,
        incomingOrder
    }
}