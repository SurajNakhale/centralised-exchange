import { createClient } from "redis";
import { activeSubscriptions } from ".";

const redisClient = createClient({url: process.env["REDIS_URL"]})
await redisClient.connect();

const id = crypto.randomUUID()
const stream_name = "market-data";
const group_name = `cgroup-1`;
const consumer_name = `ws-1`;

const block = 10000;
const count = 1;

async function createConsumerGroup(){

    try{
        await redisClient.xGroupCreate(stream_name, group_name, 
            "0", 
    // "0" → consume existing + future events
    // "$" → consume future events only
                {
                MKSTREAM: true // create stream if missing but
                                //  my engine already produce the stream i.e market-data
            }
        )
    
        console.log("consumer group created: ", group_name)
    }
    catch(err: any){
        console.log(err.message);
    }
}

await createConsumerGroup();
while(true){
    const result = await redisClient.xReadGroup(group_name, consumer_name, 
        { 
            key: stream_name, 
            id: ">"
        }, 
        {   
            COUNT: count,   
            BLOCK: block
        }
    )
    
    for (const stream of result ?? []) {
        for (const message of stream.messages) {
           const eventId = message.id;
            processData(message);
    
            const acked = await redisClient.xAck("market-data", group_name, eventId)
            console.log("ACK:", message.id, acked);
        }
    }
}

function processData(message: any){
    
    const event = message.message;
    const topic = event.topic;
    const data = JSON.parse(event.data);

    activeSubscriptions[topic]?.forEach(x => 
        x.send(JSON.stringify({
            type: event.topic,
            topic,
            data
        }))
    )

    console.dir(data, { depth: null });
}


