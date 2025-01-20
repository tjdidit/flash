const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// Track active documents and their clients
const documents = new Map();  // documentPath -> Set of socket IDs
const clientDocuments = new Map();  // socketId -> documentPath

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    socket.on('message', (data) => {
        if (data.type === 'register') {
            handleRegister(socket, data.filePath);
        }
        else if (data.type === 'changes') {
            broadcastChanges(socket, data);
        }
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });
});

function handleRegister(socket, filePath) {
    // Remove from previous document if any
    if (clientDocuments.has(socket.id)) {
        const oldPath = clientDocuments.get(socket.id);
        const oldDoc = documents.get(oldPath);
        if (oldDoc) {
            oldDoc.delete(socket.id);
            if (oldDoc.size === 0) {
                documents.delete(oldPath);
            }
        }
    }

    // Add to new document
    if (!documents.has(filePath)) {
        documents.set(filePath, new Set());
    }
    documents.get(filePath).add(socket.id);
    clientDocuments.set(socket.id, filePath);

    // Confirm registration
    socket.emit('message', {
        type: 'registered',
        filePath: filePath
    });

    console.log(`Client ${socket.id} registered to ${filePath}`);
    console.log('Current documents:', Array.from(documents.entries()));
}

function broadcastChanges(socket, data) {
    const filePath = clientDocuments.get(socket.id);
    if (!filePath) {
        console.log('Client not registered to any document');
        return;
    }

    const recipients = documents.get(filePath);
    if (!recipients) {
        console.log('No recipients found for document');
        return;
    }

    // Broadcast to all clients in the same document except sender
    recipients.forEach(recipientId => {
        if (recipientId !== socket.id) {
            console.log(`Broadcasting from ${socket.id} to ${recipientId}`);
            io.to(recipientId).emit('message', {
                type: 'changes',
                changes: data.changes,
                senderId: socket.id
            });
        }
    });
}

function handleDisconnect(socket) {
    console.log(`Client disconnected: ${socket.id}`);
    
    const filePath = clientDocuments.get(socket.id);
    if (filePath) {
        const doc = documents.get(filePath);
        if (doc) {
            doc.delete(socket.id);
            if (doc.size === 0) {
                documents.delete(filePath);
            }
        }
    }
    clientDocuments.delete(socket.id);
}

http.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

app.get('/', (req, res) => {
    res.send('Flash Sync Server Running');
});