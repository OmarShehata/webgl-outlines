# Rendering outlines in ThreeJS

This is the ThreeJS implementation of [How to render outlines in WebGL](https://omar-shehata.medium.com/how-to-render-outlines-in-webgl-8253c14724f9). See a [live demo on CodeSandbox](https://l01dp.csb.app/). 

To run this locally, run `npm install` and `npm run dev` in this directory.

The post process code is in `CustomOutlinePass.js`.

Some notes to be aware of:

* There's additional debug code/uniforms set up for debug visualization of the various inputs to the effect. This should be removed when using it in a real project.
* This effect can be optimized by having the very first render pass output both depth and normals, instead of getting the normals from a 2nd pass.
* The FXAA pass may not be needed if we can use a `THREE.WebGLMultisampleRenderTarget` which allows us to use the browser's antialiasing. Note you may need to work around this known issue: https://github.com/mrdoob/three.js/issues/18876.
