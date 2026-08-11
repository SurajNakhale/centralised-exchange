import WebSocket, { WebSocketServer } from "ws";

const wss = new WebSocketServer({port: 8080});

//"trade.SOL_USDT" -> [socket1, socket2]
export const activeSubscriptions: Record<string, Set<WebSocket>> = {};

wss.on("connection", (socket) => {
    
    socket.on("message", (data) => {
        
        // {method: "SUBSCRIBE", params: ["trade.SOL_USDC", "depth.SOL_USDC"]}
        const parsedMsg = JSON.parse(data.toString());


        if(parsedMsg.method == "SUBSCRIBE"){
            parsedMsg.params.forEach((param: string) => {
                if(!activeSubscriptions[param]){
                    activeSubscriptions[param] = new Set();
                }
                activeSubscriptions[param].add(socket);
            })
        }

        if(parsedMsg.method == "UNSUBSCRIBE"){
            parsedMsg.params.forEach((param: string) => {
                activeSubscriptions[param]?.delete(socket);


                if (activeSubscriptions[param]?.size === 0) {
                    delete activeSubscriptions[param];
                }
            })
        }
        
    })

    socket.on("close", () => {
        Object.values(activeSubscriptions).forEach(x => 
            x.delete(socket)
        )
    })
})