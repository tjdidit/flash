const requiredDirs = [
    './src',
    './src/core',
    './src/utils',
    './src/network'
];

const fs = require('fs').promises;
const path = require('path');

async function setup() {
    for (const dir of requiredDirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (err) {
            console.error(`Error creating ${dir}:`, err);
        }
    }
}

setup();