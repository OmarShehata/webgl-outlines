# How to render outlines in WebGL

This is the source code for [How to render outlines in WebGL](https://omar-shehata.medium.com/how-to-render-outlines-in-webgl-8253c14724f9) & [Better outline rendering using surface IDs with WebGL](https://omar-shehata.medium.com/better-outline-rendering-using-surface-ids-with-webgl-e13cdab1fd94) implemented in ThreeJS and PlayCanvas. This renders outlines with a post-process shader that takes the depth buffer and a surface normal buffer as inputs, followed by an FXAA pass. 

![Three versions of a boat 3D model showing the different outline techniques](media/boat_outline_3_versions.jpeg)_Boat model by [Google Poly](https://poly.google.com/view/84-DYhLzxNq)_

* **Left** is a common way to visualize outlines, boundary only. 
* **Middle** is the technique in this repo. 
* **Right** is same as middle with outlines only.
### Live demo

See [live ThreeJS version](https://threejs-outlines-postprocess.glitch.me/). 

Drag and drop any glTF file to see the outlines on your own models (must be a single `.glb` file).

Or click "Login to Sketchfab" and paste in any Sketchfab model URL, such as: https://sketchfab.com/3d-models/skull-downloadable-1a9db900738d44298b0bc59f68123393

### Source code

* [ThreeJS version](threejs-outlines-minimal/)
* [ThreeJS version with debug visualizations](threejs/README.md) <-- this is the source code for the live demo that contains all the parameters in the GUI
* [PlayCanvas version](playcanvas/README.md)

### Applying outlines selectively to objects

If you want to apply the outline effect to specific objects, instead of all objects in the scene, an example ThreeJS implementation is documented here: https://github.com/OmarShehata/webgl-outlines/pull/3.

![outline_selected](https://user-images.githubusercontent.com/1711126/124300669-cd0a9980-db2c-11eb-9d58-b55ce80cf95a.gif)
