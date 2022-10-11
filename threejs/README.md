# Rendering outlines in ThreeJS

This is the ThreeJS implementation of [How to render outlines in WebGL](https://omar-shehata.medium.com/how-to-render-outlines-in-webgl-8253c14724f9). See a [live demo](https://threejs-outlines-postprocess.glitch.me/). 

This contains two implementations: v1 uses the depth & normal buffer. v2 uses the depth & "surface ID" buffer. See [Better outline rendering using surface IDs with WebGL](https://omar-shehata.medium.com/better-outline-rendering-using-surface-ids-with-webgl-e13cdab1fd94) for an explanation of the v2 technique.

To run this locally, run `npm install` and `npm run dev` in this directory.

The post process code is in `CustomOutlinePass.js`.

Some notes to be aware of:

* There's additional debug code/uniforms set up for debug visualization of the various inputs to the effect. This should be removed when using it in a real project.
  * See [threejs-outlines-minimal](../threejs-outlines-minimal) for an implementation without any debug code
* The FXAA pass may not be needed if we can use a `THREE.WebGLMultisampleRenderTarget` which allows us to use the browser's antialiasing. Note you may need to work around this known issue: https://github.com/mrdoob/three.js/issues/18876.
