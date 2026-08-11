import Decimal from "decimal.js";
import { getUserAsset } from "./helperBalance";


export function depositMoney(payload: Record<string, unknown>){
    const userId = payload.userId as string;
    const asset = payload.asset as string;
    const amount = new Decimal(payload.amount as string)


    const userAsset = getUserAsset(userId, asset);
    userAsset.available = userAsset.available.plus(amount);

    return {
        userId,
        asset,
        userAsset
    }
}