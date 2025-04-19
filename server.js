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

// socket io connection logic