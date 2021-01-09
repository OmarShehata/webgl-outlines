import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

import { CustomOutlinePass } from "./CustomOutlinePass.js";
import DragAndDropModels from "./DragAndDropModels.js";

const GUI = dat.GUI;

// Init scene
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(1, 1, -2);
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

// Load model
const loader = new GLTFLoader();
loader.load("box.glb", (gltf) => {
  scene.add(gltf.scene);
});

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
}
window.addEventListener("resize", onWindowResize, false);

// Set up GUI controls
const gui = new GUI({ width: 300 });
const params = {
  mode: { Mode: 0 },
  FXAA: true,
  outlineColor: 0xffffff,
  depthBias: 1,
  depthMult: 1,
  normalBias: 1,
  normalMult: 1.0,
};

const uniforms = customOutline.fsQuad.material.uniforms;
gui
  .add(params.mode, "Mode", {
    Outlines: 0,
    "Original scene": 1,
    "Depth buffer": 2,
    "Normal buffer": 3,
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
gui.add(params, "depthMult", 0.0, 10).onChange(function (value) {
  uniforms.multiplierParameters.value.y = value;
});
gui.add(params, "normalBias", 0.0, 5).onChange(function (value) {
  uniforms.multiplierParameters.value.z = value;
});
gui.add(params, "normalMult", 0.0, 10).onChange(function (value) {
  uniforms.multiplierParameters.value.w = value;
});

// Toggling this causes the outline shader to fail sometimes. Not sure why.
// gui.add(params, 'FXAA').onChange( function ( value ) {
//   effectFXAA.enabled = value;
// });;

// Allow drag and drop models to visualize them with outlines
const dropZoneElement = document.querySelector("body");
DragAndDropModels(scene, dropZoneElement);
