import * as THREE from "three";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";

// Follows the structure of
// 		https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/OutlinePass.js
class CustomOutlinePass extends Pass {
	constructor(resolution, scene, camera, originalSceneDepthTexture) {
		super();

		this.renderScene = scene;
		this.renderCamera = camera;
		this.resolution = new THREE.Vector2(resolution.x, resolution.y);

		this.fsQuad = new Pass.FullScreenQuad(null);
		this.fsQuad.material = this.createOutlinePostProcessMaterial();

		// Create a buffer to store the normals of the scene onto
		const normalTarget = new THREE.WebGLRenderTarget(
			this.resolution.x,
			this.resolution.y
		);
		normalTarget.texture.format = THREE.RGBFormat;
		normalTarget.texture.minFilter = THREE.NearestFilter;
		normalTarget.texture.magFilter = THREE.NearestFilter;
		normalTarget.texture.generateMipmaps = false;
		normalTarget.stencilBuffer = false;

		normalTarget.depthBuffer = true;
		normalTarget.depthTexture = new THREE.DepthTexture();
		normalTarget.depthTexture.type = THREE.UnsignedShortType;

		this.normalTarget = normalTarget;
		// Create a buffer to store the depth of the scene 
		// we don't use the default depth buffer because
		// this one includes only objects that have the outline applied
		const depthTarget = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution.y );
		depthTarget.texture.format = THREE.RGBFormat;
		depthTarget.texture.minFilter = THREE.NearestFilter;
		depthTarget.texture.magFilter = THREE.NearestFilter;
		depthTarget.texture.generateMipmaps = false;
		depthTarget.stencilBuffer = false;
		depthTarget.depthBuffer = true;
		depthTarget.depthTexture = new THREE.DepthTexture();
		depthTarget.depthTexture.type = THREE.UnsignedShortType;
		this.depthTarget = depthTarget;

		this.normalOverrideMaterial = new THREE.MeshNormalMaterial();

