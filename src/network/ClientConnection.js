const socketIO = require('socket.io-client');
const chalk = require('chalk');

class ClientConnection {
  constructor(url = 'http://localhost:3000') {
    this.url = url;
    this.socket = null;
    this.handlers = new Map();
  }

  connect() {
    console.log(chalk.blue(`[Client] Connecting to ${this.url}`));
    this.socket = socketIO(this.url);
    
    this.socket.on('message', (message) => {
      console.log(chalk.yellow(`[Client] Received message type: ${message.type}`));
      const handler = this.handlers.get(message.type);
      if (handler) {
        handler(message);
      }
    });

    return new Promise((resolve, reject) => {
      this.socket.on('connect', () => {
        console.log(chalk.green('[Client] Connected to server'));
        resolve();
      });
      this.socket.on('connect_error', (error) => {
        console.error(chalk.red('[Client] Connection error:', error));
        reject(error);
      });
    });
  }

  on(type, handler) {
    this.handlers.set(type, handler);
  }

  send(message) {
    if (this.socket) {
      this.socket.emit('message', message);
    }
  }

  close() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

module.exports = ClientConnection;