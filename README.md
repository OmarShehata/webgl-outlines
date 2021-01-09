# How to render outlines in WebGL

This is the source code for [How to render outlines in WebGL](TODO) implemented in ThreeJS and PlayCanvas. This renders outlines with a post-process shader that takes the depth buffer and a surface normal buffer as inputs, followed by an FXAA pass. This produces a full outline of the model, not just an outer boundary.

![Three versions of a boat 3D model showing the different outline techniques](media/boat_outline_3_versions.jpeg)_Left is a common way to visualize outlines. Middle is this technique. Right is same technique, outlines only. Boat model by [Google Poly](https://poly.google.com/view/84-DYhLzxNq)_

### Live demo

See [ThreeJS version on CodeSandbox](https://l01dp.csb.app/). 

Drag and drop any glTF file to see the outlines on your own models (must be a single `.glb` file).

### Running it locally

* [Instructions for the ThreeJS version](threejs/README.md)
* [Instructions for the PlayCanvas version](playcanvas/README.md)