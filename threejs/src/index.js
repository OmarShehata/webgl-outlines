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

const renderTarget = new THREE.WebGLRenderTarget(
  window.innerWidth,
  window.innerHeight
);

// Regular scene render pass. This is step 1 in the pipeline described in CustomOutlinePass.js
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
  // Create a second mesh to test 
  // selectively applying outline effect
  const mesh1 = gltf.scene; scene.add(mesh1);

  const mesh2 = mesh1.clone(); scene.add(mesh2);
  mesh2.traverse(node => {
    if (node.material) {
      node.material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    }
  })

  mesh2.position.x = -2;
  mesh2.position.y = 1;
  mesh2.position.z = 2;
  mesh2.rotateZ(5);
  mesh2.rotateY(5);

  window.mesh1 = mesh1;
  window.mesh2 = mesh2;

  mesh2.traverse(node => node.applyOutline = true);
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
  object1: true, 
  object2: false
};

const uniforms = customOutline.fsQuad.material.uniforms;
gui
  .add(params.mode, "Mode", {
    Outlines: 0,
    "Original scene": 1,
    "Depth buffer": 2,
    "Non-outlines depth": 5,
    "Normal buffer": 3,
    "Outlines only": 4,
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

gui.add(params, "object1").onChange(function (value) {
  mesh2.traverse(node => node.applyOutline = value);
});
gui.add(params, "object2").onChange(function (value) {
  mesh1.traverse(node => node.applyOutline = value);
});

// Toggling this causes the outline shader to fail sometimes. Not sure why.
// gui.add(params, 'FXAA').onChange( function ( value ) {
//   effectFXAA.enabled = value;
// });;

// Allow drag and drop models to visualize them with outlines
const dropZoneElement = document.querySelector("body");
DragAndDropModels(scene, dropZoneElement);
