const CLIENT_ID = "1Uou0R2ndNipcNF6XNsQdIDYTAMcPcoGmClUwKMd";
const AUTHENTICATION_URL = `https://sketchfab.com/oauth2/authorize/?state=123456789&response_type=token&client_id=${CLIENT_ID}`;
import JSZip from "jszip";
// Read zip: https://stuk.github.io/jszip/documentation/howto/read_zip.html
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

function checkStatus(response) {
  // From: https://gist.github.com/irbull/42f3bd7a9db767ce72a770ded9a5bdd1
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
  }
  return response;
}

function getExtension(filename) {
  return filename.toLowerCase().split(".").pop();
}

async function getFileUrl(file) {
  const blob = await file.async("blob");
  const url = URL.createObjectURL(blob);
  return url;
}

class SketchfabIntegration {
  constructor() {
    this.token = null;
    this.postLoad = () => {}
  }

  async readZip(zipUrl, scene) {
    const response = await fetch(zipUrl);
    checkStatus(response);
    const arrayBuffer = await response.arrayBuffer();

    const result = await JSZip.loadAsync(arrayBuffer);

    const files = Object.values(result.files).filter((item) => !item.dir);
    const entryFile = files.find((f) => getExtension(f.name) === "gltf");
    // Create blobs for every file resource
    const blobUrls = {};
    for (const file of files) {
      console.log(`Loading ${file.name}...`);
      blobUrls[file.name] = await getFileUrl(file);
    }
    const fileUrl = blobUrls[entryFile.name];

    scene.clear();
    // Re-add the light
    const light = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(light);
    light.position.set(1.7, 1, -1);

    const loadingManager = new THREE.LoadingManager();
    loadingManager.setURLModifier((url) => {
      const parsedUrl = new URL(url);
      const origin = parsedUrl.origin;
      const path = parsedUrl.pathname;
      const relativeUrl = path.replace(origin + "/", "");

      if (blobUrls[relativeUrl] != undefined) {
        return blobUrls[relativeUrl];
      }

      return url;
    });
    const gltfLoader = new GLTFLoader(loadingManager);
    gltfLoader.load(fileUrl, (gltf) => {
      scene.add(gltf.scene);
      this.postLoad(gltf.scene)
    });
  }

  authenticate() {
    window.open(AUTHENTICATION_URL, "_blank");
  }

  checkToken() {
    // Check if there's a new token from the URL
    const url = new URL(window.location);
    // Extract the token and save it
    const hashParams = url.hash.split("&");
    for (let param of hashParams) {
      if (param.indexOf("access_token") !== -1) {
        const token = param.replace("#access_token=", "");
        console.log("Detected Sketchfab token: ", token);
        localStorage.setItem("sb_token", token);
      }
    }

    // Load token from local storage
    this.token = localStorage.getItem("sb_token");

    console.log("Using token", this.token);
  }

  async getModelDownloadUrl(inputUrl) {
    // Extract the model ID from the URL
    const input = new URL(inputUrl);
    // The ID is always the last string when seperating by '-'
    const pieces = input.pathname.split("-");
    const modelID = pieces[pieces.length - 1];

    const metadataUrl = `https://api.sketchfab.com/v3/models/${modelID}/download`;
    const options = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`
      },
      mode: "cors"
    };

    const response = await fetch(metadataUrl, options);
    const metadata = await response.json();
    // Get license information to display attribution
    const attribution = await this.getAttributionText(modelID);

    return { url: metadata.gltf.url, attribution: attribution };
  }

  async getAttributionText(modelID) {
    const modelDataUrl = `https://api.sketchfab.com/v3/models/${modelID}`;
    const options = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`
      },
      mode: "cors"
    };
    const response = await fetch(modelDataUrl, options);
    const metadata = await response.json();

    const license = { name: metadata.license.label, url: metadata.license.url };
    const user = {
      name: metadata.user.displayName,
      url: metadata.user.profileUrl
    };
    const model = { name: metadata.name, url: metadata.viewerUrl };
    const attributionText = `This work is based on <a href="${model.url}" target=_blank>${model.name}</a>
		by <a href="${user.url}" target=_blank>${user.name}</a> 
		licensed under <a href="${license.url}" target=_blank>${license.name}</a>.`;

    return attributionText;
  }

  // This assumes there is an HTML element with the id "overlay"
  // containing a few elements/error messages
  async fetchAndDisplayModel(url, scene) {
    // Bring up modal with "Loading" text
    document.querySelector("#overlay").style.display = "block";
    document.querySelector("#dimiss-btn").onclick = () => {
      this._resetSketchfabUI();
    };

    let modelZipUrl;
    let attributionText;
    try {
      const result = await this.getModelDownloadUrl(url);
      modelZipUrl = result.url;
      attributionText = result.attribution;
    } catch (e) {
      // Update modal with error
      console.error("Failed to download model from Sketchfab", e);
      document.querySelector("#download-error").style.display = "block";
      document.querySelector("#dimiss-btn").style.display = "block";
    }

    if (modelZipUrl == undefined) return;

    // Update modal with "Loading model"
    document.querySelector("#fetch-success").style.display = "block";

    try {
      await this.readZip(modelZipUrl, scene);
    } catch (e) {
      // Update modal with error
      console.error("Failed to read model from Sketchfab", e);
      document.querySelector("#unknown-error").style.display = "block";
      document.querySelector("#dimiss-btn").style.display = "block";
    }

    // Dismiss modal
    this._resetSketchfabUI();
    // Display attribution
    document.querySelector(
      "#attribution-container"
    ).innerHTML = attributionText;
  }

  _resetSketchfabUI() {
    // Hide the overlay and any error messages
    document.querySelector("#overlay").style.display = "none";
    document.querySelector("#download-error").style.display = "none";
    document.querySelector("#dimiss-btn").style.display = "none";
    document.querySelector("#unknown-error").style.display = "none";
    document.querySelector("#fetch-success").style.display = "none";
    document.querySelector("#attribution-container").innerHTML = "";
  }
}

export default SketchfabIntegration;
