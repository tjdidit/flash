const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

// Store active documents and their connected clients
const documents = new Map(); // Map<documentPath, Set<socketId>>
const clientDocuments = new Map(); // Map<socketId, documentPath>

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    socket.on('message', (data) => {
        console.log(`Received message from ${socket.id}:`, JSON.stringify(data));
        
        switch (data.type) {
            case 'register':
                handleRegister(socket, data);
                break;
            case 'stateChange':
                // Direct state change handling
                handleStateChange(socket, data);
                break;
            case 'changes':
                // Wrapped changes handling
                handleChanges(socket, data);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });
});

function handleRegister(socket, data) {
    const documentPath = data.filePath;
    console.log(`Registering client ${socket.id} for document ${documentPath}`);

    // Remove from previous document if any
    const previousDoc = clientDocuments.get(socket.id);
    if (previousDoc) {
        const docClients = documents.get(previousDoc);
        if (docClients) {
            docClients.delete(socket.id);
        }
    }

    // Add to new document
    if (!documents.has(documentPath)) {
        documents.set(documentPath, new Set());
    }
    documents.get(documentPath).add(socket.id);
    clientDocuments.set(socket.id, documentPath);

    // Join socket room
    socket.join(documentPath);

    // Confirm registration
    socket.emit('message', {
        type: 'registered',
        filePath: documentPath
    });

    console.log(`Client ${socket.id} registered to ${documentPath}`);
    console.log('Current documents:', Array.from(documents.entries()));
    console.log('Current clients:', Array.from(clientDocuments.entries()));
}

function handleStateChange(socket, changes) {
    const documentPath = clientDocuments.get(socket.id);
    if (!documentPath) {
        console.log(`Client ${socket.id} not registered to any document`);
        return;
    }

    console.log(`Broadcasting state change from ${socket.id} to document ${documentPath}`);
    
    // Wrap the state change in our message format
    const message = {
        type: 'changes',
        changes: changes,
        senderId: socket.id
    };

    // Broadcast to all clients in the document except sender
    socket.to(documentPath).emit('message', message);
}

function handleChanges(socket, data) {
    const documentPath = clientDocuments.get(socket.id);
    if (!documentPath) {
        console.log(`Client ${socket.id} not registered to any document`);
        return;
    }

    console.log(`Broadcasting changes from ${socket.id} to document ${documentPath}`);
    
    // Forward the changes message
    socket.to(documentPath).emit('message', {
        type: 'changes',
        changes: data.changes,
        senderId: socket.id
    });
}

function handleDisconnect(socket) {
    console.log(`Client disconnected: ${socket.id}`);
    
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
}

http.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

app.get('/', (req, res) => {
    res.send('Flash Sync Server Running');
});