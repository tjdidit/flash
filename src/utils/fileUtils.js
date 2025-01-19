const os = require('os');
const fs = require('fs').promises;  // Added this

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

function getUserId() {
    return `${os.userInfo().username}-${process.pid}`;
}

module.exports = { ensureDir, getUserId };