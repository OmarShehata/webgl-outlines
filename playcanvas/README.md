# Rendering outlines in PlayCanvas

* Source for article (LINK) in PlayCanvas.
* This is an engine example. See the project you can fork or see a live demo here: https://playcanvas.com/project/753116/overview/outline-post-process
* To run this locally, `npm install` and `npm run start`
* Caveats
	* The effect shader is in `outline-post-process.js`
	* Second camera may not be a strict duplicate
	* It gets normals by replacing the material with a custom normal material
	* It automatically adds opaque meshes to the second layer.
	* Would be more efficient by getting the normal buffer from the engine