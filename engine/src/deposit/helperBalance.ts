import Decimal from "decimal.js";
import { BALANCES } from "../types/exchange-store";


export function getUserWallet(userId: string){
    let userWallet = BALANCES.get(userId);

    if(!userWallet){
        userWallet = {};
        BALANCES.set(userId, userWallet);
    }

    return userWallet!;
}

export function getUserAsset(userId: string, asset: string){
    const userAsset = getUserWallet(userId);

    if(!userAsset[asset]){
        userAsset[asset] = {
            available: new Decimal(0),
            locked: new Decimal(0)
        }
    }

    return userAsset[asset]!;
}

