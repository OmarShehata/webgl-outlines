import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

import { CustomOutlinePass } from "./CustomOutlinePass.js";
import DragAndDropModels from "./DragAndDropModels.js";
import FindSurfaces from "./FindSurfaces.js";
import SketchfabIntegration from "./SketchfabIntegration.js";

const GUI = dat.GUI;
const sketchfabIntegration = new SketchfabIntegration();
sketchfabIntegration.checkToken();

// Init scene
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(10, 2.5, 4);

const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("canvas"),
});
renderer.setSize(window.innerWidth, window.innerHeight);
const light = new THREE.DirectionalLight(0xffffff, 1);
scene.add(light);
light.position.set(1.7, 1, -1);

// Set up post processing
// Create a render target that holds a depthTexture so we can use it in the outline pass
// See: https://threejs.org/docs/index.html#api/en/renderers/WebGLRenderTarget.depthBuffer
const depthTexture = new THREE.DepthTexture();
const renderTarget = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight,
  {
    depthTexture: depthTexture,
    depthBuffer: true,
  }
);

// Initial render pass.
const composer = new EffectComposer(renderer, renderTarget);
const pass = new RenderPass(scene, camera);
composer.addPass(pass);

// Outline pass.
const customOutline = new CustomOutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  scene,
  camera
);
composer.addPass(customOutline);

// Antialias pass.
const effectFXAA = new ShaderPass(FXAAShader);
effectFXAA.uniforms["resolution"].value.set(
  1 / window.innerWidth,
  1 / window.innerHeight
);
composer.addPass(effectFXAA);

const surfaceFinder = new FindSurfaces();
// Load model
const loader = new GLTFLoader();
const model = "https://cdn.glitch.global/05f04c33-fc24-481c-af64-7db4a57573cd/box_with_plane.glb?v=1665350143476";
loader.load(model, (gltf) => {
  scene.add(gltf.scene);
  addSurfaceIdAttributeToMesh(gltf.scene);
});

function addSurfaceIdAttributeToMesh(scene) {
  surfaceFinder.surfaceId = 0;

  scene.traverse((node) => {
    if (node.type == "Mesh") {
      const colorsTypedArray = surfaceFinder.getSurfaceIdAttribute(node);
      node.geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(colorsTypedArray, 4)
      );
    }
  });

  customOutline.updateMaxSurfaceId(surfaceFinder.surfaceId + 1);
}

// Set up orbital camera controls.
let controls = new OrbitControls(camera, renderer.domElement);
controls.update();

// Render loop
function update() {
  requestAnimationFrame(update);
  composer.render();
}
update();

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  effectFXAA.setSize(window.innerWidth, window.innerHeight);
  customOutline.setSize(window.innerWidth, window.innerHeight);

  effectFXAA.uniforms["resolution"].value.set(
    1 / window.innerWidth,
    1 / window.innerHeight
  );
}
window.addEventListener("resize", onWindowResize, false);

// Set up GUI controls
const gui = new GUI({ width: 300 });
const uniforms = customOutline.fsQuad.material.uniforms;
const params = {
  mode: { Mode: 0 },
  FXAA: true,
  outlineColor: 0xffffff,
  depthBias: uniforms.multiplierParameters.value.x,
  depthMult: uniforms.multiplierParameters.value.y,
  normalBias: uniforms.multiplierParameters.value.z,
  normalMult: uniforms.multiplierParameters.value.w,
  cameraNear: camera.near,
  cameraFar: camera.far,
};

gui
  .add(params.mode, "Mode", {
    "Outlines V2": 0,
    "Outlines V1": 1,
    "Original scene": 2,
    "Depth buffer": 3,
    "Normal buffer": 4,
    "SurfaceID debug buffer": 5,
    "Outlines only V2": 6,
    "Outlines only V1": 7,
  })
  .onChange(function (value) {
    uniforms.debugVisualize.value = value;
  });

gui.addColor(params, "outlineColor").onChange(function (value) {
  uniforms.outlineColor.value.set(value);
});

gui.add(params, "depthBias", 0.0, 5).onChange(function (value) {
  uniforms.multiplierParameters.value.x = value;
});
gui.add(params, "depthMult", 0.0, 20).onChange(function (value) {
  uniforms.multiplierParameters.value.y = value;
});
gui.add(params, "normalBias", 0.0, 20).onChange(function (value) {
  uniforms.multiplierParameters.value.z = value;
});
gui.add(params, "normalMult", 0.0, 10).onChange(function (value) {
  uniforms.multiplierParameters.value.w = value;
});
gui.add(params, "cameraNear", 0.1, 1).onChange(function (value) {
  camera.near = value;
  camera.updateProjectionMatrix();

  uniforms.cameraNear.value = camera.near;
});
gui.add(params, "cameraFar", 1, 1000).onChange(function (value) {
  camera.far = value;
  camera.updateProjectionMatrix();

  uniforms.cameraFar.value = camera.far;
});

// Allow drag and drop models to visualize them with outlines
const dropZoneElement = document.querySelector("body");
DragAndDropModels(scene, dropZoneElement, (modelUrl) => {
  scene.clear();
  // Re-add the light
  const light = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(light);
  light.position.set(1.7, 1, -1);

  loader.load(modelUrl, (gltf) => {
    scene.add(gltf.scene);
    addSurfaceIdAttributeToMesh(gltf.scene);
  });
});

sketchfabIntegration.postLoad = (mesh) => {
  addSurfaceIdAttributeToMesh(mesh);
}

// Add Sketchfab integration buttons to GUI
const sketchfabFolder = gui.addFolder("Sketchfab");
const sfParams = {
  "Sketchfab URL": ""
};

let loginButtonName = "Login to Sketchfab";
if (sketchfabIntegration.token != null) {
  let lastValue;
  sketchfabFolder
    .add(sfParams, "Sketchfab URL")
    .onChange(async function (value) {
      if (lastValue != value) {
        lastValue = value;
        sketchfabIntegration.fetchAndDisplayModel(value, scene);
      }
    });
  loginButtonName = "Re-login to Sketchfab";
}

const sketchfabOptions = {};
sketchfabOptions[loginButtonName] = sketchfabIntegration.authenticate;
sketchfabFolder.add(sketchfabOptions, loginButtonName);
sketchfabFolder.open();
