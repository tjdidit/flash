describe('Sync Integration', () => {
    let syncA;
    let syncB;
    let tempDir;

    beforeEach(async () => {
        tempDir = tmp.dirSync({ unsafeCleanup: true });
        
        // Set up two sync instances
        syncA = new AnimateShadowSync();
        syncB = new AnimateShadowSync();
        
        // Initialize with same source FLA
        await syncA.initializeShadowCopy(path.join(__dirname, '../fixtures/sample.fla'));
        await syncB.initializeShadowCopy(path.join(__dirname, '../fixtures/sample.fla'));
    });

    afterEach(() => {
        tempDir.removeCallback();
    });

    test('changes sync between instances', async () => {
        // Make change in syncA
        const zipA = new AdmZip(syncA.shadowFilePath);
        const domA = zipA.getEntry('DOMDocument.xml');
        const modifiedDOM = domA.getData().toString().replace(
            '<Frame>', 
            '<Frame modified="true">'
        );
        
        zipA.updateFile('DOMDocument.xml', Buffer.from(modifiedDOM));
        zipA.writeZip(syncA.shadowFilePath);
        
        // Simulate sync
        const changes = await syncA.detectChanges();
        await syncB.applyQueuedChanges(changes);
        
        // Verify syncB received changes
        const zipB = new AdmZip(syncB.shadowFilePath);
        const domB = zipB.getEntry('DOMDocument.xml').getData().toString();
        expect(domB).toContain('<Frame modified="true">');
    });
});