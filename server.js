const WebSocket = require('ws');
const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs');

const PORT = 3000;

const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
}

const app = express();
const server = https.createServer(options, app);
const wss = new WebSocket.Server({server});

const clients = new Set()

wss.on('connection', (ws) =>{
    console.log('client connected');
    clients.add(ws);

    console.log("CLIENTS")
    console.table(clients);

    ws.on('message', async (message) => {
        console.log("MESSAGE");
        for(const client of clients){
            if(client !== ws && client.readyState === WebSocket.OPEN){
                client.send(message);
            }
        }
    });

    ws.on('close', () => {
        console.log('client disconnected');
        clients.delete(ws);

        console.log('CLIENTS');
        console.table(clients);
    });
});

app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, () => console.log(`server is running at https://localhost:${PORT}`))

function closeServer() {
	console.log("Shutting down the server...");
	
	server.close( error => {
		if(error){
            console.log("ERROR: ", err);
            process.exit(1);
        }

        console.log("Server Closed.");
        process.exit(0);
    });
}

process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);
