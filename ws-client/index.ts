import axios from "axios";
import WebSocket from "ws";

type orderBook = {
    bids: Record<string, string>, //key: price value: qty
    asks: Record<string, string>,
}

const ORDERBOOK: orderBook = {
    bids: {},
    asks: {}
}

type buffer = {
    recvAsks: [[string, string]],
    recvBids: [[string, string]],
    startOffset: number,
    endOffset: number
}
const ws = new WebSocket("wss://ws.backpack.exchange/")
let BUFFER: buffer[] = [];
let conInit = false;

function updateOrderBook(recvAsks: [string, string][], recvBids: [string, string][]){
    if(!recvAsks || !recvBids) return;

    recvAsks.forEach(([price , qty]: [string, string]) => {
        ORDERBOOK.asks[price] = qty;
    })
    recvBids.forEach(([price , qty]: [string, string]) => {
        ORDERBOOK.bids[price] = qty;
    })
}
ws.onmessage = (msg) => {
    const parsedMsg = JSON.parse(msg.data.toString());

    const recvAsks = parsedMsg.a;
    const recvBids = parsedMsg.b;
    const startOffset = parsedMsg.U;
    const endOffset = parsedMsg.u;

    if(!conInit){
        BUFFER.push({recvAsks, recvBids, startOffset, endOffset});
    }
    else{
        updateOrderBook(recvAsks, recvBids);
    }

}

ws.onopen = async () => {
    ws.send(JSON.stringify({"method":"SUBSCRIBE","params":["trade.SOL_USDC","bookTicker.SOL_USDC","depth.200ms.SOL_USDC"],"id":"1"}))

    const res = await axios.get("https://api.backpack.exchange/api/v1/depth?symbol=SOL_USDC");
    const {asks, bids, lastUpdatedId} = res.data;

    //push ask and bid response to the inmemory orderbook
    asks.forEach(([price, qty]: [string, string]) => {
        ORDERBOOK.asks[price] = qty;
    });

    bids.forEach(([price, qty]: [string, string]) => {
        ORDERBOOK.bids[price] = qty;
    });
    conInit = true;

    const expected = lastUpdatedId + 1;

    BUFFER.forEach(msg => {
        if(msg.endOffset < expected){
            return;
        }

        if(msg.startOffset > expected){
            throw new Error("gap detected, restart");
        }

        updateOrderBook(msg.recvAsks, msg.recvBids);
    })

    let cnt = 0;

    setInterval(() => {
        const bestAsk = Object.keys(ORDERBOOK.asks).sort((a, b) => Number(a) - Number(b)); // smallest
        const bestBid = Object.keys(ORDERBOOK.bids).sort((a, b) => Number(b) - Number(a)); // largest


        console.log("------------------------------------------------------------");
        cnt++;
        console.log(cnt);
        console.log("best ask: ", bestAsk[0]?.toString())
        console.log("best bid:", bestBid[0]?.toString())
    }, 1000)

}