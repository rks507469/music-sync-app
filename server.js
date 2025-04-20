const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const path = require('path');

// creating an express application
const app = express();
// creating an http server
const server = http.createServer(app);
// attaching socket io to the http server
const io = new Server(server);

// picking port from the env
const PORT = process.env.PORT || 3000;

// using public directory to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// rooms
const rooms = new Map();

// socket io connection logic
io.on('connection', (socket) => {
    console.log('A client connected with socket id: ', socket.id);

    // Add custom event listeners here for specific needs
    socket.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log("Received Data : ", data);

            switch(data.type) {
                case 'joinRoom':
                    handleJoinRooms(socket, data.payload.roomId);
                    break;
                
                case 'changeSong':
                case 'play':
                case 'pause':
                case 'seek':
                    broadcast(socket, data);
                    break;

                default:
                    console.log('Unknown message type: ', data.type);
            }
        } catch (err) {
            console.error('Faild to parse message: ', message, e);
        }
    });


    // disconnection handeling
    socket.on('disconnect', () => {
        console.log('Client Disconnected: ', socket.id);
        handleDisconnects(socket);
    });

    // error handling
    socket.on('error', (err) => {
        console.error('Socket error: ', err);
        handleDisconnects(socket);
    });
});

// handle handle Join Rooms function
function handleJoinRooms(socket, roomId) {
    // remove the client if he is present in any other room
    handleDisconnects(socket);

    // assigning to a new roomId
    socket.roomId = roomId;

    if(!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
        console.log(`Room created ${roomId}`);
    }

    rooms.get(roomId).add(socket);
    console.log(`Client joined the room: ${roomId}. Room size ${rooms.get(roomId).size}`);
}

// handle disconnects function
function handleDisconnects(socket) {
    // get the room id and check if it is present
    const roomId = socket.roomId;
    if(roomId && rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(socket);
        console.log(`Client left the room: ${roomId}. Room size: ${room.size}`);
    

        // if room becomes empty delete it
        if(room.size === 0) {
            rooms.delete(roomId);
            console.log(`Room deleted: ${roomId}`);
        } else {
            // notify others in the room
            broadcast(socket, {type: 'userLeft'})
        }
    }
    socket.roomId = null;
}

// Broadcasts a message to all clients in the sender's room, excluding the sender
function broadcast(senderSocket, data) {
    const roomId = senderSocket.roomId;
    if(!roomId || !rooms.has(roomId)) {
        console.warn(`Cannot broadcast: Client not in room or room does not exist.`);
        return;
    }

    const room = rooms.get(roomId);
    const messageString = JSON.stringify(data);

    console.log(`Broadcasting to room ${roomId} (size ${room.size}): `, data);

    room.forEach(client => {
        if(client != senderSocket && client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}



// server starter logic
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});