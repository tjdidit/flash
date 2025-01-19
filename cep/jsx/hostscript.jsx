function sendDocumentChange() {
    var doc = fl.getDocumentDOM();
    if (!doc) return;
    
    // Capture current state
    var state = {
        timeline: captureTimelineState(),
        selection: captureSelectionState(),
        stage: captureStageState()
    };
    
    return JSON.stringify(state);
}

function captureTimelineState() {
    var timeline = fl.getDocumentDOM().getTimeline();
    return {
        currentFrame: timeline.currentFrame,
        currentLayer: timeline.currentLayer,
        layers: captureLayerState(timeline)
    };
}

function captureLayerState(timeline) {
    var layers = [];
    for (var i = 0; i < timeline.layers.length; i++) {
        var layer = timeline.layers[i];
        layers.push({
            name: layer.name,
            visible: layer.visible,
            locked: layer.locked,
            frames: captureFrameState(layer)
        });
    }
    return layers;
}

function captureFrameState(layer) {
    var frames = [];
    for (var i = 0; i < layer.frames.length; i++) {
        var frame = layer.frames[i];
        frames.push({
            startFrame: frame.startFrame,
            duration: frame.duration,
            elements: captureElements(frame.elements)
        });
    }
    return frames;
}

function captureElements(elements) {
    var captured = [];
    if (!elements) return captured;
    
    for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        captured.push({
            type: element.elementType,
            selected: element.selected,
            x: element.x,
            y: element.y,
            width: element.width,
            height: element.height,
            rotation: element.rotation,
            matrix: element.matrix
        });
    }
    return captured;
}

function applyDocumentChange(changeStr) {
    var change = JSON.parse(changeStr);
    var doc = fl.getDocumentDOM();
    if (!doc) return;
    
    // Apply timeline changes
    if (change.timeline) {
        var timeline = doc.getTimeline();
        timeline.currentFrame = change.timeline.currentFrame;
        timeline.currentLayer = change.timeline.currentLayer;
        
        // Apply layer changes
        applyLayerChanges(timeline, change.timeline.layers);
    }
    
    // Refresh view
    doc.refresh();
}

function applyLayerChanges(timeline, layerChanges) {
    for (var i = 0; i < layerChanges.length; i++) {
        var layerChange = layerChanges[i];
        var layer = timeline.layers[i];
        
        if (layer) {
            layer.name = layerChange.name;
            layer.visible = layerChange.visible;
            layer.locked = layerChange.locked;
            
            // Apply frame changes
            applyFrameChanges(layer, layerChange.frames);
        }
    }
}