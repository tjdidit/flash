const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

http.listen(PORT, ()=>{
    console.log(`listening on port ${PORT}`);
}); 

app.get('/', (req, res)=> {
    console.log('Got a web request');
    res.send('hello world!');
});

io.on('connection', (socket)=>{
    console.log(`New client connected!`);
    console.log(`socketID: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });

    socket.on('message', (data) => {
        console.log(`Received message from ${socket.id}:`, data);
        // Broadcast to other clients
        socket.broadcast.emit('message', {
            ...data,
            senderId: socket.id
        });
    });
});

// Log when server starts
console.log('Starting server...');