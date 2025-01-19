const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

http.listen(PORT, ()=>{
	console.log(`listening on port ${PORT}`);
}); 

app.get('/', (req, res)=> {
	res.send('hello world!');
});

io.on('connection', (socket)=>{
	console.log(`socketID: ${socket.id}`);

});