		this.originalSceneDepthTexture = originalSceneDepthTexture;
	}

	dispose() {
		this.normalTarget.dispose();
		this.fsQuad.dispose();
	}

	setSize(width, height) {
		this.normalTarget.setSize(width, height);
		this.resolution.set(width, height);

		this.fsQuad.material.uniforms.screenSize.value.set(
			this.resolution.x,
			this.resolution.y,
			1 / this.resolution.x,
			1 / this.resolution.y
		);
	}

	/*


	1 - Render all objects to get final color buffer, with regular depth
	2 - Render only non-outlines objects to get
		depth buffer NO OUTLINES
	3 - Render all outlines objects to get 
		normal buffer
		depth buffer outlines
	4 - Render outline effect
		> using normal buffer & depth buffer outlines, create the outline
		> overlay on top of final color buffer 
		> use depth buffer NO OUTLINES to occlude outline. 


	Currently I am combining 1 & 2, so the final color buffer is NOT correct. 



	To render outlines on only one object:

	- Render 2 cubes
		-> scene buffer A (2 cubes)
		-> depth buffer A (2 cubes)
	- Render 1 cube
		-> depth buffer B (1 cube)

	- Outline pass
		-> Re-render scene with 1 cube, get normal buffer
		-> Take depth buffer B 
		-> Create outlines, into scene buffer A



	Current is:

	- Render 2 cubes
		-> scene buffer A (2 cubes)
		-> depth buffer A (2 cubes)
	- Outlines pass
		-> Re-render scene with 2 cubes, get normal buffer
		-> Take depth buffer A 
		-> Create outliens, into scene buffer A



	So all you need to figure out is how to make a separate pass to get just the depth



	My problem now is in the outline 2nd render pass, the outline is drawn THROUGH objects

	This is because I just hide objects. But I want to:

		- Use them for depth test only, but not render htem
		- Use the existing depth buffer when rendering
	*/

	render(renderer, writeBuffer, readBuffer) {
		// Turn off writing to the depth buffer
		// because we need to read from it in the subsequent passes.
		const depthBufferValue = writeBuffer.depthBuffer;
		writeBuffer.depthBuffer = false;

		//renderer.clearDepth();

		// 1. Re-render the scene to capture all normals in texture.
		// Ideally we could capture this in the first render pass along with
		// the depth texture.
		renderer.setRenderTarget(this.normalTarget);

		const overrideMaterialValue = this.renderScene.overrideMaterial;
		this.renderScene.overrideMaterial = this.normalOverrideMaterial;
		// Only include objects that have the "applyOutline" property. 
		// We do this by hiding all other objects temporarily.
		this.renderScene.traverse( function( node ) {
		    if (node.applyOutline != true && node.type == 'Mesh') {
		    	node.oldVisibleValue = node.visible;
		    	node.visible = false;
		    }
		});
		renderer.render(this.renderScene, this.renderCamera);
		this.renderScene.overrideMaterial = overrideMaterialValue;

		// 2. Re-render the scene to capture depth

		//this.fsQuad.material.uniforms["depthBuffer"].value = this.depthTarget.depthTexture;
		this.fsQuad.material.uniforms["depthBuffer"].value = this.normalTarget.depthTexture;

		this.fsQuad.material.uniforms[
			"normalBuffer"
		].value = this.normalTarget.texture;
		this.fsQuad.material.uniforms["sceneColorBuffer"].value =
			readBuffer.texture;
		this.fsQuad.material.uniforms["originalSceneDepthBuffer"].value = this.originalSceneDepthTexture;

		// 3. Draw the outlines using the depth texture and normal texture
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

		// Make temporarily hidden objects visible again
		this.renderScene.traverse( function( node ) {
		    if (node.applyOutline != true && node.type == 'Mesh' && node.oldVisibleValue != undefined) {
		    	node.visible = node.oldVisibleValue;
		    }
		});
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
			uniform sampler2D normalBuffer;
			uniform sampler2D originalSceneDepthBuffer;
			uniform float cameraNear;
			uniform float cameraFar;
			uniform vec4 screenSize;
			uniform vec3 outlineColor;
			uniform vec4 multiplierParameters;
			uniform int debugVisualize;

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
			vec3 getPixelNormal(int x, int y) {
				return texture2D(normalBuffer, vUv + screenSize.zw * vec2(x, y)).rgb;
			}

			float saturate(float num) {
				return clamp(num, 0.0, 1.0);
			}

			void main() {
				vec4 sceneColor = texture2D(sceneColorBuffer, vUv);
				float depth = getPixelDepth(0, 0);
				float originalDepth = readDepth(originalSceneDepthBuffer, vUv + screenSize.zw);
				vec3 normal = getPixelNormal(0, 0);

				// Get the difference between depth of neighboring pixels and current.
				float depthDiff = 0.0;
				depthDiff += abs(depth - getPixelDepth(1, 0));
				depthDiff += abs(depth - getPixelDepth(-1, 0));
				depthDiff += abs(depth - getPixelDepth(0, 1));
				depthDiff += abs(depth - getPixelDepth(0, -1));

				// Get the difference between normals of neighboring pixels and current
				float normalDiff = 0.0;
				normalDiff += distance(normal, getPixelNormal(1, 0));
				normalDiff += distance(normal, getPixelNormal(0, 1));
				normalDiff += distance(normal, getPixelNormal(0, 1));
				normalDiff += distance(normal, getPixelNormal(0, -1));

				normalDiff += distance(normal, getPixelNormal(1, 1));
				normalDiff += distance(normal, getPixelNormal(1, -1));
				normalDiff += distance(normal, getPixelNormal(-1, 1));
				normalDiff += distance(normal, getPixelNormal(-1, -1));

				// Apply multiplier & bias to each 
				float depthBias = multiplierParameters.x;
				float depthMultiplier = multiplierParameters.y;
				float normalBias = multiplierParameters.z;
				float normalMultiplier = multiplierParameters.w;

				depthDiff = depthDiff * depthMultiplier;
				depthDiff = saturate(depthDiff);
				depthDiff = pow(depthDiff, depthBias);

				normalDiff = normalDiff * normalMultiplier;
				normalDiff = saturate(normalDiff);
				normalDiff = pow(normalDiff, normalBias);


				float outline = normalDiff + depthDiff;

				// Don't render outlines if they are behind something
				// in the original depth buffer 
				// we find this out by comparing the depth value of current pixel 
				if ( depth > originalDepth) {
					outline = 0.0;
				}
			
				// Combine outline with scene color.
				vec4 outlineColor = vec4(outlineColor, 1.0);
				gl_FragColor = vec4(mix(sceneColor, outlineColor, outline));

				// For debug visualization of the different inputs to this shader.
				if (debugVisualize == 1) {
					gl_FragColor = sceneColor;
				}
				if (debugVisualize == 2) {
					gl_FragColor = vec4(vec3(depth), 1.0);
				}
				if (debugVisualize == 5) {
					gl_FragColor = vec4(vec3(originalDepth), 1.0);
				}
				if (debugVisualize == 3) {
					gl_FragColor = vec4(normal, 1.0);
				}
				if (debugVisualize == 4) {
					gl_FragColor = vec4(vec3(outline * outlineColor), 1.0);
				}

				
			}
			`;
	}

	createOutlinePostProcessMaterial() {
		return new THREE.ShaderMaterial({
			uniforms: {
				debugVisualize: { value: 0 },
				sceneColorBuffer: {},
				depthBuffer: {},
				normalBuffer: {},
				originalSceneDepthBuffer: {},
				outlineColor: { value: new THREE.Color(0xffffff) },
				//4 scalar values packed in one uniform: depth multiplier, depth bias, and same for normals.
				multiplierParameters: { value: new THREE.Vector4(1, 1, 1, 1) },
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
