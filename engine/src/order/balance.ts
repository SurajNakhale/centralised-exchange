import { getUserWallet } from "../deposit/helperBalance";

export function getUserBalance(payload: Record<string, unknown>){
    const userId = payload as unknown as string;

    const userWallet = getUserWallet(userId);
    return userWallet;
}