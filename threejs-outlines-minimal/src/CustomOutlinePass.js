import * as THREE from "three";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import {
  getSurfaceIdMaterial,
} from "./FindSurfaces.js";

// Follows the structure of
// 		https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/OutlinePass.js
class CustomOutlinePass extends Pass {
  constructor(resolution, scene, camera) {
    super();

    this.renderScene = scene;
    this.renderCamera = camera;
    this.resolution = new THREE.Vector2(resolution.x, resolution.y);

    this.fsQuad = new FullScreenQuad(null);
    this.fsQuad.material = this.createOutlinePostProcessMaterial();

    // Create a buffer to store the normals of the scene onto
    // or store the "surface IDs"
    const surfaceBuffer = new THREE.WebGLRenderTarget(
      this.resolution.x,
      this.resolution.y
    );
    surfaceBuffer.texture.format = THREE.RGBAFormat;
    surfaceBuffer.texture.type = THREE.HalfFloatType;
    surfaceBuffer.texture.minFilter = THREE.NearestFilter;
    surfaceBuffer.texture.magFilter = THREE.NearestFilter;
    surfaceBuffer.texture.generateMipmaps = false;
    surfaceBuffer.stencilBuffer = false;
    this.surfaceBuffer = surfaceBuffer;

    this.normalOverrideMaterial = new THREE.MeshNormalMaterial();
    this.surfaceIdOverrideMaterial = getSurfaceIdMaterial();
  }

  dispose() {
    this.surfaceBuffer.dispose();
    this.fsQuad.dispose();
  }

  updateMaxSurfaceId(maxSurfaceId) {
    this.surfaceIdOverrideMaterial.uniforms.maxSurfaceId.value = maxSurfaceId;
  }

  setSize(width, height) {
    this.surfaceBuffer.setSize(width, height);
    this.resolution.set(width, height);

    this.fsQuad.material.uniforms.screenSize.value.set(
      this.resolution.x,
      this.resolution.y,
      1 / this.resolution.x,
      1 / this.resolution.y
    );
  }

  render(renderer, writeBuffer, readBuffer) {
    // Turn off writing to the depth buffer
    // because we need to read from it in the subsequent passes.
    const depthBufferValue = writeBuffer.depthBuffer;
    writeBuffer.depthBuffer = false;

    // 1. Re-render the scene to capture all suface IDs in a texture.
    renderer.setRenderTarget(this.surfaceBuffer);
    const overrideMaterialValue = this.renderScene.overrideMaterial;

    this.renderScene.overrideMaterial = this.surfaceIdOverrideMaterial;
    renderer.render(this.renderScene, this.renderCamera);
    this.renderScene.overrideMaterial = overrideMaterialValue;

    this.fsQuad.material.uniforms["depthBuffer"].value =
      readBuffer.depthTexture;
    this.fsQuad.material.uniforms["surfaceBuffer"].value =
      this.surfaceBuffer.texture;
    this.fsQuad.material.uniforms["sceneColorBuffer"].value =
      readBuffer.texture;

    // 2. Draw the outlines using the depth texture and normal texture
    // and combine it with the scene color
    if (this.renderToScreen) {
      // If this is the last effect, then renderToScreen is true.
      // So we should render to the screen by setting target null
      // Otherwise, just render into the writeBuffer that the next effect will use as its read buffer.
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      this.fsQuad.render(renderer);
    }

    // Reset the depthBuffer value so we continue writing to it in the next render.
    writeBuffer.depthBuffer = depthBufferValue;
  }

  get vertexShader() {
    return `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
			`;
  }
  get fragmentShader() {
    return `
			#include <packing>
			// The above include imports "perspectiveDepthToViewZ"
			// and other GLSL functions from ThreeJS we need for reading depth.
			uniform sampler2D sceneColorBuffer;
			uniform sampler2D depthBuffer;
			uniform sampler2D surfaceBuffer;
			uniform float cameraNear;
			uniform float cameraFar;
			uniform vec4 screenSize;
			uniform vec3 outlineColor;
			uniform vec2 multiplierParameters;

			varying vec2 vUv;

			// Helper functions for reading from depth buffer.
			float readDepth (sampler2D depthSampler, vec2 coord) {
				float fragCoordZ = texture2D(depthSampler, coord).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
			}
			float getLinearDepth(vec3 pos) {
				return -(viewMatrix * vec4(pos, 1.0)).z;
			}

			float getLinearScreenDepth(sampler2D map) {
					vec2 uv = gl_FragCoord.xy * screenSize.zw;
					return readDepth(map,uv);
			}
			// Helper functions for reading normals and depth of neighboring pixels.
			float getPixelDepth(int x, int y) {
				// screenSize.zw is pixel size 
				// vUv is current position
				return readDepth(depthBuffer, vUv + screenSize.zw * vec2(x, y));
			}
			// "surface value" is either the normal or the "surfaceID"
			vec3 getSurfaceValue(int x, int y) {
				vec3 val = texture2D(surfaceBuffer, vUv + screenSize.zw * vec2(x, y)).rgb;
				return val;
			}

			float saturateValue(float num) {
				return clamp(num, 0.0, 1.0);
			}

			float getSufaceIdDiff(vec3 surfaceValue) {
				float surfaceIdDiff = 0.0;
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(1, 0));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(0, 1));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(0, 1));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(0, -1));

				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(1, 1));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(1, -1));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(-1, 1));
				surfaceIdDiff += distance(surfaceValue, getSurfaceValue(-1, -1));
				return surfaceIdDiff;
			}

			void main() {
				vec4 sceneColor = texture2D(sceneColorBuffer, vUv);
				float depth = getPixelDepth(0, 0);
				vec3 surfaceValue = getSurfaceValue(0, 0);

				// Get the difference between depth of neighboring pixels and current.
				float depthDiff = 0.0;
				depthDiff += abs(depth - getPixelDepth(1, 0));
				depthDiff += abs(depth - getPixelDepth(-1, 0));
				depthDiff += abs(depth - getPixelDepth(0, 1));
				depthDiff += abs(depth - getPixelDepth(0, -1));

				// Get the difference between surface values of neighboring pixels
				// and current
				float surfaceValueDiff = getSufaceIdDiff(surfaceValue);
				
				// Apply multiplier & bias to each 
				float depthBias = multiplierParameters.x;
				float depthMultiplier = multiplierParameters.y;

				depthDiff = depthDiff * depthMultiplier;
				depthDiff = saturateValue(depthDiff);
				depthDiff = pow(depthDiff, depthBias);

				if (surfaceValueDiff != 0.0) surfaceValueDiff = 1.0;

				float outline = saturateValue(surfaceValueDiff + depthDiff);
			
				// Combine outline with scene color.
				vec4 outlineColor = vec4(outlineColor, 1.0);
				gl_FragColor = vec4(mix(sceneColor, outlineColor, outline));
			}
			`;
  }

  createOutlinePostProcessMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        sceneColorBuffer: {},
        depthBuffer: {},
        surfaceBuffer: {},
        outlineColor: { value: new THREE.Color(0xffffff) },
        //4 scalar values packed in one uniform:
        //  depth multiplier, depth bias
        multiplierParameters: {
          value: new THREE.Vector2(0.9, 20),
        },
        cameraNear: { value: this.renderCamera.near },
        cameraFar: { value: this.renderCamera.far },
        screenSize: {
          value: new THREE.Vector4(
            this.resolution.x,
            this.resolution.y,
            1 / this.resolution.x,
            1 / this.resolution.y
          ),
        },
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
    });
  }
}

export { CustomOutlinePass };
