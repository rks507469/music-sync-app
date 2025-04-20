const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map(); // roomId => Set of Sockets
const roomStates = new Map(); // roomId => { songUrl: string, currentTime: number, isPlaying: boolean }

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received message:', data);

            switch (data.type) {
                case 'joinRoom':
                    handleJoinRoom(socket, data.payload.roomId);
                    break;
                case 'changeSong':
                    handleChangeSong(socket, data.payload.roomId, data.payload.songUrl);
                    broadcast(socket, data);
                    break;
                case 'play':
                    handlePlay(socket, data.payload.roomId, data.payload.time);
                    broadcast(socket, data);
                    break;
                case 'pause':
                    handlePause(socket, data.payload.roomId);
                    broadcast(socket, data);
                    break;
                case 'seek':
                    handleSeek(socket, data.payload.roomId, data.payload.time);
                    broadcast(socket, data);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Failed to parse message:', message, error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        handleDisconnect(socket);
    });

    socket.on('error', (err) => {
        console.error('Socket error:', err);
        handleDisconnect(socket);
    });
});

function handleJoinRoom(socket, roomId) {
    if (socket.roomId) {
        socket.leave(socket.roomId);
        removeFromRoomMap(socket, socket.roomId);
    }

    socket.join(roomId);
    socket.roomId = roomId;
    addToRoomMap(socket, roomId);

    // Send current room state to the new client
    const currentState = roomStates.get(roomId);
    if (currentState) {
        socket.emit('message', JSON.stringify({
            type: 'receiveCurrentState',
            payload: currentState
        }));
    } else {
        // If no state exists yet, initialize with an empty state
        roomStates.set(roomId, { songUrl: '', currentTime: 0, isPlaying: false });
    }

    // Notify other clients about the new joiner (optional)
    socket.to(roomId).emit('message', JSON.stringify({
        type: 'userJoined',
        payload: { userId: socket.id }
    }));

    console.log(`Client ${socket.id} joined room: ${roomId}. Room size: ${io.sockets.adapter.rooms.get(roomId)?.size || 0}`);
}

function handleLeaveRoom(socket) {
    if (socket.roomId) {
        socket.leave(socket.roomId);
        removeFromRoomMap(socket, socket.roomId);
        delete socket.roomId;

        // Notify other clients about the departure (optional)
        socket.to(socket.roomId).emit('message', JSON.stringify({
            type: 'userLeft',
            payload: { userId: socket.id }
        }));
    }
}

function handleDisconnect(socket) {
    handleLeaveRoom(socket);
}

function addToRoomMap(socket, roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket);
}

function removeFromRoomMap(socket, roomId) {
    if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.delete(socket);
        if (room.size === 0) {
            rooms.delete(roomId);
            roomStates.delete(roomId); // Clean up room state if empty
            console.log(`Room ${roomId} removed as it's empty.`);
        }
    }
}

function handleChangeSong(socket, roomId, songUrl) {
    roomStates.set(roomId, { songUrl, currentTime: 0, isPlaying: false });
    console.log(`Room ${roomId} song changed to: ${songUrl}`);
}

function handlePlay(socket, roomId, time) {
    const currentState = roomStates.get(roomId);
    if (currentState) {
        currentState.isPlaying = true;
        currentState.currentTime = time;
    }
    console.log(`Room ${roomId} playing at: ${time}`);
}

function handlePause(socket, roomId) {
    const currentState = roomStates.get(roomId);
    if (currentState) {
        currentState.isPlaying = false;
    }
    console.log(`Room ${roomId} paused`);
}

function handleSeek(socket, roomId, time) {
    const currentState = roomStates.get(roomId);
    if (currentState) {
        currentState.currentTime = time;
    }
    console.log(`Room ${roomId} seeked to: ${time}`);
}

function broadcast(senderSocket, data) {
    const roomId = senderSocket.roomId;
    if (roomId) {
        const messageString = JSON.stringify(data);
        // Use io.to(roomId).emit() to include the sender
        io.to(roomId).emit('message', messageString);
        console.log(`Broadcasting to ALL clients in room ${roomId}:`, data);
    } else {
        console.log(`Cannot broadcast: client ${senderSocket.id} is not in a room.`);
    }
}


app.get('/audio-proxy', async (req, res) => {
    const audioUrl = req.query.url;
    if (!audioUrl) {
        return res.status(400).send('Missing audio URL');
    }

    try {
        const response = await fetch(audioUrl);
        if (!response.ok) {
            return res.status(response.status).send(`Error fetching audio: ${response.statusText}`);
        }
        res.setHeader('Content-Type', response.headers.get('Content-Type'));
        // Set CORS headers to allow your client's origin
        res.setHeader('Access-Control-Allow-Origin', '*'); // Or your specific origin
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        response.body.pipe(res);
    } catch (error) {
        console.error('Error proxying audio:', error);
        res.status(500).send('Error proxying audio');
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});