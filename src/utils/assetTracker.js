const crypto = require('node:crypto');  // Changed to explicit node:crypto

async function trackAssets(zip) {
    const assets = {};
    
    for (const entry of zip.getEntries()) {
        if (entry.entryName.startsWith('LIBRARY/')) {
            const hash = crypto.createHash('md5')
                              .update(entry.getData())
                              .digest('hex');
            
            assets[entry.entryName] = {
                path: entry.entryName,
                hash
            };
        }
    }
    
    return assets;
}

module.exports = { trackAssets };