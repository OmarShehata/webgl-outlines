import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";

import { CustomOutlinePass } from "./CustomOutlinePass.js";
import DragAndDropModels from "./DragAndDropModels.js";
import FindSurfaces from "./FindSurfaces.js";
import { weldVertices } from "./VerticesWelder.js";

const GUI = dat.GUI;

// Init scene
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
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

// Text labels
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0px";
document.body.appendChild(labelRenderer.domElement);

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
const model = "box_extra_vertices.glb";
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
let controls = new OrbitControls(camera, labelRenderer.domElement);
controls.update();

let doneCounter = 0;

// Render loop
function update() {
  requestAnimationFrame(update);
  labelRenderer.render(scene, camera);
  composer.render();

  // Show "done" notification
  doneCounter--;
  if (doneCounter > 0) {
    document.querySelector("#overlay").style.display = "block";
  } else {
    document.querySelector("#overlay").style.display = "none";
  }
}
update();

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  effectFXAA.setSize(window.innerWidth, window.innerHeight);
  customOutline.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);

  effectFXAA.uniforms["resolution"].value.set(
    1 / window.innerWidth,
    1 / window.innerHeight
  );
}
window.addEventListener("resize", onWindowResize, false);

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

// Set up GUI controls
const gui = new GUI({ width: 300 });
const params = { thresholdAngle: 3 };
gui.add(params, "thresholdAngle", 1, 90).onFinishChange(function (value) {
  resetButton();
  weldVerticesButton();
});
gui.add(
  {
    weldVertices: () => {
      weldVerticesButton();
    },
  },
  "weldVertices"
);
gui.add(
  {
    reset: () => {
      resetButton();
    },
  },
  "reset"
);

gui.add(
  {
    download: () => {
      downloadButton();
    },
  },
  "download"
);

function weldVerticesButton() {
  // Weld vertices of all meshes in scene
  scene.traverse((mesh) => {
    if (mesh.type == "Mesh") {
      const bufferGeometry = mesh.geometry;
      const { position } = bufferGeometry.attributes;
      const indexBuffer = bufferGeometry.index;

      const newIndexBuffer = weldVertices(
        position.array,
        indexBuffer.array,
        params.thresholdAngle
      );

      if (!mesh.originalIndexBuffer)
        mesh.originalIndexBuffer = Array.from(indexBuffer.array);
      mesh.geometry.setIndex(newIndexBuffer);
    }
  });

  // Re-compute surface Ids for outline shader
  addSurfaceIdAttributeToMesh(scene);

  doneCounter = 60 * 3;
}

function resetButton() {
  // Reset to the original index buffer
  scene.traverse((mesh) => {
    if (mesh.originalIndexBuffer) {
      mesh.geometry.setIndex(mesh.originalIndexBuffer);
    }
  });

  addSurfaceIdAttributeToMesh(scene);
}

const exporter = new GLTFExporter();
const linkElement = document.createElement("a");
linkElement.style.display = "none";
document.body.appendChild(linkElement);

function downloadButton() {
  // Remove the surfaceId color attribute
  scene.traverse((node) => {
    if (node.geometry && node.geometry.getAttribute("color")) {
      node.geometry.savedSurfaceIdAttribute =
        node.geometry.getAttribute("color");
      node.geometry.deleteAttribute("color");
    }
  });

  // Export scene as binary glTF
  exporter.parse(
    scene,
    function (gltf) {
      const blob = new Blob([gltf], { type: "application/octet-stream" });

      // Download it
      linkElement.href = URL.createObjectURL(blob);
      linkElement.download = "welded_model.glb";
      linkElement.click();
    },
    console.error,
    { binary: true }
  );

  // Add the surfaceId attribute back
  scene.traverse((node) => {
    if (node.geometry) {
      if (node.geometry.savedSurfaceIdAttribute) {
        node.geometry.setAttribute(
          "color",
          node.geometry.savedSurfaceIdAttribute
        );
        node.geometry.savedSurfaceIdAttribute = null;
      }
    }
  });
}
