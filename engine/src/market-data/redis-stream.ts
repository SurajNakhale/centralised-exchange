import { marketDataClient } from "..";

export interface Ievent{
    type: "depth" | "trade",
    topic: string,
    data: unknown
}

export async function publishToEventStream(event: Ievent){

    const id = await marketDataClient.xAdd("market-data", "*",
        {
            type: event.type,
            topic: event.topic,
            data: JSON.stringify(event.data)
        }
    )

    return id
}
