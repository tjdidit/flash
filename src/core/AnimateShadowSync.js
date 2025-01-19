const AdmZip = require('adm-zip');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('node:crypto');
const EventEmitter = require('events');
const chalk = require('chalk');
const { ensureDir, getUserId } = require('../utils/fileUtils');
const { parseXML } = require('../utils/xmlDiff');
const { trackAssets } = require('../utils/assetTracker');
class AnimateShadowSync extends EventEmitter {
    constructor() {
        super();
        this.mainFilePath = null;
        this.shadowFilePath = null;
        this.documentStructure = null;
        this.libraryAssets = null;
        this.changeQueue = [];
        this.watcher = null;
    }

    async extractAndParse() {
        console.log(chalk.blue('[Shadow] Extracting and parsing FLA structure'));
        
        try {
            const zip = new AdmZip(this.shadowFilePath);
            const entries = zip.getEntries();

            // Initialize document structure
            this.documentStructure = {};

            // Look for and parse key XML files
            for (const entry of entries) {
                if (entry.entryName === 'DOMDocument.xml') {
                    console.log(chalk.yellow('[Shadow] Parsing DOMDocument.xml'));
                    this.documentStructure.dom = await parseXML(entry.getData());
                }
                else if (entry.entryName === 'PublishSettings.xml') {
                    console.log(chalk.yellow('[Shadow] Parsing PublishSettings.xml'));
                    this.documentStructure.publishSettings = await parseXML(entry.getData());
                }
                else if (entry.entryName === 'META-INF/metadata.xml') {
                    console.log(chalk.yellow('[Shadow] Parsing metadata.xml'));
                    this.documentStructure.metadata = await parseXML(entry.getData());
                }
            }

            // Track library assets
            console.log(chalk.yellow('[Shadow] Indexing library assets'));
            this.libraryAssets = await trackAssets(zip);

            console.log(chalk.green('[Shadow] FLA structure parsed successfully'));
        } catch (error) {
            console.error(chalk.red('[Shadow] Error parsing FLA:', error.message));
            throw error;
        }
    }


    async initializeShadowCopy(originalFlaPath) {
        console.log(chalk.blue(`[Shadow] Initializing shadow copy for ${originalFlaPath}`));
        
        // Create working directory
        const workDir = path.join(process.cwd(), '.animate-shadow');
        await ensureDir(workDir);
        
        // Set up paths
        this.mainFilePath = originalFlaPath;
        this.shadowFilePath = path.join(
            workDir, 
            `shadow-${getUserId()}-${Date.now()}.fla`
        );
        
        console.log(chalk.yellow(`[Shadow] Creating shadow copy at ${this.shadowFilePath}`));
        
        // Create initial shadow copy
        await fs.copyFile(originalFlaPath, this.shadowFilePath);
        
        // Extract and parse initial structure
        await this.extractAndParse();
        
        // Start watching for changes
        this.startWatching();
        
        console.log(chalk.green('[Shadow] Initialization complete'));
    }

    startWatching() {
        console.log(chalk.blue('[Shadow] Starting file watcher'));
        
        if (this.watcher) {
            this.watcher.close();
        }

        this.watcher = chokidar.watch(this.shadowFilePath, {
            persistent: true,
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        });

        this.watcher.on('change', (path) => {
            console.log(chalk.yellow(`[Shadow] Change detected in ${path}`));
            this.handleFileChange(path);
        });
        
        console.log(chalk.green('[Shadow] File watcher started'));
    }
    async handleFileChange(changedPath) {
        if (changedPath !== this.shadowFilePath) return;
        
        const changes = await this.detectChanges();
        if (changes.length > 0) {
            await this.queueChanges(changes);
            await this.notifyOtherUsers(changes);
        }
    }

    async detectChanges() {
        const currentZip = new AdmZip(this.shadowFilePath);
        const changes = [];

        // Check DOM changes
        const currentDOM = await parseXML(currentZip.getEntry('DOMDocument.xml').getData());
        const domChanges = diffXML(this.documentStructure.dom, currentDOM);
        if (domChanges.length > 0) {
            changes.push({ type: 'DOM', changes: domChanges });
        }

        // Check library changes
        const currentAssets = await trackAssets(currentZip);
        const assetChanges = this.diffAssets(currentAssets);
        if (assetChanges.length > 0) {
            changes.push({ type: 'LIBRARY', changes: assetChanges });
        }

        return changes;
    }

    diffAssets(currentAssets) {
        const changes = [];
        
        // Check for modified assets
        for (const [path, current] of Object.entries(currentAssets)) {
            const original = this.libraryAssets[path];
            if (!original || original.hash !== current.hash) {
                changes.push({
                    type: 'MODIFIED',
                    path,
                    hash: current.hash
                });
            }
        }
        
        // Check for deleted assets
        for (const path of Object.keys(this.libraryAssets)) {
            if (!currentAssets[path]) {
                changes.push({
                    type: 'DELETED',
                    path
                });
            }
        }
        
        return changes;
    }

    async queueChanges(changes) {
        this.changeQueue.push({
            timestamp: Date.now(),
            userId: getUserId(),
            changes
        });
    }

    async synchronizeWithMain() {
        if (await this.canAccessMainFile()) {
            await this.applyToMain();
        }
    }

    async canAccessMainFile() {
        try {
            const handle = await fs.open(this.mainFilePath, 'r+');
            await handle.close();
            return true;
        } catch {
            return false;
        }
    }

    async applyToMain() {
        await fs.copyFile(this.shadowFilePath, this.mainFilePath);
        await this.notifyMainUpdated();
    }

    cleanup() {
        if (this.watcher) {
            this.watcher.close();
        }
    }
}

module.exports = AnimateShadowSync;