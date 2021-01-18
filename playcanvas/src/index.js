app.start();

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

var modelUrl = "box.glb";
var camera;
var outlineEffect;
var options = {
    outlineOnly: false,
    outlineColor: pc.Color.WHITE,
    depthBias: 1,
    depthMultiplier: 1,
    normalBias: 1,
    normalMultiplier:1
};
app.assets.loadFromUrl(modelUrl, "container", function (err, asset) {
    app.start();

    var entity = new pc.Entity();
    entity.addComponent("model", {
        type: "asset",
        asset: asset.resource.model,
        castShadows: true
    });
    app.root.addChild(entity);

    // Create an Entity with a camera component
    camera = new pc.Entity();
    camera.addComponent("camera", {
        clearColor: new pc.Color(0, 0, 0)
    });
    camera.translate(0, 1, 3);
    camera.lookAt(pc.Vec3.ZERO);
    app.root.addChild(camera);

    // Create an entity with a directional light component
    var light = new pc.Entity();
    light.addComponent("light", {
        type: "point"
    });
    light.setLocalPosition(1, 1, 5);
    app.root.addChild(light);
    app.on("update", function (dt) {
        if (entity) {
            entity.rotate(0, 10 * dt, 0);
        }
    });

    setupOutlinePostProcess();
    setupFXAAPostProcess();

    window.addEventListener("resize", function () {
        app.resizeCanvas(canvas.width, canvas.height);
        recreateOutlineEffect();
    });
});

function setupOutlinePostProcess() {
    // Create a layer and a render target to store the "normal buffer". 
    var normalPassLayer = new pc.Layer({
        name: 'NormalsPass',
    });
    normalPassLayer.renderTarget = createRt();
    //  Add it to the layer list
    app.scene.layers.insert(normalPassLayer, 0);
    // Make all meshes & lights render into the normals pass. 
    // I believe the reasons we need the lights too is 
    // that otherwise the engine won't pass the normal varying to the shader.
    getAllEntities(this.app.root, node => {
        if (node.model != undefined)
            node.model.layers = [...node.model.layers, normalPassLayer.id];
        if (node.light != undefined)
            node.light.layers = [...node.light.layers, normalPassLayer.id];
    });
    // Make this layer set a normal material on all meshes
    // and turn it off post render. 
    normalPassLayer.onPreRender = () => {
        toggleNormalMaterial(true);
    };
    normalPassLayer.onPostRender = () => {
        toggleNormalMaterial(false);
    };
    
    // Create a second camera that will render the normals 
    // onto the normal layer we created above.
    var normalsCamera = new pc.Entity();
    normalsCamera.addComponent('camera');
    normalsCamera.camera.layers = [normalPassLayer.id];

    app.root.addChild(normalsCamera);
    normalsCamera.camera.clearColor = pc.Color.BLACK;
    
    // Create the outline effect, which needs a reference to the normal buffer of the scene.
    var colorBuffer = normalPassLayer.renderTarget.colorBuffer;
    outlineEffect = new pc.OutlineEffect(
        app.graphicsDevice, 
        colorBuffer,  
        {
            outlineOnly: options.outlineOnly, 
            outlineColor: options.outlineColor,
            depthBias: options.depthBias,
            depthMultiplier: options.depthMultiplier,
            normalBias: options.normalBias,
            normalMultiplier: options.normalMultiplier
        });    
    
    // Add the effect to the main camera.
    var queue = camera.camera.postEffects;
    queue.addEffect(outlineEffect);

    app.on("update", function (dt) {
        // Updates the camera that renders the normals layer
        // It should be identical to the main camera.
        var mainCamera = camera;
        var nCamera = normalsCamera;
        
        var pos = mainCamera.getPosition();
        var rot = mainCamera.getRotation();
        nCamera.setPosition(pos.x,pos.y,pos.z);
        nCamera.setRotation(rot);
        nCamera.camera.fov = mainCamera.camera.fov;
        nCamera.camera.horizontalFov = mainCamera.camera.horizontalFov;
    });
}

function setupFXAAPostProcess() {
    var fxaa = new pc.FxaaEffect(app.graphicsDevice);
    var queue = camera.camera.postEffects;
    queue.addEffect(fxaa);
}

function recreateOutlineEffect() {
    var normalPassLayer = app.scene.layers.getLayerByName("NormalsPass");
    var rt = normalPassLayer.renderTarget;
    rt.colorBuffer.destroy();
    rt.destroy();
    normalPassLayer.renderTarget = createRt();
    var colorBuffer = normalPassLayer.renderTarget.colorBuffer;

    var queue = camera.camera.postEffects;
    queue.removeEffect(outlineEffect);
    outlineEffect = new pc.OutlineEffect(
        app.graphicsDevice, 
        colorBuffer, {
            outlineOnly: options.outlineOnly, 
            outlineColor: options.outlineColor,
            depthBias: options.depthBias,
            depthMultiplier: options.depthMultiplier,
            normalBias: options.normalBias,
            normalMultiplier: options.normalMultiplier
        });
    queue.addEffect(outlineEffect);
}
function getAllEntities(node, callback) {
    if (node == undefined) node = this.app.root; 
    
    for (var i = 0;i < node.children.length; i++) {
        var child = node.children[i];
        this.getAllEntities(child, callback);
    }
    
    callback(node);
}

function createRt() {
    var device = app.graphicsDevice;
    var texture = new pc.Texture(device, {
        width: Math.floor(device.width),
        height: Math.floor(device.height),
        format: pc.PIXELFORMAT_R8_G8_B8_A8,
        mipmaps: false
    });
    
    return new pc.RenderTarget({
        colorBuffer: texture
    });
}
function toggleNormalMaterial(bool) {
    // Replace the material on all opaque meshes in the "World"
    // layer with our normal material.
    var worldLayer = this.app.scene.layers.getLayerByName("World");
    for (let mesh of worldLayer.instances.opaqueMeshInstances) {
        if (mesh.originalMaterial == undefined) {
            mesh.originalMaterial = mesh.material;
        }
        if (bool) {
            mesh.material = this.getNormalMaterial();
        } else {    
            mesh.material = mesh.originalMaterial;
        }
    }
}
var normalMaterial;
function getNormalMaterial() {
    // Cache the material that renders the normals.
    if (normalMaterial) return normalMaterial;
    
    var material = new pc.StandardMaterial();
    material.customFragmentShader = `
        varying vec3 vNormalW;
        uniform mat4 matrix_view;

        vec3 getViewNormal() {
            return mat3(matrix_view) * vNormalW;
        }

        void main()
        {
            gl_FragColor = vec4(getViewNormal(), 1.0);
        }
    `;
    normalMaterial = material;
    return material;
}