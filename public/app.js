// Get references to DOM elements
const roomIdInput = document.getElementById('roomId');
const joinBtn = document.getElementById('joinBtn');
const songUrlInput = document.getElementById('songUrl');
const loadBtn = document.getElementById('loadBtn');
const audioPlayer = document.getElementById('audioPlayer');
const statusDiv = document.getElementById('status');
const currentRoomSpan = document.getElementById('currentRoom');
const roomControlsDiv = document.getElementById('room-controls');
const playerControlsDiv = document.getElementById('player-controls');
const playPauseBtn = document.getElementById('playPauseBtn');

let socket; // To hold the socket instance
let currentRoom = null; // To store the current room ID
let isPlaying = false; // Local state to track if the audio is playing
let songLoadInitiated = false;

/**
 * Connects to the Socket.IO server.
 */
function connectWebSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        statusDiv.textContent = 'Status: Connected. Enter Room ID.';
        joinBtn.disabled = false;
    });

    socket.on('message', (messageString) => {
        try {
            const data = JSON.parse(messageString);
            console.log('Message received from server:', data);

            switch (data.type) {
                case 'songChanged':
                    audioPlayer.src = data.payload.songUrl;
                    audioPlayer.load();
                    statusDiv.textContent = `Status: Loaded new song in room ${currentRoom}`;
                    isPlaying = false;
                    updatePlayPauseButton();
                    songLoadInitiated = true; // Set the flag after receiving the event
                    break;
                case 'play':
                    if (data.payload && typeof data.payload.time === 'number' && Math.abs(audioPlayer.currentTime - data.payload.time) > 0.2) {
                        audioPlayer.currentTime = data.payload.time;
                    }
                    audioPlayer.play().catch(error => {
                        console.error("Play error:", error);
                        statusDiv.textContent = `Status: Error playing.`;
                    });
                    isPlaying = true;
                    updatePlayPauseButton();
                    statusDiv.textContent = `Status: Playing in room ${currentRoom}`;
                    break;
                case 'pause':
                    audioPlayer.pause();
                    isPlaying = false;
                    updatePlayPauseButton();
                    statusDiv.textContent = `Status: Paused in room ${currentRoom}`;
                    break;
                case 'seek':
                    if (data.payload && typeof data.payload.time === 'number') {
                        audioPlayer.currentTime = data.payload.time;
                        statusDiv.textContent = `Status: Seeked to ${data.payload.time.toFixed(1)}s in room ${currentRoom}`;
                    } else {
                        console.warn("Received seek event without valid time data");
                    }
                    break;
                case 'receiveCurrentState':
                    if (data.payload && data.payload.songUrl) {
                        audioPlayer.src = data.payload.songUrl;
                        audioPlayer.load();
                        audioPlayer.currentTime = data.payload.currentTime || 0;
                        if (data.payload.isPlaying) {
                            audioPlayer.play().catch(error => console.error("Play error on sync:", error));
                            isPlaying = true;
                        } else {
                            isPlaying = false;
                        }
                        updatePlayPauseButton();
                        statusDiv.textContent = `Status: Synced with room ${currentRoom}`;
                        songLoadInitiated = true; // Set the flag after syncing
                    }
                    break;
                case 'userLeft':
                    console.log('Another user left the room.');
                    break;
            }
        } catch (e) {
            console.error('Failed to parse message from server:', messageString, e);
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        statusDiv.textContent = 'Status: Disconnected. Please refresh.';
        joinBtn.disabled = true;
        loadBtn.disabled = true;
        playerControlsDiv.style.display = 'none';
        roomControlsDiv.style.display = 'block';
        currentRoom = null;
    });

    socket.on('connect_error', (err) => {
        console.error("Connection Error:", err);
        statusDiv.textContent = 'Status: Connection error.';
        joinBtn.disabled = true;
        loadBtn.disabled = true;
    });
}

function sendMessage(type, payload) {
    if (socket && socket.connected) {
        const message = { type, payload };
        const messageString = JSON.stringify(message);
        console.log('Sending message:', message);
        socket.emit('message', messageString);
    } else {
        console.error('Socket is not connected. Cannot send message.');
        statusDiv.textContent = 'Error: Not connected to server.';
    }
}

function updatePlayPauseButton() {
    if (playPauseBtn) {
        playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
    }
}

// --- Event Listeners for UI Elements ---

joinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        currentRoom = roomId;
        sendMessage('joinRoom', { roomId });
        statusDiv.textContent = `Status: Joining room ${roomId}...`;
        currentRoomSpan.textContent = roomId;
        roomControlsDiv.style.display = 'none';
        playerControlsDiv.style.display = 'block';
        loadBtn.disabled = false;
    } else {
        alert('Please enter a Room ID.');
    }
});

loadBtn.addEventListener('click', () => {
    const songUrl = songUrlInput.value.trim();
    if (songUrl && currentRoom) {
        statusDiv.textContent = `Status: Loading ${songUrl}...`;
        songLoadInitiated = true; // Set the flag before loading
        sendMessage('changeSong', { roomId: currentRoom, songUrl });
    } else {
        alert('Please enter a valid Song URL.');
    }
});

if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        if (currentRoom) {
            if (isPlaying) {
                sendMessage('pause', { roomId: currentRoom });
            } else {
                sendMessage('play', { roomId: currentRoom, time: audioPlayer.currentTime });
            }
        }
    });
}

audioPlayer.addEventListener('seeked', () => {
    if (currentRoom) { // No need to check isUserAction anymore
        sendMessage('seek', { roomId: currentRoom, time: audioPlayer.currentTime });
        statusDiv.textContent = `Status: Seeked to ${audioPlayer.currentTime.toFixed(1)}s`;
    }
});

audioPlayer.addEventListener('ended', () => {
    statusDiv.textContent = `Status: Song ended`;
    isPlaying = false;
    updatePlayPauseButton();
    // Optional: Send a 'songEnded' message if needed
    // if (currentRoom) {
    //     sendMessage('songEnded', { roomId: currentRoom });
    // }
});

audioPlayer.addEventListener('error', (e) => {
    if (songLoadInitiated) { // Only show error if a load was attempted
        statusDiv.textContent = `Status: Error loading/playing audio. Check URL and CORS policy.`;
        console.error('Audio player error:', e);
        alert(`Error playing audio. Check the URL or if the source allows direct linking (CORS).`);
        isPlaying = false;
        updatePlayPauseButton();
        songLoadInitiated = false; // Reset the flag
    } else {
        console.warn('Audio player error occurred before a song was loaded:', e);
    }
});

audioPlayer.addEventListener('play', () => {
    // We send the play event on button click now
    isPlaying = true;
    updatePlayPauseButton();
});

audioPlayer.addEventListener('pause', () => {
    // We send the pause event on button click now
    isPlaying = false;
    updatePlayPauseButton();
});

// --- Initial Setup ---
joinBtn.disabled = true;
loadBtn.disabled = true;
playerControlsDiv.style.display = 'none';
connectWebSocket();