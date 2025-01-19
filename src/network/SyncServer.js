const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const crypto = require('node:crypto');
const chalk = require('chalk');

class SyncServer {
    constructor(options) {
        const { host, port } = options;
        this.server = http.createServer((req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*'); // Set the specific origin
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Access-Control-Allow-Credentials', 'true');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            this.app(req, res);
        });

        this.io = socketIO(this.server, {
            cors: {
                origin: '*', // Set the specific origin
                methods: ['GET', 'POST'],
                allowedHeaders: ['Content-Type'],
                credentials: false // Disable credentials
            }
        });

        this.files = new Map();
        this.clientFiles = new Map();

        this.server.listen(port, host, () => {
            console.log(chalk.green(`[Server] Started on ${host}:${port}`));
            this.setupServer();
        });
    }

    app(req, res) {
        // Basic server logic
        if (req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.write('FlashLink Sync Server');
            res.end();
        } else {
            res.writeHead(404);
            res.end();
        }
    }

    setupServer() {
        this.io.on('connection', (socket) => {
            const clientId = crypto.randomUUID();
            console.log(chalk.blue(`[Server] New client connected: ${clientId}`));
            
            socket.on('message', (data) => {
                console.log(chalk.yellow(`[Server] Received message type: ${data.type} from client: ${clientId}`));
                this.handleMessage(clientId, socket, data);
            });

            socket.on('disconnect', () => {
                console.log(chalk.red(`[Server] Client disconnected: ${clientId}`));
                this.handleClientDisconnect(clientId);
            });
        });
    }

    handleMessage(clientId, socket, message) {
        switch (message.type) {
            case 'register':
                console.log(chalk.blue(`[Server] Client ${clientId} registering for file: ${message.filePath}`));
                this.registerClient(clientId, socket, message.filePath);
                break;
                
            case 'changes':
                console.log(chalk.yellow(`[Server] Received changes from client ${clientId}`));
                this.broadcastChanges(clientId, message.changes);
                break;
                
            case 'sync_request':
                console.log(chalk.blue(`[Server] Sync request from client ${clientId}`));
                this.sendCurrentState(clientId, socket);
                break;
        }
    }

    registerClient(clientId, socket, filePath) {
        // Normalize file path for cross-platform compatibility
        const normalizedPath = path.normalize(filePath);
        
        // Set up file tracking if this is the first client for this file
        if (!this.files.has(normalizedPath)) {
            this.files.set(normalizedPath, {
                clients: new Map(),
                currentState: null,
                changeHistory: []
            });
        }
        
        // Add client to file's client list
        this.files.get(normalizedPath).clients.set(clientId, socket);
        
        // Track which file this client is working on
        this.clientFiles.set(clientId, normalizedPath);
        
        // Notify client of successful registration
        socket.emit('message', {
            type: 'registered',
            filePath: normalizedPath
        });
        
        // Send current file state to new client
        this.sendCurrentState(clientId, socket);
    }

    sendCurrentState(clientId, socket) {
        const filePath = this.clientFiles.get(clientId);
        if (!filePath) return;
        
        const fileData = this.files.get(filePath);
        if (!fileData) return;
        
        socket.emit('message', {
            type: 'current_state',
            state: fileData.currentState,
            history: fileData.changeHistory
        });
    }

    broadcastChanges(senderId, changes) {
        const filePath = this.clientFiles.get(senderId);
        if (!filePath) return;
        
        const fileData = this.files.get(filePath);
        if (!fileData) return;
        
        // Update current state
        fileData.currentState = changes;
        fileData.changeHistory.push({
            timestamp: Date.now(),
            clientId: senderId,
            changes
        });
        
        // Broadcast to all other clients working on this file
        const message = {
            type: 'changes',
            changes,
            senderId
        };
        
        for (const [clientId, socket] of fileData.clients.entries()) {
            if (clientId !== senderId) {
                socket.emit('message', message);
            }
        }
    }

    getFileClients(filePath) {
        const normalizedPath = path.normalize(filePath);
        const fileData = this.files.get(normalizedPath);
        return fileData ? Array.from(fileData.clients.keys()) : [];
    }

    getClientCount(filePath) {
        const normalizedPath = path.normalize(filePath);
        const fileData = this.files.get(normalizedPath);
        return fileData ? fileData.clients.size : 0;
    }

    close() {
        this.io.close();
        this.server.close();
    }
}

module.exports = SyncServer;