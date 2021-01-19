import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

const gltfLoader = new GLTFLoader();

function getExtension(filename) {
  return filename.toLowerCase().split('.').pop();
}

export default function DragAndDropModels(
  scene,
  dropZoneElement
) {
  dropZoneElement.ondragenter = function (event) {
    event.preventDefault();
  };
  dropZoneElement.ondragover = function (event) {
    event.preventDefault();
  };
  dropZoneElement.ondragleave = function (event) {
    event.preventDefault();
  };

  dropZoneElement.ondrop = function (event) {
    event.preventDefault();
    const files = [];
    if (event.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      for (var i = 0; i < event.dataTransfer.items.length; i++) {
        // If dropped items aren't files, reject them
        if (event.dataTransfer.items[i].kind === "file") {
          var file = event.dataTransfer.items[i].getAsFile();
          files.push(file);
        }
      }
    } else {
      files = event.dataTransfer.files;
    }

    let entryFile = files.find(f => getExtension(f.name) === 'glb');

    if (entryFile == undefined) {
      console.error('Could not find any supported 3D model files. .glb files are supported.')
    }
    const ext = getExtension(entryFile.name);
    const fileUrl = URL.createObjectURL(entryFile);
    scene.clear();
    // Re-add the light
    const light = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(light);
    light.position.set(1.7, 1, -1);
    gltfLoader.load(fileUrl, (gltf) => {
      scene.add(gltf.scene);
    });
  
  };
}
