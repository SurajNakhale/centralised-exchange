import { getUserWallet } from "../deposit/helperBalance";

export function getUserBalance(payload: Record<string, unknown>){
    const userId = payload.userId as string;
    
    const userWallet = getUserWallet(userId);
    
    console.log(userWallet)
    return userWallet;
}