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

// Add error handlers
io.engine.on("connection_error", (err) => {
    console.log("Connection error:", err.req);      // the request object
    console.log("Error message:", err.code);     // the error code
    console.log("Error message:", err.message);  // the error message
    console.log("Error context:", err.context);  // some additional error context
});

io.on('connection', (socket)=>{
    console.log(`socketID: ${socket.id}`);
    
    socket.on('connect_error', (error) => {
        console.log('Socket connect_error:', error);
    });

    socket.on('error', (error) => {
        console.log('Socket error:', error);
    });
});