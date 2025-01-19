const xml2js = require('xml2js');

async function parseXML(data) {
    const parser = new xml2js.Parser();
    return parser.parseStringPromise(data);
}

function diffXML(original, current) {
    const changes = [];
    
    function compareObjects(orig, curr, path = '') {
        if (typeof orig !== typeof curr) {
            changes.push({
                path,
                type: 'MODIFIED',
                original: orig,
                current: curr
            });
            return;
        }

        if (Array.isArray(orig)) {
            if (orig.length !== curr.length) {
                changes.push({
                    path,
                    type: 'ARRAY_LENGTH_CHANGED',
                    original: orig.length,
                    current: curr.length
                });
            }
            
            const maxLength = Math.max(orig.length, curr.length);
            for (let i = 0; i < maxLength; i++) {
                compareObjects(orig[i], curr[i], `${path}[${i}]`);
            }
            return;
        }

        if (typeof orig === 'object' && orig !== null) {
            const allKeys = new Set([...Object.keys(orig), ...Object.keys(curr)]);
            
            for (const key of allKeys) {
                const newPath = path ? `${path}.${key}` : key;
                
                if (!(key in orig)) {
                    changes.push({
                        path: newPath,
                        type: 'ADDED',
                        current: curr[key]
                    });
                } else if (!(key in curr)) {
                    changes.push({
                        path: newPath,
                        type: 'DELETED',
                        original: orig[key]
                    });
                } else {
                    compareObjects(orig[key], curr[key], newPath);
                }
            }
            return;
        }

        if (orig !== curr) {
            changes.push({
                path,
                type: 'MODIFIED',
                original: orig,
                current: curr
            });
        }
    }

    compareObjects(original, current);
    return changes;
}

module.exports = { parseXML, diffXML };
