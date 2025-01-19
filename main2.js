const path = require('path');
const os = require('os');
const fs = require('fs').promises;  // Added this
const { program } = require('commander');
const AnimateShadowSync = require('./src/core/AnimateShadowSync');
const SyncServer = require('./src/network/SyncServer');
const ClientConnection = require('./src/network/ClientConnection');
// Add required packages to package.json:
// "commander": "^11.0.0"
// "chalk": "^4.1.2" (using v4 for CommonJS compatibility)
const chalk = require('chalk');

class AnimateCollabApp {
    constructor() {
        this.sync = null;
        this.server = null;
        this.client = null;
        this.isServer = false;
    }

    async initialize() {
        // Set up command line interface
        program
            .name('animate-collab')
            .description('Real-time collaboration for Adobe Animate files')
            .version('1.0.0');

        program
            .option('-s, --server', 'Run as server')
            .option('-p, --port <number>', 'Port number for server/client', '3000')
            .option('-h, --host <string>', 'Host address for client', 'localhost')
            .option('-f, --file <path>', 'Path to FLA file')
            .parse();

        const options = program.opts();

        try {
            if (options.server) {
                await this.startServer(options.port);
            } else if (options.file) {
                await this.startClient(options);
            } else {
                console.error(chalk.red('Error: Must specify either --server or --file'));
                process.exit(1);
            }
        } catch (error) {
            console.error(chalk.red('Initialization error:', error.message));
            process.exit(1);
        }
    }

    async startServer(port) {
    console.log(chalk.blue('Starting sync server...'));
    this.isServer = true;
    
    // Listen on all interfaces
    this.server = new SyncServer({
        host: '0.0.0.0',  // This makes it listen on all interfaces
        port: parseInt(port)
    });

    // Display available IP addresses
    const networkInterfaces = os.networkInterfaces();
    console.log(chalk.yellow('Server IP addresses:'));
    Object.keys(networkInterfaces).forEach((interfaceName) => {
        networkInterfaces[interfaceName].forEach((netInterface) => {
            if (netInterface.family === 'IPv4' && !netInterface.internal) {
                console.log(chalk.cyan(`  ${interfaceName}: ${netInterface.address}`));
            }
        });
    });

    console.log(chalk.green(`Server running on port ${port}`));
}
    async startClient(options) {
        const { file, host, port } = options;

        // Validate file path
        if (!file) {
            console.error(chalk.red('Error: FLA file path is required'));
            process.exit(1);
        }

        const flaPath = path.resolve(file);
        console.log(chalk.blue(`Initializing sync for ${flaPath}`));

        try {
            // Initialize shadow sync
            this.sync = new AnimateShadowSync();
            await this.sync.initializeShadowCopy(flaPath);
            console.log(chalk.green('Shadow copy created successfully'));

            // Connect to sync server
            this.client = new ClientConnection(`ws://${host}:${port}`);
            await this.client.connect();
            console.log(chalk.green(`Connected to sync server at ${host}:${port}`));

            // Set up change handlers
            this.client.on('changes', async (changes) => {
                try {
                    await this.sync.queueChanges(changes);
                    await this.sync.synchronizeWithMain();
                    console.log(chalk.yellow('Received and applied changes'));
                } catch (error) {
                    console.error(chalk.red('Error applying changes:', error.message));
                }
            });

            // Watch for local changes
            this.sync.on('changes', async (changes) => {
                try {
                    this.client.send({
                        type: 'changes',
                        data: changes
                    });
                    console.log(chalk.yellow('Local changes detected and sent'));
                } catch (error) {
                    console.error(chalk.red('Error sending changes:', error.message));
                }
            });

            console.log(chalk.green('Sync system initialized and running'));
            console.log(chalk.blue('Press Ctrl+C to exit'));

            // Handle shutdown gracefully
            process.on('SIGINT', () => this.cleanup());
            process.on('SIGTERM', () => this.cleanup());

        } catch (error) {
            console.error(chalk.red('Error starting client:', error.message));
            process.exit(1);
        }
    }

    async cleanup() {
        console.log(chalk.blue('\nShutting down...'));
        
        try {
            if (this.sync) {
                await this.sync.cleanup();
            }
            
            if (this.client) {
                this.client.close();
            }
            
            if (this.server) {
                this.server.close();
            }
            
            console.log(chalk.green('Cleanup completed'));
            process.exit(0);
        } catch (error) {
            console.error(chalk.red('Error during cleanup:', error.message));
            process.exit(1);
        }
    }
}

// Start the application
const app = new AnimateCollabApp();
app.initialize().catch(error => {
    console.error(chalk.red('Fatal error:', error.message));
    process.exit(1);
});