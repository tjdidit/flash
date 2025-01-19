const AnimateShadowSync = require('../../src/core/AnimateShadowSync');
const tmp = require('tmp');
const fs = require('fs').promises;
const path = require('path');

describe('AnimateShadowSync', () => {
    let sync;
    let tempDir;
    let sampleFlaPath;

    beforeEach(async () => {
        // Create temporary directory
        tempDir = tmp.dirSync({ unsafeCleanup: true });
        
        // Copy sample FLA to temp directory
        sampleFlaPath = path.join(tempDir.name, 'test.fla');
        await fs.copyFile(
            path.join(__dirname, '../fixtures/sample.fla'),
            sampleFlaPath
        );
        
        sync = new AnimateShadowSync();
    });

    afterEach(() => {
        tempDir.removeCallback();
    });

    test('initializes shadow copy successfully', async () => {
        await sync.initializeShadowCopy(sampleFlaPath);
        
        // Verify shadow copy exists
        const shadowExists = await fs.access(sync.shadowFilePath)
            .then(() => true)
            .catch(() => false);
        
        expect(shadowExists).toBe(true);
    });

    test('detects DOM changes', async () => {
        await sync.initializeShadowCopy(sampleFlaPath);
        
        // Simulate DOM change
        const zip = new AdmZip(sync.shadowFilePath);
        const dom = zip.getEntry('DOMDocument.xml');
        const modifiedDOM = dom.getData().toString().replace(
            '<Frame>', 
            '<Frame modified="true">'
        );
        
        zip.updateFile('DOMDocument.xml', Buffer.from(modifiedDOM));
        zip.writeZip(sync.shadowFilePath);
        
        const changes = await sync.detectChanges();
        expect(changes).toHaveLength(1);
        expect(changes[0].type).toBe('DOM');
    });
});