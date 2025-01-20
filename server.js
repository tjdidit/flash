const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// Store active documents and their connected clients
const documents = new Map(); // Map<documentPath, Set<socketId>>
const clientDocuments = new Map(); // Map<socketId, documentPath>

// Socket.IO error handlers
io.engine.on("connection_error", (err) => {
    console.log("Connection error:", err.req);
    console.log("Error message:", err.code);
    console.log("Error message:", err.message);
    console.log("Error context:", err.context);
});

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    socket.on('message', (data) => {
        handleMessage(socket, data);
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });

    socket.on('error', (error) => {
        console.log('Socket error:', error);
    });
});

function handleMessage(socket, data) {
    switch (data.type) {
        case 'register':
            registerDocument(socket, data.filePath);
            break;
        case 'changes':
            broadcastChanges(socket, data.changes);
            break;
    }
}

function registerDocument(socket, documentPath) {
    // Remove client from previous document if any
    const previousDoc = clientDocuments.get(socket.id);
    if (previousDoc) {
        const docClients = documents.get(previousDoc);
        if (docClients) {
            docClients.delete(socket.id);
            if (docClients.size === 0) {
                documents.delete(previousDoc);
            }
        }
    }

    // Add client to new document
    if (!documents.has(documentPath)) {
        documents.set(documentPath, new Set());
    }
    documents.get(documentPath).add(socket.id);
    clientDocuments.set(socket.id, documentPath);

    // Join socket room for this document
    socket.join(documentPath);

    // Notify client of successful registration
    socket.emit('message', {
        type: 'registered',
        filePath: documentPath
    });

    console.log(`Client ${socket.id} registered to document: ${documentPath}`);
}

function broadcastChanges(socket, changes) {
    const documentPath = clientDocuments.get(socket.id);
    if (!documentPath) {
        console.log('Client not registered to any document');
        return;
    }

    // Broadcast changes to all clients in the document except sender
    socket.to(documentPath).emit('message', {
        type: 'changes',
        changes: changes,
        senderId: socket.id
    });

    console.log(`Broadcasting changes from ${socket.id} to document ${documentPath}`);
}

function handleDisconnect(socket) {
    const documentPath = clientDocuments.get(socket.id);
    if (documentPath) {
        const docClients = documents.get(documentPath);
        if (docClients) {
            docClients.delete(socket.id);
            if (docClients.size === 0) {
                documents.delete(documentPath);
            }
        }
    }
    clientDocuments.delete(socket.id);
    console.log(`Client disconnected: ${socket.id}`);
}

http.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

app.get('/', (req, res) => {
    res.send('Flash Sync Server Running');
});