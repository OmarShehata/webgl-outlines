# Rendering outlines in PlayCanvas

This is the PlayCanvas implementation of [How to render outlines in WebGL](https://omar-shehata.medium.com/how-to-render-outlines-in-webgl-8253c14724f9).

See a PlayCanvas editor project you can run or fork here: https://playcanvas.com/project/753116/overview/outline-post-process. 

The code in this directory has an engine-only implementation of the effect. To run it, run `npm install` and `npm run start`. Then go to [localhost:8080](http://localhost:8080).

The effect is in `outline-post-process.js`. It requires the setup of a second camera and a second render layer to re-render the scene and capture a normal buffer. This is handled in `index.js`. 

The editor version of this effect also automatically creates the second camera/render layer as well, so all you need to do is attach the script to your camera.