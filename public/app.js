// Connect to the Socket.IO server (it defaults to the same host/port)
const socket = io();

socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
    // Enable join button, etc.
});

// ====> TODO: Add your event listeners and emitters here <====
// Example: joinBtn.addEventListener('click', () => { socket.emit('joinRoom', roomId); });
// Example: socket.on('play', (data) => { audioPlayer.play(); });

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    // Disable controls, show message, etc.
});

socket.on('connect_error', (err) => {
    console.error("Connection Error:", err);
    // Show error message
});