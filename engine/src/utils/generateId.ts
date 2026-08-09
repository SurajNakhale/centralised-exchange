import { ORDERBOOKS_SEQUENCE, TRADE_ID } from "../types/exchange-store";

export function getNextUpdateId(symbol: string){
    const current = ORDERBOOKS_SEQUENCE.get(symbol) ?? 0;
    const next = current + 1;

    ORDERBOOKS_SEQUENCE.set(symbol, next);
    return next;
}

export function getNextTradeId(symbol: string){
    const current = TRADE_ID.get(symbol) ?? 0;
    const next = current + 1;

    TRADE_ID.set(symbol, next);
    return next;
}